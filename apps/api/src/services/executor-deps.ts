import { Prisma } from '@prisma/client';
import { calculateCost, type Usage } from '@agent-studio/shared';
import type { ExecutorDeps, StageProvider } from '@agent-studio/runtime';
import { prisma } from '../db.js';

/**
 * runtime의 ExecutorDeps 인터페이스를 Prisma로 구현.
 */
export function createExecutorDeps(
  getProvider: (name: string) => StageProvider,
): ExecutorDeps {
  return {
    getProvider,

    async createStageResult(input) {
      const row = await prisma.stageResult.create({
        data: {
          runId: input.runId,
          stageId: input.stageId,
          stageIndex: input.stageIndex,
          status: 'running',
          model: input.model,
          provider: input.provider,
          resolvedPrompt: input.resolvedPrompt as Prisma.InputJsonValue,
          startedAt: new Date(),
        },
      });
      return { id: row.id, startedAt: row.startedAt! };
    },

    async completeStageResult(input) {
      const endedAt = new Date();
      const row = await prisma.stageResult.findUniqueOrThrow({
        where: { id: input.id },
        select: { startedAt: true, model: true },
      });
      const durationMs = row.startedAt
        ? endedAt.getTime() - row.startedAt.getTime()
        : null;
      const costUsd = calculateCost(row.model ?? '', input.usage);

      await prisma.stageResult.update({
        where: { id: input.id },
        data: {
          status: 'completed',
          outputText: input.outputText,
          outputStructured:
            (input.outputStructured as Prisma.InputJsonValue | undefined) ??
            Prisma.JsonNull,
          inputTokens: input.usage.inputTokens,
          outputTokens: input.usage.outputTokens,
          cacheReadTokens: input.usage.cacheReadTokens,
          cacheCreationTokens: input.usage.cacheCreationTokens,
          costUsd: new Prisma.Decimal(costUsd.toFixed(6)),
          stopReason: input.stopReason,
          endedAt,
          durationMs,
        },
      });
    },

    async failStageResult(input) {
      const endedAt = new Date();
      const existing = await prisma.stageResult.findUnique({
        where: { id: input.id },
        select: { startedAt: true },
      });
      const durationMs = existing?.startedAt
        ? endedAt.getTime() - existing.startedAt.getTime()
        : null;
      await prisma.stageResult.update({
        where: { id: input.id },
        data: {
          status: input.status,
          error: input.error,
          outputText: input.partialOutputText,
          endedAt,
          durationMs,
        },
      });
    },

    async updateRunProgress(input) {
      // cost 가산은 stage_result의 costUsd를 다시 읽어서 합치는 게 정확하지만,
      // 빈번한 SELECT를 피하기 위해 usage 기반으로 다시 계산하지 않고,
      // 단순 토큰 합산만 가산. cost 총합은 finalize에서 한 번에 집계.
      await prisma.run.update({
        where: { id: input.runId },
        data: {
          status: 'running',
          currentStageIndex: input.currentStageIndex,
          totalInputTokens: { increment: input.addUsage.inputTokens },
          totalOutputTokens: { increment: input.addUsage.outputTokens },
          totalCacheReadTokens: { increment: input.addUsage.cacheReadTokens },
        },
      });
    },

    async finalizeRun(input) {
      // stage_results의 cost 합계를 run.totalCostUsd에 반영
      const agg = await prisma.stageResult.aggregate({
        where: { runId: input.runId },
        _sum: { costUsd: true },
      });
      await prisma.run.update({
        where: { id: input.runId },
        data: {
          status: input.status,
          error: input.error,
          endedAt: new Date(),
          totalCostUsd: agg._sum.costUsd ?? new Prisma.Decimal(0),
        },
      });
    },

    async getRunInput(runId) {
      const run = await prisma.run.findUniqueOrThrow({
        where: { id: runId },
        select: { initialInput: true },
      });
      return run.initialInput as Record<string, unknown>;
    },
  };
}
