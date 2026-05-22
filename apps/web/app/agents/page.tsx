'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type ApiAgent } from '@/lib/api';

export default function AgentsPage() {
  const [agents, setAgents] = useState<ApiAgent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listAgents()
      .then(setAgents)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="muted">에이전트 목록을 불러올 수 없습니다: {error}</p>;
  if (!agents) return <p className="muted">로딩 중…</p>;

  return (
    <div>
      <h1 className="page-title">
        Agents <small>{agents.length}개</small>
      </h1>

      {agents.length === 0 ? (
        <div className="card">
          <p className="muted">
            정의된 에이전트가 없습니다. 시드 스크립트로 ideation 에이전트를 만들어보세요:
          </p>
          <pre className="mono" style={{ marginTop: '0.75rem' }}>
            pnpm --filter @agent-studio/api seed:ideation
          </pre>
        </div>
      ) : (
        <div className="grid grid-cols-3">
          {agents.map((a) => (
            <Link
              key={a.id}
              href={`/agents/${a.slug}`}
              className="card"
              style={{ display: 'block' }}
            >
              <div className="row between" style={{ marginBottom: '0.5rem' }}>
                <strong>{a.name}</strong>
                {a.currentVersion && (
                  <span className="muted mono">v{a.currentVersion.version}</span>
                )}
              </div>
              <div className="muted mono" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                {a.slug}
              </div>
              {a.description && (
                <p className="muted" style={{ fontSize: '0.875rem' }}>
                  {a.description}
                </p>
              )}
              {a.currentVersion && (
                <div className="dim" style={{ fontSize: '0.75rem', marginTop: '0.75rem' }}>
                  {a.currentVersion.stages.length}개 단계
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
