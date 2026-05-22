import type { FastifyInstance } from 'fastify';
import { StartRunBodySchema } from '@agent-studio/shared';
import { prisma } from '../db.js';

/**
 * 진행 중인 Run의 AbortController를 메모리에 보관.
 * (싱글 인스턴스 가정. 멀티 인스턴스로 가면 Redis 등으로 교체)
 */
const runControllers = new Map<string, AbortController>();

export async function registerRunRoutes(app: FastifyInstance) {
  // Run 시작 (실제 실행은 다음 단계에서 runtime executor 연결)
  app.post('/', async (req, reply) => {
    const parsed = StartRunBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues });
    }
    const agent = await prisma.agent.findUnique({
      where: { slug: parsed.data.agentSlug },
      include: { currentVersion: true },
    });
    if (!agent || !agent.currentVersionId || !agent.currentVersion) {
      return reply.code(404).send({ error: 'agent_or_version_not_found' });
    }

    const run = await prisma.run.create({
      data: {
        agentId: agent.id,
        agentVersionId: agent.currentVersionId,
        status: 'pending',
        initialInput: parsed.data.input,
      },
    });

    const controller = new AbortController();
    runControllers.set(run.id, controller);

    // TODO: 다음 단계에서 runtime.executeRun(run, agent.currentVersion, controller.signal) 호출
    return reply.code(202).send({ runId: run.id, status: run.status });
  });

  // Run 조회 (StageResult JOIN)
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const run = await prisma.run.findUnique({
      where: { id: req.params.id },
      include: {
        stageResults: { orderBy: { stageIndex: 'asc' } },
        agent: true,
        agentVersion: true,
      },
    });
    if (!run) return reply.code(404).send({ error: 'run_not_found' });
    return run;
  });

  // Run 중단
  app.post<{ Params: { id: string } }>('/:id/cancel', async (req, reply) => {
    const controller = runControllers.get(req.params.id);
    if (!controller) {
      return reply.code(404).send({ error: 'run_not_active' });
    }
    controller.abort();
    return { ok: true };
  });

  // SSE 스트림 (다음 단계에서 runtime의 EventEmitter 연결)
  app.get<{ Params: { id: string } }>('/:id/stream', async (req, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.write(`event: open\ndata: {"runId":"${req.params.id}"}\n\n`);
    // TODO: runtime의 이벤트 버스 구독 후 reply.raw.write 로 푸시
    req.raw.on('close', () => {
      reply.raw.end();
    });
  });
}
