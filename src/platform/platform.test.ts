import { describe, expect, it } from 'vitest'
import { createFrequencyCap } from './monetization/frequencyCap'
import { KeyValueStore, type StorageBackend } from './storage'

function memoryBackend(
  seed: Record<string, string> = {},
): StorageBackend & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed))
  return {
    data,
    keys: () => [...data.keys()],
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  }
}

describe('KeyValueStore', () => {
  it('loads prefixed keys and ignores others', async () => {
    const backend = memoryBackend({ 'gulpsalot:v1:best': '12', other: '"x"' })
    const store = new KeyValueStore(() => backend)
    await store.init()
    expect(store.get('best', 0)).toBe(12)
    expect(store.get('other', 'fallback')).toBe('fallback')
  })

  it('persists writes as JSON', async () => {
    const backend = memoryBackend()
    const store = new KeyValueStore(() => backend)
    await store.init()
    store.set('settings', { sound: false })
    expect(backend.data.get('gulpsalot:v1:settings')).toBe('{"sound":false}')
  })

  it('works in memory when storage is unavailable', async () => {
    const store = new KeyValueStore(() => null)
    await store.init()
    store.set('best', 5)
    expect(store.get('best', 0)).toBe(5)
  })

  it('survives a backend that throws on write and corrupted entries', async () => {
    const backend = memoryBackend({ 'gulpsalot:v1:broken': '{nope' })
    backend.setItem = () => {
      throw new Error('quota')
    }
    const store = new KeyValueStore(() => backend)
    await store.init()
    expect(store.get('broken', 'default')).toBe('default')
    expect(() => store.set('best', 3)).not.toThrow()
    expect(store.get('best', 0)).toBe(3)
  })
})

describe('frequency cap', () => {
  it('needs enough runs and enough time between interstitials', () => {
    let now = 0
    const cap = createFrequencyCap({ everyRuns: 3, minGapMs: 60_000 }, () => now)
    cap.recordRun()
    cap.recordRun()
    expect(cap.shouldShow()).toBe(false)
    cap.recordRun()
    expect(cap.shouldShow()).toBe(true)
    cap.markShown()
    for (let i = 0; i < 3; i++) cap.recordRun()
    now = 30_000
    expect(cap.shouldShow()).toBe(false)
    now = 61_000
    expect(cap.shouldShow()).toBe(true)
  })
})
