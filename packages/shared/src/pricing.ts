import type { Usage } from './index.js';

/**
 * 모델 가격표 (USD per 1M tokens).
 * 모델이 표에 없으면 input/output만 사용 후 cache 항목은 무료로 가정 → 비용은 보수적으로 약간 낮게 잡힐 수 있음.
 * 정확한 단가는 공식 가격 페이지를 주기적으로 갱신할 것.
 */
export type ModelPricing = {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number; // ephemeral 5분 캐시 기준
};

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ─── Anthropic ───────────────────────────────────────────
  'claude-opus-4-7':    { input: 5,    output: 25,  cacheRead: 0.5,  cacheWrite: 6.25 },
  'claude-opus-4-6':    { input: 5,    output: 25,  cacheRead: 0.5,  cacheWrite: 6.25 },
  'claude-sonnet-4-6':  { input: 3,    output: 15,  cacheRead: 0.3,  cacheWrite: 3.75 },
  'claude-haiku-4-5':   { input: 1,    output: 5,   cacheRead: 0.1,  cacheWrite: 1.25 },

  // ─── OpenAI (대략적인 추정 단가 — 실제는 변경 시 갱신 필요) ───────
  'gpt-5':              { input: 10,   output: 30,  cacheRead: 1 },
  'gpt-4o':             { input: 2.5,  output: 10,  cacheRead: 1.25 },
  'gpt-4o-mini':        { input: 0.15, output: 0.6, cacheRead: 0.075 },
};

export function lookupPricing(model: string): ModelPricing | undefined {
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  // prefix 매칭 (예: claude-opus-4-7-20260301 같은 변형)
  for (const key of Object.keys(MODEL_PRICING)) {
    if (model.startsWith(key)) return MODEL_PRICING[key];
  }
  return undefined;
}

/**
 * usage → USD 비용. 1M 토큰당 단가를 기준으로 계산.
 * cacheRead 토큰은 일반 input보다 저렴, cacheWrite(=cacheCreation)는 더 비쌈.
 */
export function calculateCost(model: string, usage: Usage): number {
  const p = lookupPricing(model);
  if (!p) return 0;
  const M = 1_000_000;
  const inputCost = (usage.inputTokens / M) * p.input;
  const outputCost = (usage.outputTokens / M) * p.output;
  const cacheReadCost = ((p.cacheRead ?? 0) * usage.cacheReadTokens) / M;
  const cacheWriteCost = ((p.cacheWrite ?? 0) * usage.cacheCreationTokens) / M;
  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}
