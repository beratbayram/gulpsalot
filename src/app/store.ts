import { create } from 'zustand'
import type { DeathCause } from '../game/Game'
import type { HintKind } from '../game/fx/Hints'
import { storage } from '../platform/storage'

export type Screen = 'boot' | 'title' | 'playing' | 'paused' | 'over'

export interface Settings {
  sound: boolean
  haptics: boolean
}

export interface LastRun {
  score: number
  best: number
  isBest: boolean
  cause: DeathCause
  canContinue: boolean
}

interface AppState {
  screen: Screen
  settings: Settings
  best: number
  hints: Record<HintKind, boolean>
  lastRun: LastRun | null
  updateReady: boolean
  applyUpdate: (() => void) | null
  hydrate(): void
  setScreen(screen: Screen): void
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void
  recordRun(score: number, cause: DeathCause, canContinue: boolean): LastRun
  markHint(kind: HintKind): void
  setUpdate(ready: boolean, apply: (() => void) | null): void
}

const DEFAULT_SETTINGS: Settings = { sound: true, haptics: true }
const DEFAULT_HINTS: Record<HintKind, boolean> = { tapFly: false, avoidBee: false }

export const useAppStore = create<AppState>()((set, get) => ({
  screen: 'boot',
  settings: DEFAULT_SETTINGS,
  best: 0,
  hints: DEFAULT_HINTS,
  lastRun: null,
  updateReady: false,
  applyUpdate: null,

  hydrate() {
    set({
      settings: { ...DEFAULT_SETTINGS, ...storage.get('settings', DEFAULT_SETTINGS) },
      best: storage.get('best', 0),
      hints: { ...DEFAULT_HINTS, ...storage.get('hints', DEFAULT_HINTS) },
    })
  },

  setScreen(screen) {
    set({ screen })
  },

  setSetting(key, value) {
    const settings = { ...get().settings, [key]: value }
    storage.set('settings', settings)
    set({ settings })
  },

  recordRun(score, cause, canContinue) {
    const previous = get().best
    const isBest = score > previous
    const best = Math.max(previous, score)
    if (isBest) storage.set('best', best)
    const lastRun: LastRun = { score, best, isBest, cause, canContinue }
    set({ lastRun, best })
    return lastRun
  },

  markHint(kind) {
    if (get().hints[kind]) return
    const hints = { ...get().hints, [kind]: true }
    storage.set('hints', hints)
    set({ hints })
  },

  setUpdate(ready, apply) {
    set({ updateReady: ready, applyUpdate: apply })
  },
}))
