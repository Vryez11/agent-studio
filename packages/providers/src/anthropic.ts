import Anthropic from '@anthropic-ai/sdk';
import type { StageProvider } from '@agent-studio/runtime';
import type {
  StageDefinition,
  NormalizedEvent,
  Usage,
} from '@agent-studio/shared';

const OPUS_4_7_PREFIX = 'claude-opus-4-7';

export class AnthropicProvider implements StageProvider {
  private explicitApiKey?: string;
  private _client: Anthropic | null = null;

  constructor(apiKey?: string) {
    this.explicitApiKey = apiKey;
  }

  private get client(): Anthropic {
    if (this._client) return this._client;
    const apiKey = this.explicitApiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY가 설정되지 않았습니다. apps/api/.env에 추가하고 API 서버를 재시작하세요.',
      );
    }
    this._client = new Anthropic({ apiKey });
    return this._client;
  }

  async *stream(
    stage: StageDefinition,
    userMessage: string,
    signal: AbortSignal,
  ): AsyncIterable<NormalizedEvent> {
    const isOpus47 = stage.model.startsWith(OPUS_4_7_PREFIX);

    const systemBlocks: Anthropic.TextBlockParam[] = [
      {
        type: 'text',
        text: stage.systemPrompt,
        ...(stage.cache?.system ? { cache_control: { type: 'ephemeral' } } : {}),
      },
    ];

    const params: Anthropic.MessageCreateParamsStreaming = {
      model: stage.model,
      max_tokens: stage.params.maxTokens,
      system: systemBlocks,
      messages: [{ role: 'user', content: userMessage }],
      stream: true,
    };

    // Opus 4.7은 temperature/top_p 거부. 그 외 모델만 전달.
    if (!isOpus47) {
      params.temperature = stage.params.temperature;
      if (stage.params.topP !== undefined) params.top_p = stage.params.topP;
    }

    // 구조화 출력: tool_use 강제
    let toolName: string | undefined;
    if (
      stage.output.format === 'tool_use' &&
      stage.output.schema &&
      stage.output.toolName
    ) {
      toolName = stage.output.toolName;
      params.tools = [
        {
          name: toolName,
          description: `Submit the structured ${toolName} result.`,
          input_schema: stage.output.schema as Anthropic.Tool.InputSchema,
        },
      ];
      params.tool_choice = { type: 'tool', name: toolName };
    }

    const streamer = this.client.messages.stream(params, { signal });

    let textBuf = '';

    for await (const event of streamer) {
      if (signal.aborted) break;

      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          textBuf += event.delta.text;
          yield { type: 'text_delta', stageId: stage.id, text: event.delta.text };
        } else if (event.delta.type === 'input_json_delta') {
          yield {
            type: 'tool_use_delta',
            stageId: stage.id,
            partialJson: event.delta.partial_json,
          };
        }
      }
    }

    if (signal.aborted) return;

    const finalMessage = await streamer.finalMessage();

    let outputStructured: unknown;
    if (toolName) {
      const toolBlock = finalMessage.content.find(
        (b): b is Anthropic.ToolUseBlock =>
          b.type === 'tool_use' && b.name === toolName,
      );
      outputStructured = toolBlock?.input;
    }

    // SDK 버전에 따라 cache_* 필드가 typed Usage에 없을 수 있어 any로 안전 접근
    const rawUsage = finalMessage.usage as unknown as Record<string, number | undefined>;
    const usage: Usage = {
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
      cacheReadTokens: rawUsage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: rawUsage.cache_creation_input_tokens ?? 0,
    };

    yield {
      type: 'stage_completed',
      stageId: stage.id,
      stageIndex: -1,
      usage,
      outputText: textBuf,
      outputStructured,
    };
  }
}
