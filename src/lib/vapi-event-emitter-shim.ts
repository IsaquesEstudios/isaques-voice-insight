type Listener = (...args: unknown[]) => void;
type StoredListener = Listener & { listener?: Listener };

export class EventEmitter {
  private events = new Map<string | symbol, StoredListener[]>();
  private maxListeners = 10;

  setMaxListeners(count: number) {
    this.maxListeners = count;
    return this;
  }

  getMaxListeners() {
    return this.maxListeners;
  }

  on(event: string | symbol, listener: Listener) {
    const listeners = this.events.get(event) ?? [];
    listeners.push(listener as StoredListener);
    this.events.set(event, listeners);
    return this;
  }

  addListener(event: string | symbol, listener: Listener) {
    return this.on(event, listener);
  }

  once(event: string | symbol, listener: Listener) {
    const wrapped: StoredListener = (...args: unknown[]) => {
      this.removeListener(event, wrapped);
      listener(...args);
    };
    wrapped.listener = listener;
    return this.on(event, wrapped);
  }

  off(event: string | symbol, listener: Listener) {
    return this.removeListener(event, listener);
  }

  removeListener(event: string | symbol, listener: Listener) {
    const listeners = this.events.get(event);
    if (!listeners) return this;

    const nextListeners = listeners.filter((current) => current !== listener && current.listener !== listener);
    if (nextListeners.length) {
      this.events.set(event, nextListeners);
    } else {
      this.events.delete(event);
    }

    return this;
  }

  removeAllListeners(event?: string | symbol) {
    if (typeof event === "undefined") {
      this.events.clear();
    } else {
      this.events.delete(event);
    }

    return this;
  }

  emit(event: string | symbol, ...args: unknown[]) {
    const listeners = this.events.get(event);
    if (!listeners?.length) {
      if (event === "error") {
        const error = args[0];
        throw error instanceof Error ? error : new Error(String(error ?? "Erro desconhecido."));
      }
      return false;
    }

    for (const listener of [...listeners]) {
      listener(...args);
    }

    return true;
  }

  listeners(event: string | symbol) {
    return [...(this.events.get(event) ?? [])];
  }

  listenerCount(event: string | symbol) {
    return this.events.get(event)?.length ?? 0;
  }

  eventNames() {
    return [...this.events.keys()];
  }
}

export default EventEmitter;