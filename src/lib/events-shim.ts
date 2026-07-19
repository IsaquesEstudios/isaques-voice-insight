type EventName = string | symbol;
type Listener = (...args: unknown[]) => void;

class EventEmitter {
  static EventEmitter: typeof EventEmitter;
  static defaultMaxListeners = 10;

  private readonly events = new Map<EventName, Listener[]>();
  private maxListeners = EventEmitter.defaultMaxListeners;

  setMaxListeners(n: number) {
    this.maxListeners = n;
    return this;
  }

  getMaxListeners() {
    return this.maxListeners;
  }

  on(event: EventName, listener: Listener) {
    const listeners = this.events.get(event) ?? [];
    listeners.push(listener);
    this.events.set(event, listeners);
    return this;
  }

  addListener(event: EventName, listener: Listener) {
    return this.on(event, listener);
  }

  once(event: EventName, listener: Listener) {
    const wrapped: Listener & { listener?: Listener } = (...args) => {
      this.removeListener(event, wrapped);
      listener(...args);
    };
    wrapped.listener = listener;
    return this.on(event, wrapped);
  }

  emit(event: EventName, ...args: unknown[]) {
    const listeners = [...(this.events.get(event) ?? [])];

    if (!listeners.length) {
      if (event === "error") {
        const [error] = args;
        if (error instanceof Error) throw error;
        throw new Error(String(error ?? "Unhandled error event"));
      }
      return false;
    }

    listeners.forEach((listener) => listener(...args));
    return true;
  }

  removeListener(event: EventName, listener: Listener) {
    const listeners = this.events.get(event);
    if (!listeners) return this;

    const next = listeners.filter((item) => item !== listener && item.listener !== listener);
    if (next.length) {
      this.events.set(event, next);
    } else {
      this.events.delete(event);
    }
    return this;
  }

  off(event: EventName, listener: Listener) {
    return this.removeListener(event, listener);
  }

  removeAllListeners(event?: EventName) {
    if (typeof event === "undefined") {
      this.events.clear();
    } else {
      this.events.delete(event);
    }
    return this;
  }

  listeners(event: EventName) {
    return [...(this.events.get(event) ?? [])];
  }

  rawListeners(event: EventName) {
    return this.listeners(event);
  }

  listenerCount(event: EventName) {
    return this.events.get(event)?.length ?? 0;
  }

  eventNames() {
    return [...this.events.keys()];
  }
}

EventEmitter.EventEmitter = EventEmitter;

export { EventEmitter };
export default EventEmitter;