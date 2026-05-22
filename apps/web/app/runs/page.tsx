'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type ApiRun } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString();
}

function fmtCost(usd: string | number) {
  const n = typeof usd === 'string' ? Number(usd) : usd;
  return `$${n.toFixed(4)}`;
}

export default function RunsPage() {
  const [runs, setRuns] = useState<ApiRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listRuns()
      .then(setRuns)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="muted">Runs을 불러올 수 없습니다: {error}</p>;
  if (!runs) return <p className="muted">로딩 중…</p>;

  return (
    <div>
      <h1 className="page-title">
        Runs <small>최근 {runs.length}개</small>
      </h1>

      {runs.length === 0 ? (
        <p className="muted">
          아직 실행된 Run이 없습니다. <Link href="/agents">에이전트</Link>에서 새 Run을 시작하세요.
        </p>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>상태</th>
                <th>에이전트</th>
                <th>생성</th>
                <th>완료</th>
                <th style={{ textAlign: 'right' }}>입력</th>
                <th style={{ textAlign: 'right' }}>출력</th>
                <th style={{ textAlign: 'right' }}>비용</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>{r.agent?.name ?? r.agentId}</td>
                  <td className="muted">{fmtDate(r.createdAt)}</td>
                  <td className="muted">{fmtDate(r.endedAt)}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {r.totalInputTokens.toLocaleString()}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {r.totalOutputTokens.toLocaleString()}
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {fmtCost(r.totalCostUsd)}
                  </td>
                  <td>
                    <Link href={`/runs/${r.id}`}>열기</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
