'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useRunStream } from '@/lib/useRunStream';
import { StatusBadge } from '@/components/StatusBadge';
import { StageCard } from '@/components/StageCard';

function fmtCost(usd: string | number | null) {
  if (usd == null) return '—';
  const n = typeof usd === 'string' ? Number(usd) : usd;
  return `$${n.toFixed(4)}`;
}

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const { run, liveText, connected, error } = useRunStream(params.id);
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    try {
      await api.cancelRun(params.id);
    } catch (e) {
      console.error(e);
    } finally {
      setCancelling(false);
    }
  }

  if (error) return <p className="muted">스트림 오류: {error}</p>;
  if (!run)
    return (
      <p className="muted">
        Run을 불러오는 중… <span className="dim mono">{params.id}</span>
      </p>
    );

  const stages = run.agentVersion?.stages ?? [];
  const isActive = run.status === 'running' || run.status === 'pending';

  return (
    <div>
      <div className="row" style={{ marginBottom: '0.5rem' }}>
        <Link href="/runs" className="muted">
          ← Runs
        </Link>
      </div>

      <div className="row between" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          Run
          <small className="mono">{run.id.slice(0, 8)}…</small>
        </h1>
        <div className="row">
          <StatusBadge status={run.status} />
          {connected && isActive && (
            <span className="live-indicator">live</span>
          )}
          {isActive && (
            <button
              className="btn danger"
              onClick={handleCancel}
              disabled={cancelling}
            >
              중단
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <label>에이전트</label>
          <div>
            {run.agent ? (
              <Link href={`/agents/${run.agent.slug}`}>{run.agent.name}</Link>
            ) : (
              run.agentId
            )}
          </div>
        </div>
        <div className="card">
          <label>총 입력</label>
          <div className="mono">{run.totalInputTokens.toLocaleString()}</div>
        </div>
        <div className="card">
          <label>총 출력</label>
          <div className="mono">{run.totalOutputTokens.toLocaleString()}</div>
        </div>
        <div className="card">
          <label>총 비용</label>
          <div className="mono">{fmtCost(run.totalCostUsd)}</div>
        </div>
      </div>

      {run.error && (
        <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: '1.5rem' }}>
          <label>에러</label>
          <pre className="mono" style={{ color: 'var(--danger)' }}>
            {run.error}
          </pre>
        </div>
      )}

      <h2 style={{ marginBottom: '1rem' }}>단계</h2>
      <div className="stage-list">
        {stages.length > 0
          ? stages.map((def, i) => {
              const result = run.stageResults?.find((s) => s.stageIndex === i);
              return (
                <StageCard
                  key={def.id}
                  index={i}
                  definition={def}
                  result={result}
                  liveText={liveText[i]}
                />
              );
            })
          : run.stageResults?.map((r) => (
              <StageCard
                key={r.id}
                index={r.stageIndex}
                result={r}
                liveText={liveText[r.stageIndex]}
              />
            ))}
      </div>

      <details style={{ marginTop: '2rem' }}>
        <summary className="muted" style={{ cursor: 'pointer' }}>
          초기 입력 보기
        </summary>
        <pre className="mono" style={{ marginTop: '0.75rem', padding: '1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius)' }}>
          {JSON.stringify(run.initialInput, null, 2)}
        </pre>
      </details>
    </div>
  );
}
