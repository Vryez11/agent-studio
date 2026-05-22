import { z } from 'zod';

// ──────────────────────────────────────────────────────────────────────
// Provider / Stage type
// ──────────────────────────────────────────────────────────────────────

export const ProviderEnum = z.enum(['anthropic', 'openai']);
export type Provider = z.infer<typeof ProviderEnum>;

export const StageTypeEnum = z.enum(['llm', 'tool', 'http']);
export type StageType = z.infer<typeof StageTypeEnum>;

// ──────────────────────────────────────────────────────────────────────
// Stage Definition (저장 형태: agent_versions.stages JSON 배열)
// ──────────────────────────────────────────────────────────────────────

export const StageInputSchema = z.object({
  /**
   * 사용자 메시지 템플릿. `{{run.input.<path>}}`, `{{stages.<id>.output.text}}`,
   * `{{stages.<id>.output.json.<path>}}` 형식으로 이전 단계 결과 참조 가능.
   */
  userMessageTemplate: z.string(),
  refs: z.array(z.string()).default([]),
});

export const StageOutputSchema = z.object({
  format: z.enum(['text', 'tool_use', 'json_schema']),
  toolName: z.string().optional(),
  /** JSON Schema (tool_use 또는 json_schema 모드에서 사용) */
  schema: z.record(z.any()).optional(),
});

export const StageParamsSchema = z.object({
  maxTokens: z.number().int().positive().default(4096),
  temperature: z.number().min(0).max(2).default(0.7),
  topP: z.number().min(0).max(1).optional(),
});

export const StageCacheSchema = z.object({
  /** Anthropic 한정: systemPrompt에 cache_control 적용 */
  system: z.boolean().default(false),
});

export const StageDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: StageTypeEnum.default('llm'),
  provider: ProviderEnum,
  model: z.string().min(1),
  systemPrompt: z.string(),
  input: StageInputSchema,
  output: StageOutputSchema,
  params: StageParamsSchema.default({}),
  cache: StageCacheSchema.optional(),
  onError: z.enum(['abort', 'continue']).default('abort'),
});

export type StageDefinition = z.infer<typeof StageDefinitionSchema>;

export const AgentDefinitionSchema = z.object({
  stages: z.array(StageDefinitionSchema).min(1),
  contextSchema: z.record(z.any()).optional(),
});

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

// ──────────────────────────────────────────────────────────────────────
// Run / StageResult 상태
// ──────────────────────────────────────────────────────────────────────

export const RunStatusEnum = z.enum([
  'pending',
  'running',
  'completed',
  'cancelled',
  'failed',
]);
export type RunStatus = z.infer<typeof RunStatusEnum>;

export const StageStatusEnum = z.enum([
  'pending',
  'running',
  'completed',
  'cancelled',
  'failed',
  'skipped',
]);
export type StageStatus = z.infer<typeof StageStatusEnum>;

// ──────────────────────────────────────────────────────────────────────
// Usage / Cost
// ──────────────────────────────────────────────────────────────────────

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
};

export const ZERO_USAGE: Usage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
};

// ──────────────────────────────────────────────────────────────────────
// Normalized streaming events (provider 무관 공통 이벤트)
// ──────────────────────────────────────────────────────────────────────

export type NormalizedEvent =
  | { type: 'run_started'; runId: string }
  | { type: 'stage_started'; stageId: string; stageIndex: number }
  | { type: 'text_delta'; stageId: string; text: string }
  | { type: 'tool_use_delta'; stageId: string; partialJson: string }
  | {
      type: 'stage_completed';
      stageId: string;
      stageIndex: number;
      usage: Usage;
      outputText: string;
      outputStructured?: unknown;
    }
  | { type: 'stage_failed'; stageId: string; error: string }
  | { type: 'run_completed'; runId: string }
  | { type: 'run_cancelled'; runId: string }
  | { type: 'run_failed'; runId: string; error: string };

// ──────────────────────────────────────────────────────────────────────
// API 요청/응답 스키마
// ──────────────────────────────────────────────────────────────────────

export const CreateAgentBodySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  description: z.string().optional(),
  definition: AgentDefinitionSchema,
});

export const UpdateAgentBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  definition: AgentDefinitionSchema,
});

export const StartRunBodySchema = z.object({
  agentSlug: z.string(),
  input: z.record(z.any()),
});

export type CreateAgentBody = z.infer<typeof CreateAgentBodySchema>;
export type UpdateAgentBody = z.infer<typeof UpdateAgentBodySchema>;
export type StartRunBody = z.infer<typeof StartRunBodySchema>;
