import type {
  StageDefinition,
  Usage,
  NormalizedEvent,
} from '@agent-studio/shared';
import { ZERO_USAGE } from '@agent-studio/shared';
import { resolveTemplate, type StageRefSource } from './template.js';
import { runEvents } from './events.js';

/**
 * 외부에서 주입받는 의존성. apps/api에서 Prisma와 provider 레지스트리를 연결한다.
 */
export type ExecutorDeps = {
  /** provider 어댑터 가져오기 */
  getProvider: (name: string) => StageProvider;
  /** stage_results 신규 row 생성 */
  createStageResult: (input: {
    runId: string;
    stageId: string;
    stageIndex: number;
    model: string;
    provider: string;
    resolvedPrompt: unknown;
  }) => Promise<{ id: string; startedAt: Date }>;
  /** stage_results 완료 처리 */
  completeStageResult: (input: {
    id: string;
    outputText: string;
    outputStructured?: unknown;
    usage: Usage;
    stopReason: string;
  }) => Promise<void>;
  /** stage_results 실패/취소 처리 */
  failStageResult: (input: {
    id: string;
    status: 'failed' | 'cancelled';
    error?: string;
    partialOutputText?: string;
  }) => Promise<void>;
  /** runs row 상태 업데이트 (currentStageIndex, totals 가산 등) */
  updateRunProgress: (input: {
    runId: string;
    currentStageIndex: number;
    addUsage: Usage;
  }) => Promise<void>;
  /** runs 종료 처리 */
  finalizeRun: (input: {
    runId: string;
    status: 'completed' | 'cancelled' | 'failed';
    error?: string;
  }) => Promise<void>;
  /** Run의 initialInput 조회 */
  getRunInput: (runId: string) => Promise<Record<string, unknown>>;
};

/**
 * Provider 어댑터가 구현해야 하는 최소 인터페이스. packages/providers에 실제 구현.
 */
export type StageProvider = {
  stream(
    stage: StageDefinition,
    resolvedUserMessage: string,
    signal: AbortSignal,
  ): AsyncIterable<NormalizedEvent>;
};

export type ExecuteRunInput = {
  runId: string;
  stages: StageDefinition[];
  signal: AbortSignal;
};

/**
 * 한 Run의 순차 실행. 각 단계마다:
 *   1. 템플릿 해석
 *   2. provider.stream() 구독 → 델타를 이벤트버스로 푸시
 *   3. 완료 시 DB에 결과 저장 + run totals 가산
 *   4. AbortSignal 체크 (중단 시 부분 결과 보존하고 탈출)
 */
export async function executeRun(
  input: ExecuteRunInput,
  deps: ExecutorDeps,
): Promise<void> {
  const { runId, stages, signal } = input;
  const runInput = await deps.getRunInput(runId);
  const stageOutputs: Record<string, StageRefSource> = {};

  runEvents.emit(runId, { type: 'run_started', runId });

  for (let i = 0; i < stages.length; i++) {
    if (signal.aborted) {
      await deps.finalizeRun({ runId, status: 'cancelled' });
      runEvents.emit(runId, { type: 'run_cancelled', runId });
      return;
    }

    const stage = stages[i]!;

    const resolvedUserMessage = resolveTemplate(stage.input.userMessageTemplate, {
      runInput,
      stages: stageOutputs,
    });

    const stageRow = await deps.createStageResult({
      runId,
      stageId: stage.id,
      stageIndex: i,
      model: stage.model,
      provider: stage.provider,
      resolvedPrompt: {
        system: stage.systemPrompt,
        user: resolvedUserMessage,
      },
    });

    runEvents.emit(runId, {
      type: 'stage_started',
      stageId: stage.id,
      stageIndex: i,
    });

    let textBuf = '';
    let structured: unknown = undefined;
    let usage: Usage = { ...ZERO_USAGE };
    let stopReason = 'unknown';

    try {
      const provider = deps.getProvider(stage.provider);
      for await (const ev of provider.stream(stage, resolvedUserMessage, signal)) {
        if (signal.aborted) break;
        switch (ev.type) {
          case 'text_delta':
            textBuf += ev.text;
            runEvents.emit(runId, ev);
            break;
          case 'tool_use_delta':
            runEvents.emit(runId, ev);
            break;
          case 'stage_completed':
            usage = ev.usage;
            structured = ev.outputStructured;
            if (ev.outputText) textBuf = ev.outputText;
            stopReason = 'end_turn';
            break;
          default:
            runEvents.emit(runId, ev);
        }
      }

      if (signal.aborted) {
        await deps.failStageResult({
          id: stageRow.id,
          status: 'cancelled',
          partialOutputText: textBuf,
        });
        await deps.finalizeRun({ runId, status: 'cancelled' });
        runEvents.emit(runId, { type: 'run_cancelled', runId });
        return;
      }

      await deps.completeStageResult({
        id: stageRow.id,
        outputText: textBuf,
        outputStructured: structured,
        usage,
        stopReason,
      });
      await deps.updateRunProgress({
        runId,
        currentStageIndex: i,
        addUsage: usage,
      });

      stageOutputs[stage.id] = {
        outputText: textBuf,
        outputStructured: structured,
      };

      runEvents.emit(runId, {
        type: 'stage_completed',
        stageId: stage.id,
        stageIndex: i,
        usage,
        outputText: textBuf,
        outputStructured: structured,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await deps.failStageResult({
        id: stageRow.id,
        status: 'failed',
        error: message,
        partialOutputText: textBuf,
      });
      runEvents.emit(runId, {
        type: 'stage_failed',
        stageId: stage.id,
        error: message,
      });

      if (stage.onError === 'continue') {
        stageOutputs[stage.id] = { outputText: textBuf, outputStructured: undefined };
        continue;
      }
      await deps.finalizeRun({ runId, status: 'failed', error: message });
      runEvents.emit(runId, { type: 'run_failed', runId, error: message });
      return;
    }
  }

  await deps.finalizeRun({ runId, status: 'completed' });
  runEvents.emit(runId, { type: 'run_completed', runId });
}
