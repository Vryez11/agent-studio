import OpenAI from 'openai';
import type { StageProvider } from '@agent-studio/runtime';
import type {
  StageDefinition,
  NormalizedEvent,
  Usage,
} from '@agent-studio/shared';

export class OpenAIProvider implements StageProvider {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
  }

  async *stream(
    stage: StageDefinition,
    userMessage: string,
    signal: AbortSignal,
  ): AsyncIterable<NormalizedEvent> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: stage.systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const params: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
      model: stage.model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: stage.params.maxTokens,
      temperature: stage.params.temperature,
    };
    if (stage.params.topP !== undefined) params.top_p = stage.params.topP;

    // 구조화 출력 처리
    let useTool = false;
    let toolName: string | undefined;
    if (
      stage.output.format === 'tool_use' &&
      stage.output.schema &&
      stage.output.toolName
    ) {
      useTool = true;
      toolName = stage.output.toolName;
      params.tools = [
        {
          type: 'function',
          function: {
            name: toolName,
            description: `Submit the structured ${toolName} result.`,
            parameters: stage.output.schema,
            strict: true,
          },
        },
      ];
      params.tool_choice = { type: 'function', function: { name: toolName } };
    } else if (stage.output.format === 'json_schema' && stage.output.schema) {
      params.response_format = {
        type: 'json_schema',
        json_schema: {
          name: stage.output.toolName ?? 'response',
          schema: stage.output.schema,
          strict: true,
        },
      };
    }

    const stream = await this.client.chat.completions.create(params, { signal });

    let textBuf = '';
    let toolArgsBuf = '';
    let usage: Usage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    };

    for await (const chunk of stream) {
      if (signal.aborted) break;

      const choice = chunk.choices[0];
      if (choice?.delta) {
        if (choice.delta.content) {
          textBuf += choice.delta.content;
          yield { type: 'text_delta', stageId: stage.id, text: choice.delta.content };
        }
        if (choice.delta.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            const args = tc.function?.arguments;
            if (args) {
              toolArgsBuf += args;
              yield {
                type: 'tool_use_delta',
                stageId: stage.id,
                partialJson: args,
              };
            }
          }
        }
      }
      if (chunk.usage) {
        usage = {
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
          cacheReadTokens: chunk.usage.prompt_tokens_details?.cached_tokens ?? 0,
          cacheCreationTokens: 0,
        };
      }
    }

    if (signal.aborted) return;

    let outputStructured: unknown;
    if (useTool && toolArgsBuf) {
      try {
        outputStructured = JSON.parse(toolArgsBuf);
      } catch {
        // 파싱 실패 시 raw 문자열을 outputStructured 자리에 보관하지 않고 undefined 유지
      }
    } else if (params.response_format?.type === 'json_schema' && textBuf) {
      try {
        outputStructured = JSON.parse(textBuf);
      } catch {
        // 동일
      }
    }

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
