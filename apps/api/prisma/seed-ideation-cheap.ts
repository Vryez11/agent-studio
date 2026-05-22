/**
 * 비용 절감용 ideation 변형 — 전 단계를 Haiku로 실행.
 * 1 Run당 ~$0.01 수준. 무료 크레딧으로 수백 회 테스트 가능.
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { AgentDefinitionSchema } from '@agent-studio/shared';

const prisma = new PrismaClient();

const MODEL = 'claude-haiku-4-5';

const definition = AgentDefinitionSchema.parse({
  contextSchema: {
    type: 'object',
    properties: {
      domain: { type: 'string' },
      constraints: { type: 'string' },
    },
    required: ['domain'],
  },
  stages: [
    {
      id: 'generate',
      name: '주제 생성',
      type: 'llm',
      provider: 'anthropic',
      model: MODEL,
      systemPrompt:
        '당신은 창의적이고 실용적인 아이디어 생성가입니다. 주어진 도메인과 제약 하에서 서로 다른 관점의 주제 3개를 생성합니다.',
      input: {
        userMessageTemplate:
          '도메인: {{run.input.domain}}\n제약: {{run.input.constraints}}\n\n위 조건에 맞는 주제 3개를 생성하세요.',
        refs: [],
      },
      output: {
        format: 'tool_use',
        toolName: 'submit_topics',
        schema: {
          type: 'object',
          properties: {
            topics: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  summary: { type: 'string' },
                },
                required: ['title', 'summary'],
              },
            },
          },
          required: ['topics'],
        },
      },
      params: { maxTokens: 2048, temperature: 0.9 },
      cache: { system: true },
      onError: 'abort',
    },
    {
      id: 'validate',
      name: '검증',
      type: 'llm',
      provider: 'anthropic',
      model: MODEL,
      systemPrompt:
        '당신은 냉정한 비즈니스 검증가입니다. 각 주제에 대해 시장성과 실현성을 1-5점 평가합니다.',
      input: {
        userMessageTemplate:
          '주제:\n{{stages.generate.output.json.topics}}\n\n각 주제를 평가하세요.',
        refs: ['generate'],
      },
      output: {
        format: 'tool_use',
        toolName: 'submit_validation',
        schema: {
          type: 'object',
          properties: {
            assessments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  marketScore: { type: 'integer' },
                  feasibilityScore: { type: 'integer' },
                  rationale: { type: 'string' },
                },
                required: ['title', 'marketScore', 'feasibilityScore', 'rationale'],
              },
            },
          },
          required: ['assessments'],
        },
      },
      params: { maxTokens: 2048, temperature: 0.3 },
      cache: { system: true },
      onError: 'abort',
    },
    {
      id: 'critique',
      name: '비판',
      type: 'llm',
      provider: 'anthropic',
      model: MODEL,
      systemPrompt:
        '당신은 날카로운 비판가입니다. 각 주제의 약점과 가장 큰 리스크를 짧고 분명하게 지적합니다.',
      input: {
        userMessageTemplate:
          '주제:\n{{stages.generate.output.json.topics}}\n\n검증:\n{{stages.validate.output.json.assessments}}\n\n각 주제의 약점과 리스크를 제시하세요.',
        refs: ['generate', 'validate'],
      },
      output: {
        format: 'tool_use',
        toolName: 'submit_critique',
        schema: {
          type: 'object',
          properties: {
            critiques: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  weaknesses: { type: 'array', items: { type: 'string' } },
                  biggestRisk: { type: 'string' },
                },
                required: ['title', 'weaknesses', 'biggestRisk'],
              },
            },
          },
          required: ['critiques'],
        },
      },
      params: { maxTokens: 2048, temperature: 0.7 },
      cache: { system: true },
      onError: 'abort',
    },
  ],
});

async function main() {
  const slug = 'ideation-cheap';
  const existing = await prisma.agent.findUnique({ where: { slug } });

  if (existing) {
    const latest = await prisma.agentVersion.findFirst({
      where: { agentId: existing.id },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version ?? 0) + 1;
    const newVersion = await prisma.agentVersion.create({
      data: {
        agentId: existing.id,
        version: nextVersion,
        stages: definition.stages as unknown as Prisma.InputJsonValue,
        contextSchema:
          (definition.contextSchema as Prisma.InputJsonValue | undefined) ??
          Prisma.JsonNull,
      },
    });
    await prisma.agent.update({
      where: { id: existing.id },
      data: { currentVersionId: newVersion.id },
    });
    console.log(`Updated '${slug}' to v${nextVersion}`);
  } else {
    const agent = await prisma.agent.create({
      data: {
        slug,
        name: 'Ideation (Haiku)',
        description: '저비용 테스트용 — 전 단계 Haiku 4.5 사용. 1 Run ~$0.01.',
      },
    });
    const version = await prisma.agentVersion.create({
      data: {
        agentId: agent.id,
        version: 1,
        stages: definition.stages as unknown as Prisma.InputJsonValue,
        contextSchema:
          (definition.contextSchema as Prisma.InputJsonValue | undefined) ??
          Prisma.JsonNull,
      },
    });
    await prisma.agent.update({
      where: { id: agent.id },
      data: { currentVersionId: version.id },
    });
    console.log(`Created '${slug}' v1`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
