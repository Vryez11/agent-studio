import type { NormalizedEvent } from '@agent-studio/shared';

/**
 * 단일 Run에 대한 이벤트 버스. SSE/WebSocket 핸들러가 subscribe로 받아간다.
 * (싱글 인스턴스 가정. 멀티 인스턴스로 가면 Redis pub/sub 등으로 교체)
 */
export class RunEventBus {
  private subscribers = new Map<string, Set<(e: NormalizedEvent) => void>>();

  subscribe(runId: string, handler: (e: NormalizedEvent) => void): () => void {
    let set = this.subscribers.get(runId);
    if (!set) {
      set = new Set();
      this.subscribers.set(runId, set);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
      if (set!.size === 0) this.subscribers.delete(runId);
    };
  }

  emit(runId: string, event: NormalizedEvent): void {
    const set = this.subscribers.get(runId);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(event);
      } catch {
        // 구독자 에러는 격리
      }
    }
  }
}

export const runEvents = new RunEventBus();
