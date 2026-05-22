import type { StageProvider } from '@agent-studio/runtime';
import type {
  StageDefinition,
  NormalizedEvent,
  Usage,
} from '@agent-studio/shared';

/**
 * Anthropic provider 어댑터.
 * 실제 SDK 호출은 다음 단계에서 구현. 지금은 인터페이스만 노출.
 */
export class AnthropicProvider implements StageProvider {
  async *stream(
    stage: StageDefinition,
    resolvedUserMessage: string,
    signal: AbortSignal,
  ): AsyncIterable<NormalizedEvent> {
    // TODO(next-step): @anthropic-ai/sdk의 messages.stream() 연결
    //   - stage.cache.system이면 system 블록에 cache_control: { type: 'ephemeral' }
    //   - stage.output.format === 'tool_use' 이면 tools + tool_choice 강제
    //   - 매 content_block_delta → yield { type: 'text_delta', ... }
    //   - input_json_delta → yield { type: 'tool_use_delta', ... }
    //   - 종료 시 message.usage로 yield { type: 'stage_completed', usage, outputText, outputStructured }
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
      outputText: '[anthropic provider not yet implemented]',
    };
  }
}
