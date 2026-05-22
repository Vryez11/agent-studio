'use client';

import Link from 'next/link';
import { AgentForm, BLANK_AGENT } from '@/components/AgentForm';

export default function NewAgentPage() {
  return (
    <div>
      <div className="row" style={{ marginBottom: '0.5rem' }}>
        <Link href="/agents" className="muted">
          ← Agents
        </Link>
      </div>
      <h1 className="page-title">새 에이전트</h1>
      <AgentForm initial={BLANK_AGENT} />
    </div>
  );
}
