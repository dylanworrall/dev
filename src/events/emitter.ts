type EventCallback = (eventName: string, data: Record<string, unknown>) => void;

class SoshiEventEmitter {
  private listeners: EventCallback[] = [];

  subscribe(cb: EventCallback) {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }

  emit(eventName: string, data: Record<string, unknown>) {
    for (const cb of this.listeners) {
      try { cb(eventName, data); } catch (e) { console.error('[SoshiEvents] Listener error:', e); }
    }
  }
}

export const soshiEvents = new SoshiEventEmitter();
