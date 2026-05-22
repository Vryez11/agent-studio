'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, type ApiAgent } from '@/lib/api';
import { AgentForm, type AgentFormInitial } from '@/components/AgentForm';

export default function EditAgentPage() {
  const params = useParams<{ slug: string }>();
  const [agent, setAgent] = useState<ApiAgent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAgent(params.slug)
      .then(setAgent)
      .catch((e) => setError(String(e)));
  }, [params.slug]);

  if (error) return <p className="muted">불러올 수 없습니다: {error}</p>;
  if (!agent) return <p className="muted">로딩 중…</p>;
  if (!agent.currentVersion) {
    return (
      <p className="muted">
        이 에이전트는 currentVersion이 없어 편집할 수 없습니다.
      </p>
    );
  }

  const initial: AgentFormInitial = {
    mode: 'edit',
    slug: agent.slug,
    name: agent.name,
    description: agent.description ?? '',
    definition: {
      stages: agent.currentVersion.stages,
      contextSchema: agent.currentVersion.contextSchema as
        | Record<string, unknown>
        | undefined,
    },
  };

  return (
    <div>
      <div className="row" style={{ marginBottom: '0.5rem' }}>
        <Link href={`/agents/${agent.slug}`} className="muted">
          ← {agent.name}
        </Link>
      </div>
      <h1 className="page-title">
        {agent.name} 편집
        <small>저장 시 v{agent.currentVersion.version + 1} 발행</small>
      </h1>
      <AgentForm initial={initial} />
    </div>
  );
}
