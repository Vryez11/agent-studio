import type { ApiStageResult } from '@/lib/api';
import type { StageDefinition } from '@agent-studio/shared';
import { StatusBadge } from './StatusBadge';

function fmtMs(ms: number | null) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtCost(usd: string | null) {
  if (usd == null) return '—';
  return `$${Number(usd).toFixed(4)}`;
}

export function StageCard({
  definition,
  result,
  index,
  liveText,
}: {
  definition?: StageDefinition;
  result?: ApiStageResult;
  index: number;
  liveText?: string;
}) {
  const status = result?.status ?? 'pending';
  const name = definition?.name ?? result?.stageId ?? '(unknown)';
  const model = definition?.model ?? result?.model ?? '—';
  const provider = definition?.provider ?? result?.provider ?? '—';

  const displayText = liveText ?? result?.outputText ?? '';
  const structured = result?.outputStructured;

  return (
    <div className={`stage-card ${status}`}>
      <div className="stage-header">
        <div className="stage-title">
          <span className="stage-index">{index + 1}.</span>
          {name}
        </div>
        <div className="row">
          <StatusBadge status={status} />
          {status === 'running' && <span className="live-indicator">streaming</span>}
        </div>
      </div>

      <div className="stage-meta">
        <span>
          <code>{provider}</code> / <code>{model}</code>
        </span>
        <span>
          input <code>{result?.inputTokens?.toLocaleString() ?? '—'}</code>
        </span>
        <span>
          output <code>{result?.outputTokens?.toLocaleString() ?? '—'}</code>
        </span>
        {result?.cacheReadTokens ? (
          <span>
            cache-read <code>{result.cacheReadTokens.toLocaleString()}</code>
          </span>
        ) : null}
        <span>
          time <code>{fmtMs(result?.durationMs ?? null)}</code>
        </span>
        <span>
          cost <code>{fmtCost(result?.costUsd ?? null)}</code>
        </span>
      </div>

      {result?.error && (
        <div
          className="stage-output"
          style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
        >
          {result.error}
        </div>
      )}

      {(displayText || structured !== undefined) && (
        <div className="stage-output">
          {structured !== undefined
            ? JSON.stringify(structured, null, 2)
            : displayText}
        </div>
      )}
    </div>
  );
}
