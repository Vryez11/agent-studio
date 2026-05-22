'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type ApiAgent } from '@/lib/api';

const DEFAULT_INPUT_JSON = `{
  "domain": "AI 기반 학습 도구",
  "constraints": "개인 개발자 1인이 만들 수 있을 것"
}`;

export default function AgentDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<ApiAgent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState(DEFAULT_INPUT_JSON);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAgent(params.slug)
      .then(setAgent)
      .catch((e) => setError(String(e)));
  }, [params.slug]);

  async function startRun() {
    setStarting(true);
    setStartError(null);
    try {
      const input = JSON.parse(inputText);
      const { runId } = await api.startRun(params.slug, input);
      router.push(`/runs/${runId}`);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  }

  async function handleDelete() {
    if (!agent) return;
    const ok = window.confirm(
      `정말 '${agent.name}' 에이전트를 삭제하시겠습니까?\n\n` +
        `이 에이전트의 모든 버전과 실행 히스토리(Runs, 단계 결과 포함)가 함께 삭제됩니다.\n` +
        `되돌릴 수 없습니다.`,
    );
    if (!ok) return;
    try {
      await api.deleteAgent(agent.slug);
      router.push('/agents');
    } catch (e) {
      alert(`삭제 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (error) return <p className="muted">에이전트를 불러올 수 없습니다: {error}</p>;
  if (!agent) return <p className="muted">로딩 중…</p>;

  return (
    <div>
      <div className="row" style={{ marginBottom: '0.5rem' }}>
        <Link href="/agents" className="muted">
          ← Agents
        </Link>
      </div>
      <div className="row between" style={{ marginBottom: '0.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>
          {agent.name}
          <small>
            {agent.slug}
            {agent.currentVersion && ` · v${agent.currentVersion.version}`}
          </small>
        </h1>
        <div className="row">
          <Link href={`/agents/${agent.slug}/edit`} className="btn">
            편집
          </Link>
          <button className="btn danger" onClick={handleDelete}>
            삭제
          </button>
        </div>
      </div>

      {agent.description && (
        <p className="muted" style={{ marginBottom: '2rem' }}>
          {agent.description}
        </p>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <section>
          <h2 style={{ marginBottom: '1rem' }}>단계 구성</h2>
          <div className="stage-list">
            {agent.currentVersion?.stages.map((s, i) => (
              <div key={s.id} className="stage-card">
                <div className="stage-header">
                  <div className="stage-title">
                    <span className="stage-index">{i + 1}.</span>
                    {s.name}
                  </div>
                  <span className="muted mono" style={{ fontSize: '0.75rem' }}>
                    {s.provider} / {s.model}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: '0.8125rem' }}>
                  {s.systemPrompt.slice(0, 120)}
                  {s.systemPrompt.length > 120 && '…'}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 style={{ marginBottom: '1rem' }}>새 Run 시작</h2>
          <div className="card">
            <label htmlFor="input-json">초기 입력 (JSON)</label>
            <textarea
              id="input-json"
              rows={10}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            {startError && (
              <p className="badge failed" style={{ marginTop: '0.75rem' }}>
                {startError}
              </p>
            )}
            <div className="row" style={{ marginTop: '1rem' }}>
              <button
                className="btn primary"
                onClick={startRun}
                disabled={starting}
              >
                {starting ? '시작 중…' : 'Run 시작'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
