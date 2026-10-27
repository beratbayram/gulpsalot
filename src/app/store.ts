import { create } from 'zustand'
import type { DeathCause } from '../game/Game'
import { isAchievementId, type AchievementId } from '../game/achievements'
import { newUnlocks, sanitizeLook, type Look, type Unlock } from '../game/cosmetics'
import type { HintKind } from '../game/fx/Hints'
import { LANGS, detectLang, type Lang } from '../i18n'
import { storage } from '../platform/storage'

export type Screen = 'boot' | 'title' | 'wardrobe' | 'achievements' | 'playing' | 'paused' | 'over'

export interface Settings {
  sound: boolean
  haptics: boolean
  lang: Lang
}

export type RunMode = 'normal' | 'daily'

export interface CurrentRun {
  mode: RunMode
  /** Daily challenge date (`YYYY-MM-DD`), for daily runs. */
  day: string | null
}

export interface LastRun {
  score: number
  best: number
  isBest: boolean
  cause: DeathCause
  canContinue: boolean
  mode: RunMode
  /** Best score for this daily challenge, daily runs only. */
  dailyBest: number
  /** Skins and hats this run unlocked. */
  unlocks: Unlock[]
}

export interface DailyRecord {
  day: string
  best: number
}

export interface Toast {
  id: number
  achievement: AchievementId
}

interface AppState {
  screen: Screen
  settings: Settings
  best: number
  hints: Record<HintKind, boolean>
  achievements: AchievementId[]
  look: Look
  daily: DailyRecord | null
  run: CurrentRun
  lastRun: LastRun | null
  toasts: Toast[]
  updateReady: boolean
  applyUpdate: (() => void) | null
  hydrate(): void
  setScreen(screen: Screen): void
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void
  setLook(look: Look): void
  startRun(run: CurrentRun): void
  recordRun(score: number, cause: DeathCause, canContinue: boolean): LastRun
  markHint(kind: HintKind): void
  unlockAchievement(id: AchievementId): void
  dismissToast(id: number): void
  setUpdate(ready: boolean, apply: (() => void) | null): void
}

const DEFAULT_SETTINGS: Settings = { sound: true, haptics: true, lang: 'en' }
const DEFAULT_HINTS: Record<HintKind, boolean> = { tapFly: false, avoidBee: false }

let toastId = 0

/** Best score for a given daily challenge day. */
export const dailyBestFor = (daily: DailyRecord | null, day: string) =>
  daily?.day === day ? daily.best : 0

export const useAppStore = create<AppState>()((set, get) => ({
  screen: 'boot',
  settings: DEFAULT_SETTINGS,
  best: 0,
  hints: DEFAULT_HINTS,
  achievements: [],
  look: sanitizeLook(null, 0),
  daily: null,
  run: { mode: 'normal', day: null },
  lastRun: null,
  toasts: [],
  updateReady: false,
  applyUpdate: null,

  hydrate() {
    const best = storage.get('best', 0)
    const achievements = storage.get<unknown[]>('achievements', []).filter(isAchievementId)
    const stored = storage.get<Partial<Settings>>('settings', {})
    // Follow the device language until the player picks one.
    const lang = stored.lang && LANGS.includes(stored.lang) ? stored.lang : detectLang()
    set({
      settings: { ...DEFAULT_SETTINGS, ...stored, lang },
      best,
      hints: { ...DEFAULT_HINTS, ...storage.get('hints', DEFAULT_HINTS) },
      achievements,
      look: sanitizeLook(storage.get('look', null), best),
      daily: storage.get<DailyRecord | null>('daily', null),
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

  setLook(look) {
    storage.set('look', look)
    set({ look })
  },

  startRun(run) {
    set({ run })
  },

  recordRun(score, cause, canContinue) {
    const { best: previous, run, daily } = get()
    const isBest = score > previous
    const best = Math.max(previous, score)
    if (isBest) storage.set('best', best)

    let dailyBest = 0
    if (run.mode === 'daily' && run.day) {
      dailyBest = Math.max(dailyBestFor(daily, run.day), score)
      const record = { day: run.day, best: dailyBest }
      storage.set('daily', record)
      set({ daily: record })
      get().unlockAchievement('daily')
    }

    const lastRun: LastRun = {
      score,
      best,
      isBest,
      cause,
      canContinue,
      mode: run.mode,
      dailyBest,
      unlocks: newUnlocks(previous, best),
    }
    set({ lastRun, best })
    return lastRun
  },

  markHint(kind) {
    if (get().hints[kind]) return
    const hints = { ...get().hints, [kind]: true }
    storage.set('hints', hints)
    set({ hints })
  },

  unlockAchievement(id) {
    const { achievements, toasts } = get()
    if (achievements.includes(id)) return
    const next = [...achievements, id]
    storage.set('achievements', next)
    set({ achievements: next, toasts: [...toasts, { id: ++toastId, achievement: id }] })
  },

  dismissToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  },

  setUpdate(ready, apply) {
    set({ updateReady: ready, applyUpdate: apply })
  },
}))
