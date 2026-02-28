import type { EngineEvent, EngineEventType } from '../types';

type Handler<T = unknown> = (event: EngineEvent<T>) => void;

export class EventBus {
  private listeners = new Map<EngineEventType, Set<Handler>>();

  on<T>(type: EngineEventType, handler: Handler<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler as Handler);
    // return unsubscribe fn
    return () => this.off(type, handler as Handler);
  }

  off(type: EngineEventType, handler: Handler): void {
    this.listeners.get(type)?.delete(handler);
  }

  emit<T>(type: EngineEventType, payload: T): void {
    const event: EngineEvent<T> = { type, payload, timestamp: performance.now() };
    this.listeners.get(type)?.forEach(h => h(event as EngineEvent));
  }

  clear(): void {
    this.listeners.clear();
  }
}
