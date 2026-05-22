import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  CreateAgentBodySchema,
  UpdateAgentBodySchema,
} from '@agent-studio/shared';
import { prisma } from '../db.js';

export async function registerAgentRoutes(app: FastifyInstance) {
  // 목록
  app.get('/', async () => {
    const agents = await prisma.agent.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { currentVersion: true },
    });
    return agents;
  });

  // 단건 조회 (slug)
  app.get<{ Params: { slug: string } }>('/:slug', async (req, reply) => {
    const agent = await prisma.agent.findUnique({
      where: { slug: req.params.slug },
      include: { currentVersion: true, versions: { orderBy: { version: 'desc' } } },
    });
    if (!agent) return reply.code(404).send({ error: 'agent_not_found' });
    return agent;
  });

  // 생성 (v1 자동 발급, currentVersion에 연결)
  app.post('/', async (req, reply) => {
    const parsed = CreateAgentBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }
    const { slug, name, description, definition } = parsed.data;

    const created = await prisma.$transaction(async (tx) => {
      const agent = await tx.agent.create({
        data: { slug, name, description },
      });
      const version = await tx.agentVersion.create({
        data: {
          agentId: agent.id,
          version: 1,
          stages: definition.stages as unknown as Prisma.InputJsonValue,
          contextSchema:
            (definition.contextSchema as Prisma.InputJsonValue | undefined) ??
            Prisma.JsonNull,
        },
      });
      return tx.agent.update({
        where: { id: agent.id },
        data: { currentVersionId: version.id },
        include: { currentVersion: true },
      });
    });

    return reply.code(201).send(created);
  });

  // 삭제 — 관련 runs (+ stage_results cascade), agent_versions까지 트랜잭션으로 일괄 삭제
  app.delete<{ Params: { slug: string } }>('/:slug', async (req, reply) => {
    const agent = await prisma.agent.findUnique({
      where: { slug: req.params.slug },
    });
    if (!agent) return reply.code(404).send({ error: 'agent_not_found' });

    await prisma.$transaction([
      // runs 먼저 — stage_results는 onDelete: Cascade로 자동 정리됨
      prisma.run.deleteMany({ where: { agentId: agent.id } }),
      // currentVersionId의 FK 제약 해제 (agent_versions cascade 전에 unique 충돌 방지)
      prisma.agent.update({
        where: { id: agent.id },
        data: { currentVersionId: null },
      }),
      // agent_versions는 agent 삭제 시 onDelete: Cascade로 자동 정리되지만,
      // 명시적으로 먼저 지워두면 의존성이 분명해짐
      prisma.agentVersion.deleteMany({ where: { agentId: agent.id } }),
      prisma.agent.delete({ where: { id: agent.id } }),
    ]);
    return { ok: true };
  });

  // 새 버전 발행 (definition 변경 시 새 row)
  app.put<{ Params: { slug: string } }>('/:slug', async (req, reply) => {
    const parsed = UpdateAgentBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }
    const agent = await prisma.agent.findUnique({ where: { slug: req.params.slug } });
    if (!agent) return reply.code(404).send({ error: 'agent_not_found' });

    const latest = await prisma.agentVersion.findFirst({
      where: { agentId: agent.id },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const updated = await prisma.$transaction(async (tx) => {
      const newVersion = await tx.agentVersion.create({
        data: {
          agentId: agent.id,
          version: nextVersion,
          stages: parsed.data.definition.stages as unknown as Prisma.InputJsonValue,
          contextSchema:
            (parsed.data.definition.contextSchema as Prisma.InputJsonValue | undefined) ??
            Prisma.JsonNull,
        },
      });
      return tx.agent.update({
        where: { id: agent.id },
        data: {
          name: parsed.data.name ?? agent.name,
          description: parsed.data.description ?? agent.description,
          currentVersionId: newVersion.id,
        },
        include: { currentVersion: true },
      });
    });

    return updated;
  });
}
