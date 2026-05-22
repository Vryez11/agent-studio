'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  AgentDefinitionSchema,
  type StageDefinition,
  type AgentDefinition,
} from '@agent-studio/shared';
import { api } from '@/lib/api';
import { StageEditor } from './StageEditor';

export type AgentFormInitial = {
  mode: 'create' | 'edit';
  slug: string;
  name: string;
  description: string;
  definition: AgentDefinition;
};

function makeBlankStage(index: number): StageDefinition {
  return {
    id: `stage-${index + 1}`,
    name: `단계 ${index + 1}`,
    type: 'llm',
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    systemPrompt: '',
    input: {
      userMessageTemplate: '',
      refs: [],
    },
    output: { format: 'text' },
    params: { maxTokens: 4096, temperature: 0.7 },
    onError: 'abort',
  };
}

export const BLANK_AGENT: AgentFormInitial = {
  mode: 'create',
  slug: '',
  name: '',
  description: '',
  definition: {
    stages: [makeBlankStage(0)],
  },
};

export function AgentForm({ initial }: { initial: AgentFormInitial }) {
  const router = useRouter();
  const [slug, setSlug] = useState(initial.slug);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [stages, setStages] = useState<StageDefinition[]>(
    initial.definition.stages,
  );
  const [contextSchemaText, setContextSchemaText] = useState(() =>
    initial.definition.contextSchema
      ? JSON.stringify(initial.definition.contextSchema, null, 2)
      : '',
  );
  const [contextSchemaError, setContextSchemaError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isEdit = initial.mode === 'edit';

  function updateStage(i: number, next: StageDefinition) {
    setStages((prev) => prev.map((s, idx) => (idx === i ? next : s)));
  }
  function removeStage(i: number) {
    if (stages.length <= 1) return;
    setStages((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addStage() {
    setStages((prev) => [...prev, makeBlankStage(prev.length)]);
  }
  function moveStage(i: number, dir: -1 | 1) {
    setStages((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }

  function handleContextSchemaChange(text: string) {
    setContextSchemaText(text);
    if (!text.trim()) {
      setContextSchemaError(null);
      return;
    }
    try {
      JSON.parse(text);
      setContextSchemaError(null);
    } catch (e) {
      setContextSchemaError(e instanceof Error ? e.message : 'invalid JSON');
    }
  }

  async function handleSave() {
    setSaveError(null);

    if (!isEdit && !/^[a-z0-9-]+$/.test(slug)) {
      setSaveError('slug은 소문자, 숫자, 하이픈만 사용 가능합니다');
      return;
    }
    if (!name.trim()) {
      setSaveError('이름을 입력하세요');
      return;
    }
    if (contextSchemaError) {
      setSaveError(`contextSchema JSON 오류: ${contextSchemaError}`);
      return;
    }

    let contextSchema: unknown;
    if (contextSchemaText.trim()) {
      try {
        contextSchema = JSON.parse(contextSchemaText);
      } catch {
        setSaveError('contextSchema JSON 파싱 실패');
        return;
      }
    }

    const definition = { stages, contextSchema };
    const parsed = AgentDefinitionSchema.safeParse(definition);
    if (!parsed.success) {
      setSaveError(
        `정의 검증 실패: ${parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .slice(0, 3)
          .join(' | ')}`,
      );
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await api.updateAgent(initial.slug, {
          name,
          description: description || undefined,
          definition: parsed.data,
        });
        router.push(`/agents/${initial.slug}`);
      } else {
        await api.createAgent({
          slug,
          name,
          description: description || undefined,
          definition: parsed.data,
        });
        router.push(`/agents/${slug}`);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <div>
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>에이전트 정보</h2>
        <div className="card card-row">
          <div className="grid" style={{ gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
            <div>
              <label>Slug</label>
              <input
                type="text"
                value={slug}
                disabled={isEdit}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="ideation"
              />
            </div>
            <div>
              <label>이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ideation Agent"
              />
            </div>
          </div>
          <div>
            <label>설명</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 에이전트가 무엇을 하는지"
            />
          </div>
          <div>
            <label>
              Context Schema (JSON Schema, 선택)
              {contextSchemaError && (
                <span className="badge failed" style={{ marginLeft: '0.5rem' }}>
                  {contextSchemaError}
                </span>
              )}
            </label>
            <textarea
              rows={6}
              value={contextSchemaText}
              onChange={(e) => handleContextSchemaChange(e.target.value)}
              placeholder={`{\n  "type": "object",\n  "properties": {\n    "domain": { "type": "string" }\n  },\n  "required": ["domain"]\n}`}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="row between" style={{ marginBottom: '1rem' }}>
          <h2>단계 ({stages.length})</h2>
          <button className="btn" onClick={addStage}>
            + 단계 추가
          </button>
        </div>
        {stages.map((s, i) => (
          <StageEditor
            key={i}
            stage={s}
            index={i}
            total={stages.length}
            onChange={(next) => updateStage(i, next)}
            onRemove={() => removeStage(i)}
            onMoveUp={() => moveStage(i, -1)}
            onMoveDown={() => moveStage(i, 1)}
          />
        ))}
      </section>

      <div className="row" style={{ marginTop: '2rem', gap: '0.75rem' }}>
        <button
          className="btn primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '저장 중…' : isEdit ? '새 버전 발행' : '에이전트 생성'}
        </button>
        <button
          className="btn"
          onClick={() =>
            router.push(isEdit ? `/agents/${initial.slug}` : '/agents')
          }
        >
          취소
        </button>
        {saveError && (
          <span className="badge failed" style={{ marginLeft: 'auto' }}>
            {saveError}
          </span>
        )}
      </div>
    </div>
  );
}
