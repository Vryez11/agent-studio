'use client';

import { useState } from 'react';

export function JsonView({
  value,
  level = 0,
}: {
  value: unknown;
  level?: number;
}) {
  return (
    <div className="json-view">
      <JsonNode value={value} level={level} />
    </div>
  );
}

function JsonNode({ value, level }: { value: unknown; level: number }) {
  if (value === null) return <span className="json-null">null</span>;
  if (value === undefined) return <span className="json-null">undefined</span>;
  if (typeof value === 'boolean')
    return <span className="json-bool">{String(value)}</span>;
  if (typeof value === 'number')
    return <span className="json-number">{value}</span>;
  if (typeof value === 'string') return <JsonString value={value} />;
  if (Array.isArray(value)) return <JsonArray value={value} level={level} />;
  if (typeof value === 'object')
    return (
      <JsonObject value={value as Record<string, unknown>} level={level} />
    );
  return <span>{String(value)}</span>;
}

function JsonString({ value }: { value: string }) {
  // 줄바꿈이 포함된 긴 문자열은 별도 처리
  const isMultiline = value.includes('\n') || value.length > 80;
  if (isMultiline) {
    return (
      <span className="json-string-multi">
        <span className="json-string-quote">&quot;</span>
        <span className="json-string-content">{value}</span>
        <span className="json-string-quote">&quot;</span>
      </span>
    );
  }
  return (
    <span className="json-string">
      &quot;
      {value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}
      &quot;
    </span>
  );
}

function JsonArray({ value, level }: { value: unknown[]; level: number }) {
  const [open, setOpen] = useState(true);

  if (value.length === 0) {
    return <span className="json-bracket">[]</span>;
  }

  return (
    <span>
      <span
        className="json-toggle"
        onClick={() => setOpen(!open)}
        role="button"
      >
        <span className="json-caret">{open ? '▾' : '▸'}</span>
        <span className="json-bracket">[</span>
      </span>
      {open ? (
        <>
          {value.map((v, i) => (
            <div
              key={i}
              className="json-line"
              style={{ paddingLeft: `${(level + 1) * 16}px` }}
            >
              <span className="json-index">{i}:</span>{' '}
              <JsonNode value={v} level={level + 1} />
              {i < value.length - 1 && <span className="json-comma">,</span>}
            </div>
          ))}
          <div style={{ paddingLeft: `${level * 16}px` }}>
            <span className="json-bracket">]</span>
          </div>
        </>
      ) : (
        <>
          <span className="json-summary"> {value.length} items </span>
          <span className="json-bracket">]</span>
        </>
      )}
    </span>
  );
}

function JsonObject({
  value,
  level,
}: {
  value: Record<string, unknown>;
  level: number;
}) {
  const [open, setOpen] = useState(true);
  const entries = Object.entries(value);

  if (entries.length === 0) {
    return <span className="json-bracket">{'{}'}</span>;
  }

  return (
    <span>
      <span
        className="json-toggle"
        onClick={() => setOpen(!open)}
        role="button"
      >
        <span className="json-caret">{open ? '▾' : '▸'}</span>
        <span className="json-bracket">{'{'}</span>
      </span>
      {open ? (
        <>
          {entries.map(([k, v], i) => (
            <div
              key={k}
              className="json-line"
              style={{ paddingLeft: `${(level + 1) * 16}px` }}
            >
              <span className="json-key">&quot;{k}&quot;</span>
              <span className="json-colon">: </span>
              <JsonNode value={v} level={level + 1} />
              {i < entries.length - 1 && <span className="json-comma">,</span>}
            </div>
          ))}
          <div style={{ paddingLeft: `${level * 16}px` }}>
            <span className="json-bracket">{'}'}</span>
          </div>
        </>
      ) : (
        <>
          <span className="json-summary"> {entries.length} keys </span>
          <span className="json-bracket">{'}'}</span>
        </>
      )}
    </span>
  );
}
