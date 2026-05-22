import type { StageProvider } from '@agent-studio/runtime';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';

export { AnthropicProvider } from './anthropic.js';
export { OpenAIProvider } from './openai.js';

/**
 * Stage 정의의 `provider` 필드를 실제 구현으로 매핑.
 * 새 provider 추가 시 여기에 등록.
 */
export function createProviderRegistry(): (name: string) => StageProvider {
  const anthropic = new AnthropicProvider();
  const openai = new OpenAIProvider();
  return (name: string) => {
    switch (name) {
      case 'anthropic':
        return anthropic;
      case 'openai':
        return openai;
      default:
        throw new Error(`Unknown provider: ${name}`);
    }
  };
}
