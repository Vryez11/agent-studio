import { StageDefinitionSchema, type StageDefinition } from '@agent-studio/shared';
import { executeRun, runEvents } from '@agent-studio/runtime';
import { createProviderRegistry } from '@agent-studio/providers';
import { prisma } from '../db.js';
import { createExecutorDeps } from './executor-deps.js';

const providerRegistry = createProviderRegistry();
const deps = createExecutorDeps(providerRegistry);

/** runId → AbortController */
const runControllers = new Map<string, AbortController>();

export function getRunController(runId: string): AbortController | undefined {
  return runControllers.get(runId);
}

export function cancelRun(runId: string): boolean {
  const c = runControllers.get(runId);
  if (!c) return false;
  c.abort();
  return true;
}

/**
 * Run을 백그라운드로 시작.
 * - status를 running으로 즉시 전환
 * - AbortController 등록
 * - executeRun을 await하지 않고 발사 (non-blocking)
 */
export async function startRun(runId: string): Promise<void> {
  const run = await prisma.run.findUniqueOrThrow({
    where: { id: runId },
    include: { agentVersion: true },
  });

  const rawStages = run.agentVersion.stages;
  if (!Array.isArray(rawStages)) {
    throw new Error('agent_version.stages must be an array');
  }
  const stages: StageDefinition[] = rawStages.map((s) =>
    StageDefinitionSchema.parse(s),
  );

  await prisma.run.update({
    where: { id: runId },
    data: { status: 'running', startedAt: new Date(), currentStageIndex: 0 },
  });

  const controller = new AbortController();
  runControllers.set(runId, controller);

  // 백그라운드 실행 — 에러는 catch해서 로그만, finalizeRun이 이미 처리
  void executeRun({ runId, stages, signal: controller.signal }, deps)
    .catch((err) => {
      console.error(`[run ${runId}] uncaught executor error:`, err);
      runEvents.emit(runId, {
        type: 'run_failed',
        runId,
        error: err instanceof Error ? err.message : String(err),
      });
    })
    .finally(() => {
      runControllers.delete(runId);
    });
}
