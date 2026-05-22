'use client';

import { useCallback, useEffect, useReducer } from 'react';
import type { NormalizedEvent } from '@agent-studio/shared';
import { API_BASE_URL, api, type ApiRun, type ApiStageResult } from './api';

export type RunStreamState = {
  run: ApiRun | null;
  /** stageIndex → 누적 텍스트 (스트리밍 중에 채워짐) */
  liveText: Record<number, string>;
  events: NormalizedEvent[];
  connected: boolean;
  error: string | null;
};

export type RunStreamHandle = RunStreamState & {
  /** DB에서 run을 다시 가져와 snapshot으로 덮어쓰기 */
  refresh: () => Promise<void>;
};

type Action =
  | { type: 'snapshot'; run: ApiRun }
  | { type: 'event'; event: NormalizedEvent }
  | { type: 'connect' }
  | { type: 'disconnect' }
  | { type: 'error'; error: string };

function stageIndexOf(run: ApiRun | null, stageId: string): number | undefined {
  if (!run) return undefined;
  const fromResults = run.stageResults?.find((s) => s.stageId === stageId);
  if (fromResults) return fromResults.stageIndex;
  const fromDef = run.agentVersion?.stages.findIndex((s) => s.id === stageId);
  return fromDef !== undefined && fromDef >= 0 ? fromDef : undefined;
}

function reducer(state: RunStreamState, action: Action): RunStreamState {
  switch (action.type) {
    case 'snapshot':
      return { ...state, run: action.run };
    case 'connect':
      return { ...state, connected: true, error: null };
    case 'disconnect':
      return { ...state, connected: false };
    case 'error':
      return { ...state, error: action.error };
    case 'event': {
      const { event } = action;
      const next: RunStreamState = {
        ...state,
        events: [...state.events, event],
      };
      switch (event.type) {
        case 'text_delta': {
          const idx = stageIndexOf(next.run, event.stageId);
          if (idx === undefined) return next;
          const prev = next.liveText[idx] ?? '';
          next.liveText = { ...next.liveText, [idx]: prev + event.text };
          return next;
        }
        case 'stage_started':
          if (next.run) {
            next.run = {
              ...next.run,
              currentStageIndex: event.stageIndex,
              status: 'running',
            };
          }
          return next;
        case 'stage_completed': {
          if (!next.run) return next;
          const updated = { ...next.run };
          const existing = updated.stageResults ?? [];
          const idx = existing.findIndex((s) => s.stageIndex === event.stageIndex);
          const merged: ApiStageResult = {
            id: existing[idx]?.id ?? `live-${event.stageId}`,
            runId: updated.id,
            stageId: event.stageId,
            stageIndex: event.stageIndex,
            status: 'completed',
            model: existing[idx]?.model ?? null,
            provider: existing[idx]?.provider ?? null,
            resolvedPrompt: existing[idx]?.resolvedPrompt ?? null,
            outputText: event.outputText,
            outputStructured: event.outputStructured,
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            cacheReadTokens: event.usage.cacheReadTokens,
            cacheCreationTokens: event.usage.cacheCreationTokens,
            costUsd: existing[idx]?.costUsd ?? null,
            stopReason: existing[idx]?.stopReason ?? null,
            error: null,
            startedAt: existing[idx]?.startedAt ?? null,
            endedAt: new Date().toISOString(),
            durationMs: existing[idx]?.durationMs ?? null,
          };
          if (idx >= 0) existing[idx] = merged;
          else existing.push(merged);
          updated.stageResults = [...existing].sort(
            (a, b) => a.stageIndex - b.stageIndex,
          );
          updated.totalInputTokens += event.usage.inputTokens;
          updated.totalOutputTokens += event.usage.outputTokens;
          updated.totalCacheReadTokens += event.usage.cacheReadTokens;
          next.run = updated;
          return next;
        }
        case 'run_completed':
        case 'run_cancelled':
        case 'run_failed':
          if (next.run) {
            next.run = {
              ...next.run,
              status:
                event.type === 'run_completed'
                  ? 'completed'
                  : event.type === 'run_cancelled'
                    ? 'cancelled'
                    : 'failed',
              endedAt: new Date().toISOString(),
              error: event.type === 'run_failed' ? event.error : next.run.error,
            };
          }
          return next;
        default:
          return next;
      }
    }
  }
}

export function useRunStream(runId: string | null): RunStreamHandle {
  const [state, dispatch] = useReducer(reducer, {
    run: null,
    liveText: {},
    events: [],
    connected: false,
    error: null,
  });

  // 마운트 직후 REST로 한 번 fetch — SSE snapshot이 늦거나 누락돼도 화면이 즉시 채워짐
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    api
      .getRun(runId)
      .then((run) => {
        if (!cancelled) dispatch({ type: 'snapshot', run });
      })
      .catch((err) => {
        if (!cancelled) dispatch({ type: 'error', error: `initial fetch: ${String(err)}` });
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    const es = new EventSource(`${API_BASE_URL}/runs/${runId}/stream`);

    es.addEventListener('open', () => dispatch({ type: 'connect' }));

    es.addEventListener('snapshot', (e) => {
      try {
        const run: ApiRun = JSON.parse((e as MessageEvent).data);
        dispatch({ type: 'snapshot', run });
      } catch (err) {
        dispatch({ type: 'error', error: `snapshot parse: ${String(err)}` });
      }
    });

    const handleEvent = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data) as NormalizedEvent;
        dispatch({ type: 'event', event });
      } catch (err) {
        dispatch({ type: 'error', error: `event parse: ${String(err)}` });
      }
    };

    for (const type of [
      'run_started',
      'stage_started',
      'text_delta',
      'tool_use_delta',
      'stage_completed',
      'stage_failed',
      'run_completed',
      'run_cancelled',
      'run_failed',
    ]) {
      es.addEventListener(type, handleEvent as EventListener);
    }

    es.onerror = () => {
      dispatch({ type: 'disconnect' });
    };

    return () => {
      es.close();
    };
  }, [runId]);

  const refresh = useCallback(async () => {
    if (!runId) return;
    try {
      const fresh = await api.getRun(runId);
      dispatch({ type: 'snapshot', run: fresh });
    } catch (err) {
      dispatch({ type: 'error', error: `refresh: ${String(err)}` });
    }
  }, [runId]);

  // 종료 상태가 되면 한 번 자동 재페치 — DB에서 cost, resolvedPrompt,
  // durationMs 같은 SSE에 없는 필드를 가져오기 위함.
  // 주의: 의존성에 state.run 전체를 넣으면 refresh가 새 객체로 state.run을
  // 갱신할 때마다 effect가 또 발사되어 무한 루프가 됨. status만 의존.
  const status = state.run?.status;
  useEffect(() => {
    if (status !== 'completed' && status !== 'cancelled' && status !== 'failed') {
      return;
    }
    const t = setTimeout(() => {
      void refresh();
    }, 300);
    return () => clearTimeout(t);
  }, [status, refresh]);

  return { ...state, refresh };
}
