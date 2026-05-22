import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { AgentDefinitionSchema } from '@agent-studio/shared';

const prisma = new PrismaClient();

const definition = AgentDefinitionSchema.parse({
  contextSchema: {
    type: 'object',
    properties: {
      domain: { type: 'string', description: '아이디어를 낼 도메인' },
      constraints: { type: 'string', description: '제약사항' },
    },
    required: ['domain'],
  },
  stages: [
    {
      id: 'generate',
      name: '주제 생성',
      type: 'llm',
      provider: 'anthropic',
      model: 'claude-opus-4-7',
      systemPrompt: [
        '당신은 창의적이고 실용적인 아이디어 생성가입니다.',
        '주어진 도메인과 제약 하에서 서로 다른 관점의 주제 5개를 생성합니다.',
        '각 주제는 단순한 카피가 아니라 실제 실행 가능한 컨셉이어야 합니다.',
      ].join('\n'),
      input: {
        userMessageTemplate: [
          '도메인: {{run.input.domain}}',
          '제약: {{run.input.constraints}}',
          '',
          '위 조건에 맞는 주제 5개를 생성하세요.',
        ].join('\n'),
        refs: [],
      },
      output: {
        format: 'tool_use',
        toolName: 'submit_topics',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            topics: {
              type: 'array',
              minItems: 5,
              maxItems: 5,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  title: { type: 'string' },
                  summary: { type: 'string' },
                  targetUser: { type: 'string' },
                },
                required: ['title', 'summary', 'targetUser'],
              },
            },
          },
          required: ['topics'],
        },
      },
      params: { maxTokens: 4096, temperature: 0.9 },
      cache: { system: true },
      onError: 'abort',
    },
    {
      id: 'validate',
      name: '검증',
      type: 'llm',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      systemPrompt: [
        '당신은 냉정한 비즈니스/실현성 검증가입니다.',
        '각 주제에 대해 시장성, 기술적 실현성, 차별성 세 축으로 1-5점 평가하고 근거를 답합니다.',
      ].join('\n'),
      input: {
        userMessageTemplate: [
          '도메인: {{run.input.domain}}',
          '',
          '생성된 주제:',
          '{{stages.generate.output.json.topics}}',
          '',
          '각 주제를 평가하세요.',
        ].join('\n'),
        refs: ['generate'],
      },
      output: {
        format: 'tool_use',
        toolName: 'submit_validation',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            assessments: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  title: { type: 'string' },
                  marketScore: { type: 'integer', minimum: 1, maximum: 5 },
                  feasibilityScore: { type: 'integer', minimum: 1, maximum: 5 },
                  differentiationScore: { type: 'integer', minimum: 1, maximum: 5 },
                  rationale: { type: 'string' },
                },
                required: [
                  'title',
                  'marketScore',
                  'feasibilityScore',
                  'differentiationScore',
                  'rationale',
                ],
              },
            },
          },
          required: ['assessments'],
        },
      },
      params: { maxTokens: 4096, temperature: 0.3 },
      cache: { system: true },
      onError: 'abort',
    },
    {
      id: 'critique',
      name: '비판',
      type: 'llm',
      provider: 'anthropic',
      model: 'claude-opus-4-7',
      systemPrompt: [
        '당신은 가장 날카로운 비판가입니다.',
        '각 주제의 약점, 리스크, 가장 강한 반박 논리를 제시합니다.',
        '아첨하지 마세요. 진심으로 죽일 수 있는 지점을 찾으세요.',
      ].join('\n'),
      input: {
        userMessageTemplate: [
          '주제:',
          '{{stages.generate.output.json.topics}}',
          '',
          '검증 결과:',
          '{{stages.validate.output.json.assessments}}',
          '',
          '각 주제별로 (1) 핵심 약점 2-3개, (2) 가장 큰 리스크, (3) 강력한 반박 논리를 제시하세요.',
        ].join('\n'),
        refs: ['generate', 'validate'],
      },
      output: {
        format: 'tool_use',
        toolName: 'submit_critique',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            critiques: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  title: { type: 'string' },
                  weaknesses: {
                    type: 'array',
                    items: { type: 'string' },
                    minItems: 2,
                  },
                  biggestRisk: { type: 'string' },
                  strongestCounterArgument: { type: 'string' },
                },
                required: [
                  'title',
                  'weaknesses',
                  'biggestRisk',
                  'strongestCounterArgument',
                ],
              },
            },
          },
          required: ['critiques'],
        },
      },
      params: { maxTokens: 6000, temperature: 0.7 },
      cache: { system: true },
      onError: 'abort',
    },
  ],
});

async function main() {
  const slug = 'ideation';
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
    console.log(`Updated agent '${slug}' to version ${nextVersion}`);
  } else {
    const agent = await prisma.agent.create({
      data: {
        slug,
        name: 'Ideation Agent',
        description: '주제 생성 → 검증 → 비판 3단계 아이디에이션 에이전트',
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
    console.log(`Created agent '${slug}' v1 (id=${agent.id})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
