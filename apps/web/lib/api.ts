import type {
  RunStatus,
  StageStatus,
  StageDefinition,
  AgentDefinition,
} from '@agent-studio/shared';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    throw new Error(
      `API ${res.status} ${res.statusText}: ${JSON.stringify(body)}`,
    );
  }
  return res.json() as Promise<T>;
}

// ────── Types (API response shape) ──────

export type ApiAgent = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  currentVersionId: string | null;
  currentVersion: ApiAgentVersion | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiAgentVersion = {
  id: string;
  agentId: string;
  version: number;
  stages: StageDefinition[];
  contextSchema: unknown;
  createdAt: string;
};

export type ApiStageResult = {
  id: string;
  runId: string;
  stageId: string;
  stageIndex: number;
  status: StageStatus;
  model: string | null;
  provider: string | null;
  outputText: string | null;
  outputStructured: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  costUsd: string | null;
  stopReason: string | null;
  error: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
};

export type ApiRun = {
  id: string;
  agentId: string;
  agentVersionId: string;
  status: RunStatus;
  initialInput: Record<string, unknown>;
  currentStageIndex: number | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCostUsd: string;
  error: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  stageResults?: ApiStageResult[];
  agent?: { slug: string; name: string };
  agentVersion?: ApiAgentVersion;
};

// ────── Endpoints ──────

export const api = {
  listAgents: () => request<ApiAgent[]>('/agents'),
  getAgent: (slug: string) => request<ApiAgent>(`/agents/${slug}`),
  listRuns: (limit = 50) => request<ApiRun[]>(`/runs?limit=${limit}`),
  getRun: (id: string) => request<ApiRun>(`/runs/${id}`),
  startRun: (agentSlug: string, input: Record<string, unknown>) =>
    request<{ runId: string; status: RunStatus }>('/runs', {
      method: 'POST',
      body: JSON.stringify({ agentSlug, input }),
    }),
  cancelRun: (id: string) =>
    request<{ ok: boolean }>(`/runs/${id}/cancel`, { method: 'POST' }),
  createAgent: (body: {
    slug: string;
    name: string;
    description?: string;
    definition: AgentDefinition;
  }) =>
    request<ApiAgent>('/agents', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateAgent: (
    slug: string,
    body: { name?: string; description?: string; definition: AgentDefinition },
  ) =>
    request<ApiAgent>(`/agents/${slug}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export const API_BASE_URL = API_BASE;
