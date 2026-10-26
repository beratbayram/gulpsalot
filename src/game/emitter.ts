type Handler<T> = (payload: T) => void

/** Minimal typed event emitter. */
export class Emitter<Events extends object> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>()

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>) {
    let set = this.handlers.get(event)
    if (!set) this.handlers.set(event, (set = new Set()))
    set.add(handler as Handler<never>)
    return () => {
      set.delete(handler as Handler<never>)
    }
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    this.handlers.get(event)?.forEach((h) => (h as Handler<Events[K]>)(payload))
  }

  clear() {
    this.handlers.clear()
  }
}
