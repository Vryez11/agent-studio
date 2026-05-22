import type { FastifyInstance } from 'fastify';
import { StartRunBodySchema } from '@agent-studio/shared';
import { runEvents } from '@agent-studio/runtime';
import { prisma } from '../db.js';
import { startRun, cancelRun } from '../services/orchestrator.js';

export async function registerRunRoutes(app: FastifyInstance) {
  // Run 시작
  app.post('/', async (req, reply) => {
    const parsed = StartRunBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'invalid_body', issues: parsed.error.issues });
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

    // 백그라운드 시작 — await하지 않음
    startRun(run.id).catch((err) => {
      req.log.error({ err, runId: run.id }, 'startRun failed');
    });

    return reply.code(202).send({ runId: run.id, status: 'pending' });
  });

  // Run 조회 (StageResult 포함)
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

  // 목록
  app.get('/', async (req) => {
    const query = req.query as { agentId?: string; limit?: string };
    return prisma.run.findMany({
      where: query.agentId ? { agentId: query.agentId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(query.limit ?? 50), 200),
      include: { agent: { select: { slug: true, name: true } } },
    });
  });

  // 삭제 — stage_results / stage_events는 onDelete: Cascade로 함께 정리됨
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    // 진행 중이면 먼저 중단 시도 (memory에 controller가 있으면)
    cancelRun(req.params.id);
    const deleted = await prisma.run
      .delete({ where: { id: req.params.id } })
      .catch(() => null);
    if (!deleted) return reply.code(404).send({ error: 'run_not_found' });
    return { ok: true };
  });

  // 중단
  app.post<{ Params: { id: string } }>('/:id/cancel', async (req, reply) => {
    const ok = cancelRun(req.params.id);
    if (!ok) return reply.code(404).send({ error: 'run_not_active' });
    return { ok: true };
  });

  // SSE 스트림
  app.get<{ Params: { id: string } }>('/:id/stream', async (req, reply) => {
    const runId = req.params.id;

    // Fastify가 응답을 자동으로 닫지 않도록 hijack — 이후 reply.raw로만 쓴다
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`event: open\ndata: ${JSON.stringify({ runId })}\n\n`);

    // 클라이언트가 늦게 붙은 경우를 위해 현재 DB 상태를 첫 이벤트로 보냄.
    // agentVersion을 포함해야 클라이언트가 단계 정의를 알 수 있음.
    const snapshot = await prisma.run.findUnique({
      where: { id: runId },
      include: {
        stageResults: { orderBy: { stageIndex: 'asc' } },
        agent: { select: { slug: true, name: true } },
        agentVersion: true,
      },
    });
    if (snapshot) {
      res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
      if (
        snapshot.status === 'completed' ||
        snapshot.status === 'cancelled' ||
        snapshot.status === 'failed'
      ) {
        res.write(
          `event: ${snapshot.status}\ndata: ${JSON.stringify({ runId })}\n\n`,
        );
        res.end();
        return;
      }
    }

    const heartbeat = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 15_000);

    const unsubscribe = runEvents.subscribe(runId, (ev) => {
      res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
      if (
        ev.type === 'run_completed' ||
        ev.type === 'run_cancelled' ||
        ev.type === 'run_failed'
      ) {
        clearInterval(heartbeat);
        unsubscribe();
        res.end();
      }
    });

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
