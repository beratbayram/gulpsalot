export interface StorageBackend {
  keys(): string[]
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** localStorage, or null when it is unavailable (private mode, blocked site data). */
export function localStorageBackend(): StorageBackend | null {
  try {
    const ls = window.localStorage
    const probe = '__pofik_probe__'
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    return {
      keys: () => Object.keys(ls),
      getItem: (k) => ls.getItem(k),
      setItem: (k, v) => ls.setItem(k, v),
    }
  } catch {
    return null
  }
}

/**
 * Key-value store with an in-memory cache. `init()` is async so the backend
 * can later be swapped for Capacitor Preferences without touching callers;
 * reads after init are synchronous.
 */
export class KeyValueStore {
  private readonly cache = new Map<string, unknown>()
  private backend: StorageBackend | null = null
  private readonly createBackend: () => StorageBackend | null
  private readonly prefix: string

  constructor(createBackend: () => StorageBackend | null, prefix = 'pofik:v1:') {
    this.createBackend = createBackend
    this.prefix = prefix
  }

  async init() {
    this.backend = this.createBackend()
    if (!this.backend) return
    try {
      for (const full of this.backend.keys()) {
        if (!full.startsWith(this.prefix)) continue
        const raw = this.backend.getItem(full)
        if (raw === null) continue
        try {
          this.cache.set(full.slice(this.prefix.length), JSON.parse(raw))
        } catch {
          // Ignore corrupted entries; defaults take over.
        }
      }
    } catch {
      this.backend = null
    }
  }

  get<T>(key: string, fallback: T): T {
    return this.cache.has(key) ? (this.cache.get(key) as T) : fallback
  }

  set<T>(key: string, value: T) {
    this.cache.set(key, value)
    try {
      this.backend?.setItem(this.prefix + key, JSON.stringify(value))
    } catch {
      // Quota or privacy errors: keep the in-memory value for this session.
    }
  }
}

export const storage = new KeyValueStore(localStorageBackend)
