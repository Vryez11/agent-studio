'use client';

import { useState } from 'react';
import type { StageDefinition, Provider } from '@agent-studio/shared';

const MODEL_OPTIONS: Record<Provider, string[]> = {
  anthropic: [
    'claude-opus-4-7',
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
  ],
  openai: ['gpt-5', 'gpt-4o', 'gpt-4o-mini'],
};

const OUTPUT_FORMATS = ['text', 'tool_use', 'json_schema'] as const;

export function StageEditor({
  stage,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  stage: StageDefinition;
  index: number;
  total: number;
  onChange: (next: StageDefinition) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [schemaText, setSchemaText] = useState(() =>
    stage.output.schema ? JSON.stringify(stage.output.schema, null, 2) : '',
  );
  const [schemaError, setSchemaError] = useState<string | null>(null);

  function patch(p: Partial<StageDefinition>) {
    onChange({ ...stage, ...p });
  }
  function patchInput(p: Partial<StageDefinition['input']>) {
    onChange({ ...stage, input: { ...stage.input, ...p } });
  }
  function patchOutput(p: Partial<StageDefinition['output']>) {
    onChange({ ...stage, output: { ...stage.output, ...p } });
  }
  function patchParams(p: Partial<StageDefinition['params']>) {
    onChange({ ...stage, params: { ...stage.params, ...p } });
  }

  function handleSchemaChange(text: string) {
    setSchemaText(text);
    if (!text.trim()) {
      setSchemaError(null);
      patchOutput({ schema: undefined });
      return;
    }
    try {
      const parsed = JSON.parse(text);
      setSchemaError(null);
      patchOutput({ schema: parsed });
    } catch (e) {
      setSchemaError(e instanceof Error ? e.message : 'invalid JSON');
    }
  }

  function handleProviderChange(provider: Provider) {
    const validModels = MODEL_OPTIONS[provider];
    const nextModel = validModels.includes(stage.model)
      ? stage.model
      : validModels[0]!;
    onChange({ ...stage, provider, model: nextModel });
  }

  return (
    <div className="card" style={{ marginBottom: '0.75rem' }}>
      <div className="row between" style={{ marginBottom: '1rem' }}>
        <div className="stage-title">
          <span className="stage-index">{index + 1}.</span>
          <input
            type="text"
            value={stage.name}
            onChange={(e) => patch({ name: e.target.value })}
            style={{ maxWidth: '300px' }}
            placeholder="단계 이름"
          />
        </div>
        <div className="row">
          <button
            className="btn"
            onClick={onMoveUp}
            disabled={index === 0}
            title="위로"
          >
            ↑
          </button>
          <button
            className="btn"
            onClick={onMoveDown}
            disabled={index === total - 1}
            title="아래로"
          >
            ↓
          </button>
          <button className="btn danger" onClick={onRemove} title="삭제">
            ×
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label>ID (kebab-case, 다른 단계에서 참조)</label>
          <input
            type="text"
            value={stage.id}
            onChange={(e) => patch({ id: e.target.value })}
            placeholder="generate"
            pattern="[a-z0-9-]+"
          />
        </div>
        <div>
          <label>Provider</label>
          <select
            value={stage.provider}
            onChange={(e) => handleProviderChange(e.target.value as Provider)}
          >
            <option value="anthropic">anthropic</option>
            <option value="openai">openai</option>
          </select>
        </div>
        <div>
          <label>Model</label>
          <input
            type="text"
            list={`models-${stage.id}`}
            value={stage.model}
            onChange={(e) => patch({ model: e.target.value })}
          />
          <datalist id={`models-${stage.id}`}>
            {MODEL_OPTIONS[stage.provider].map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div>
          <label>onError</label>
          <select
            value={stage.onError}
            onChange={(e) =>
              patch({ onError: e.target.value as StageDefinition['onError'] })
            }
          >
            <option value="abort">abort (즉시 Run 실패)</option>
            <option value="continue">continue (다음 단계 진행)</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>System Prompt</label>
        <textarea
          rows={5}
          value={stage.systemPrompt}
          onChange={(e) => patch({ systemPrompt: e.target.value })}
        />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>
          User Message Template{' '}
          <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>
            (변수: <code className="mono">{`{{run.input.X}}`}</code>,{' '}
            <code className="mono">{`{{stages.<id>.output.text}}`}</code>,{' '}
            <code className="mono">{`{{stages.<id>.output.json.X}}`}</code>)
          </span>
        </label>
        <textarea
          rows={6}
          value={stage.input.userMessageTemplate}
          onChange={(e) => patchInput({ userMessageTemplate: e.target.value })}
        />
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}
      >
        <div>
          <label>출력 포맷</label>
          <select
            value={stage.output.format}
            onChange={(e) =>
              patchOutput({
                format: e.target.value as StageDefinition['output']['format'],
              })
            }
          >
            {OUTPUT_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Max Tokens</label>
          <input
            type="number"
            min={1}
            value={stage.params.maxTokens}
            onChange={(e) =>
              patchParams({ maxTokens: Number(e.target.value) })
            }
          />
        </div>
        <div>
          <label>Temperature</label>
          <input
            type="number"
            step={0.1}
            min={0}
            max={2}
            value={stage.params.temperature}
            onChange={(e) =>
              patchParams({ temperature: Number(e.target.value) })
            }
          />
        </div>
      </div>

      {stage.output.format !== 'text' && (
        <>
          <div style={{ marginTop: '1rem' }}>
            <label>Tool / Schema Name</label>
            <input
              type="text"
              value={stage.output.toolName ?? ''}
              onChange={(e) => patchOutput({ toolName: e.target.value })}
              placeholder="submit_result"
            />
          </div>
          <div style={{ marginTop: '1rem' }}>
            <label>
              JSON Schema{' '}
              {schemaError && (
                <span className="badge failed" style={{ marginLeft: '0.5rem' }}>
                  {schemaError}
                </span>
              )}
            </label>
            <textarea
              rows={10}
              value={schemaText}
              onChange={(e) => handleSchemaChange(e.target.value)}
              placeholder={`{\n  "type": "object",\n  "properties": { ... },\n  "required": [...]\n}`}
            />
          </div>
        </>
      )}

      <div className="row" style={{ marginTop: '1rem' }}>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: 0,
            textTransform: 'none',
            letterSpacing: 0,
          }}
        >
          <input
            type="checkbox"
            checked={stage.cache?.system ?? false}
            onChange={(e) =>
              patch({ cache: { system: e.target.checked } })
            }
            style={{ width: 'auto' }}
          />
          systemPrompt에 cache_control 적용 (Anthropic 한정)
        </label>
      </div>
    </div>
  );
}
