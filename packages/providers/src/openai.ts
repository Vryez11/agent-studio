import type { StageProvider } from '@agent-studio/runtime';
import type {
  StageDefinition,
  NormalizedEvent,
  Usage,
} from '@agent-studio/shared';

/**
 * OpenAI provider 어댑터.
 * 실제 SDK 호출은 다음 단계에서 구현. 지금은 인터페이스만 노출.
 */
export class OpenAIProvider implements StageProvider {
  async *stream(
    stage: StageDefinition,
    resolvedUserMessage: string,
    signal: AbortSignal,
  ): AsyncIterable<NormalizedEvent> {
    // TODO(next-step): openai SDK의 chat.completions.create({ stream: true }) 또는 responses API 연결
    //   - stage.output.format === 'json_schema' 이면 response_format: { type: 'json_schema', json_schema }
    //   - stage.output.format === 'tool_use' 이면 tools + tool_choice: { type: 'function', function: { name } }
    //   - 매 choices[].delta.content → yield text_delta
    //   - tool_calls[].function.arguments delta → yield tool_use_delta
    //   - usage는 stream_options.include_usage=true 후 마지막 청크에서 수신
    void stage;
    void resolvedUserMessage;
    void signal;
    const usage: Usage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    };
    yield {
      type: 'stage_completed',
      stageId: stage.id,
      stageIndex: -1,
      usage,
      outputText: '[openai provider not yet implemented]',
    };
  }
}
