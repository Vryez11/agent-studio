/**
 * 단순 mustache 스타일 템플릿 리졸버.
 * 지원 패턴:
 *   - {{run.input.<path>}}        → run.initialInput 의 nested key
 *   - {{stages.<id>.output.text}} → 해당 단계의 outputText
 *   - {{stages.<id>.output.json}} → 해당 단계의 outputStructured 전체 (JSON 직렬화)
 *   - {{stages.<id>.output.json.<path>}} → outputStructured 내부 nested key
 */

export type StageRefSource = {
  outputText: string | null;
  outputStructured: unknown;
};

export type ResolveContext = {
  runInput: Record<string, unknown>;
  stages: Record<string, StageRefSource>;
};

const TOKEN_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

export function resolveTemplate(template: string, ctx: ResolveContext): string {
  return template.replace(TOKEN_RE, (_match, expr: string) => {
    const value = resolveExpr(expr, ctx);
    if (value === undefined || value === null) return '';
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  });
}

function resolveExpr(expr: string, ctx: ResolveContext): unknown {
  const parts = expr.split('.');
  if (parts.length === 0) return undefined;

  if (parts[0] === 'run' && parts[1] === 'input') {
    return getPath(ctx.runInput, parts.slice(2));
  }

  if (parts[0] === 'stages' && parts.length >= 4 && parts[2] === 'output') {
    const stageId = parts[1]!;
    const stage = ctx.stages[stageId];
    if (!stage) return undefined;
    const field = parts[3];
    if (field === 'text') return stage.outputText ?? '';
    if (field === 'json') {
      return getPath(stage.outputStructured, parts.slice(4));
    }
  }

  return undefined;
}

function getPath(obj: unknown, path: string[]): unknown {
  if (path.length === 0) return obj;
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}
