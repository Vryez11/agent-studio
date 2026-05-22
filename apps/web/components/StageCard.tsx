import type { ApiStageResult, ResolvedPrompt } from '@/lib/api';
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

function fmtNum(n: number | null) {
  if (n == null) return '—';
  return n.toLocaleString();
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="stage-stat">
      <div className="stage-stat-label">{label}</div>
      <div className="stage-stat-value mono">{value}</div>
      {hint && <div className="stage-stat-hint">{hint}</div>}
    </div>
  );
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

  const resolved: ResolvedPrompt = result?.resolvedPrompt ?? null;
  const liveStreaming = status === 'running' && (liveText?.length ?? 0) > 0;
  const displayText =
    status === 'running'
      ? (liveText ?? '')
      : (result?.outputText ?? liveText ?? '');
  const structured = result?.outputStructured;
  const hasOutput =
    structured !== undefined ||
    (displayText && displayText.length > 0) ||
    liveStreaming;

  // 표시 우선순위: structured → text. 둘 다 토글로 노출.
  return (
    <div className={`stage-card ${status}`}>
      <div className="stage-header">
        <div className="stage-title">
          <span className="stage-index">{index + 1}.</span>
          {name}
        </div>
        <div className="row">
          <span className="muted mono" style={{ fontSize: '0.75rem' }}>
            {provider} / {model}
          </span>
          <StatusBadge status={status} />
          {status === 'running' && <span className="live-indicator">streaming</span>}
        </div>
      </div>

      <div className="stage-stats">
        <Stat label="입력 토큰" value={fmtNum(result?.inputTokens ?? null)} />
        <Stat label="출력 토큰" value={fmtNum(result?.outputTokens ?? null)} />
        <Stat
          label="캐시 읽기"
          value={fmtNum(result?.cacheReadTokens ?? null)}
          hint={
            result?.cacheCreationTokens
              ? `생성 ${fmtNum(result.cacheCreationTokens)}`
              : undefined
          }
        />
        <Stat label="비용" value={fmtCost(result?.costUsd ?? null)} />
        <Stat label="소요시간" value={fmtMs(result?.durationMs ?? null)} />
      </div>

      {result?.error && (
        <div className="stage-error">
          <div className="stage-section-label">에러</div>
          <pre className="stage-output" style={{ color: 'var(--danger)' }}>
            {result.error}
          </pre>
        </div>
      )}

      {(resolved?.system || resolved?.user) && (
        <details className="stage-details">
          <summary>입력 보기 (system + user)</summary>
          <div className="stage-section">
            {resolved.system && (
              <>
                <div className="stage-section-label">System Prompt</div>
                <pre className="stage-output">{resolved.system}</pre>
              </>
            )}
            {resolved.user && (
              <>
                <div className="stage-section-label" style={{ marginTop: '0.75rem' }}>
                  User Message (변수 해석 후)
                </div>
                <pre className="stage-output">{resolved.user}</pre>
              </>
            )}
          </div>
        </details>
      )}

      {hasOutput && (
        <details className="stage-details" open={liveStreaming || status !== 'pending'}>
          <summary>
            출력 보기
            {structured !== undefined && (
              <span className="dim" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                (structured JSON)
              </span>
            )}
          </summary>
          <div className="stage-section">
            {structured !== undefined ? (
              <>
                <div className="stage-section-label">Structured Output</div>
                <pre className="stage-output">{JSON.stringify(structured, null, 2)}</pre>
                {displayText && displayText.length > 0 && (
                  <>
                    <div
                      className="stage-section-label"
                      style={{ marginTop: '0.75rem' }}
                    >
                      Raw Text
                    </div>
                    <pre className="stage-output">{displayText}</pre>
                  </>
                )}
              </>
            ) : (
              <pre className="stage-output">{displayText}</pre>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
