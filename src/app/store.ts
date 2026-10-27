import { create } from 'zustand'
import { nextStreak, sanitizeStreak, NO_STREAK, type Streak } from '../game/daily'
import type { DeathCause, GameEvents } from '../game/Game'
import {
  advanceMissions,
  sanitizeMissions,
  type MissionEvent,
  type MissionMode,
  type MissionState,
} from '../game/missions'
import type { PlayMode } from '../game/modes'
import { recordStats, sanitizeStats, type ProgressEvent, type Stats } from '../game/progress'
import { isAchievementId, type AchievementId } from '../game/achievements'
import {
  DECOR,
  FLAWLESS_CATCHES,
  TICKLES_FOR_SECRET,
  isSecretId,
  newUnlocks,
  sanitizeDecor,
  sanitizeLook,
  secretUnlock,
  type DecorId,
  type Look,
  type SecretId,
  type Unlock,
} from '../game/cosmetics'
import type { HintKind } from '../game/fx/Hints'
import { LANGS, detectLang, type Lang } from '../i18n'
import { storage } from '../platform/storage'
import type { Challenge } from './sharing'

export type Screen =
  | 'boot'
  | 'title'
  | 'wardrobe'
  | 'achievements'
  | 'modes'
  | 'missions'
  | 'stats'
  | 'playing'
  | 'paused'
  | 'over'

export interface Settings {
  sound: boolean
  /** Background music, on top of the main sound switch. */
  music: boolean
  haptics: boolean
  /** White and red rings around hazards, for colorblind players. */
  contrast: boolean
  lang: Lang
}

/**
 * What the player picked: a play mode, the daily, or a friend's challenge
 * (both classic rules on a fixed seed).
 */
export type RunMode = PlayMode | 'daily' | 'challenge'

/** Modes with their own best score. Classic and daily share the main best. */
export type RecordMode = 'rush' | 'sharp'

export const isRecordMode = (mode: RunMode): mode is RecordMode =>
  mode === 'rush' || mode === 'sharp'

/** The rules a run mode plays by. */
export const playModeOf = (mode: RunMode): PlayMode =>
  mode === 'daily' || mode === 'challenge' ? 'classic' : mode

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
  /** The run's seed, so it can be shared as a challenge. */
  seed: number
  bestCombo: number
  stings: number
  /** The score a friend's challenge asked to beat, challenge runs only. */
  toBeat: number | null
  /** Days in a row with a finished daily, after this run. */
  streak: number
}

export type RunResult = GameEvents['runOver']

export interface DailyRecord {
  day: string
  best: number
}

/** Popups for things unlocked or finished, shown one at a time. */
export type Toast = { id: number } & (
  | { type: 'achievement'; achievement: AchievementId }
  | { type: 'mission'; mission: number }
  | { type: 'secret'; unlock: Unlock }
  | { type: 'decor'; decor: DecorId }
)

type ToastData = Toast extends infer T ? (T extends Toast ? Omit<T, 'id'> : never) : never

interface AppState {
  screen: Screen
  settings: Settings
  best: number
  modeBest: Record<RecordMode, number>
  hints: Record<HintKind, boolean>
  achievements: AchievementId[]
  look: Look
  stats: Stats
  missions: MissionState
  secrets: SecretId[]
  decor: DecorId[]
  daily: DailyRecord | null
  streak: Streak
  /** A friend's challenge from the link the game was opened with. */
  challenge: Challenge | null
  run: CurrentRun
  lastRun: LastRun | null
  toasts: Toast[]
  updateReady: boolean
  applyUpdate: (() => void) | null
  hydrate(): void
  setScreen(screen: Screen): void
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void
  setLook(look: Look): void
  setDecor(decor: DecorId[]): void
  /** Something happened in a run: updates stats, missions and secret looks. */
  record(event: ProgressEvent): void
  unlockSecret(id: SecretId): void
  startRun(run: CurrentRun): void
  recordRun(result: RunResult): LastRun
  setChallenge(challenge: Challenge | null): void
  markHint(kind: HintKind): void
  unlockAchievement(id: AchievementId): void
  dismissToast(id: number): void
  setUpdate(ready: boolean, apply: (() => void) | null): void
}

const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: true,
  haptics: true,
  contrast: false,
  lang: 'en',
}
const DEFAULT_HINTS: Record<HintKind, boolean> = { tapFly: false, avoidBee: false }

let toastId = 0

/** Best score for a given daily challenge day. */
export const dailyBestFor = (daily: DailyRecord | null, day: string) =>
  daily?.day === day ? daily.best : 0

export const useAppStore = create<AppState>()((set, get) => ({
  screen: 'boot',
  settings: DEFAULT_SETTINGS,
  best: 0,
  modeBest: { rush: 0, sharp: 0 },
  hints: DEFAULT_HINTS,
  achievements: [],
  look: sanitizeLook(null, 0),
  stats: sanitizeStats(null),
  missions: sanitizeMissions(null),
  secrets: [],
  decor: [],
  daily: null,
  streak: NO_STREAK,
  challenge: null,
  run: { mode: 'classic', day: null },
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
    const modeBest = storage.get<Partial<Record<RecordMode, unknown>>>('modeBest', {})
    const stats = sanitizeStats(storage.get('stats', null))
    const secrets = storage.get<unknown[]>('secrets', []).filter(isSecretId)
    const record = (v: unknown) => (typeof v === 'number' && v > 0 ? Math.floor(v) : 0)
    set({
      settings: { ...DEFAULT_SETTINGS, ...stored, lang },
      best,
      modeBest: { rush: record(modeBest.rush), sharp: record(modeBest.sharp) },
      hints: { ...DEFAULT_HINTS, ...storage.get('hints', DEFAULT_HINTS) },
      achievements,
      look: sanitizeLook(storage.get('look', null), best, secrets),
      stats,
      missions: sanitizeMissions(storage.get('missions', null)),
      secrets,
      decor: sanitizeDecor(storage.get('decor', null), stats.missions),
      daily: storage.get<DailyRecord | null>('daily', null),
      streak: sanitizeStreak(storage.get('streak', null)),
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

  setDecor(decor) {
    storage.set('decor', decor)
    set({ decor })
  },

  record(event) {
    const state = get()
    const stats = recordStats(state.stats, event)
    const toasts: ToastData[] = []
    let missions = state.missions

    const missionEvent = toMissionEvent(event)
    if (missionEvent) {
      const result = advanceMissions(missions, missionEvent, missionMode(state.run.mode))
      missions = result.state
      for (const done of result.completed) {
        toasts.push({ type: 'mission', mission: done.index })
        const before = stats.missions++
        for (const d of DECOR) {
          if (before < d.missions && stats.missions >= d.missions)
            toasts.push({ type: 'decor', decor: d.id })
        }
      }
      if (missions !== state.missions) storage.set('missions', missions)
    }
    if (stats !== state.stats) storage.set('stats', stats)
    set({ stats, missions })
    for (const toast of toasts) pushToast(toast)

    if (event.type === 'boop' && stats.boops >= TICKLES_FOR_SECRET) get().unlockSecret('ticklish')
    const classic = playModeOf(state.run.mode) !== 'zen' && state.run.mode !== 'rush'
    if (event.type === 'end' && classic && event.misses === 0 && event.catches >= FLAWLESS_CATCHES)
      get().unlockSecret('flawless')
  },

  unlockSecret(id) {
    const { secrets } = get()
    if (secrets.includes(id)) return
    const next = [...secrets, id]
    storage.set('secrets', next)
    set({ secrets: next })
    pushToast({ type: 'secret', unlock: secretUnlock(id) })
  },

  startRun(run) {
    set({ run })
  },

  recordRun({ score, cause, canContinue, seed, bestCombo, stings }) {
    const { best: previous, run, daily, modeBest, challenge } = get()
    const extra = {
      seed,
      bestCombo,
      stings,
      toBeat: run.mode === 'challenge' && challenge ? challenge.score : null,
      streak: 0,
    }

    // Rush and Sharpshooter keep their own records and don't unlock looks.
    if (isRecordMode(run.mode)) {
      const before = modeBest[run.mode]
      const next = { ...modeBest, [run.mode]: Math.max(before, score) }
      if (score > before) storage.set('modeBest', next)
      const lastRun: LastRun = {
        score,
        best: next[run.mode],
        isBest: score > before,
        cause,
        canContinue,
        mode: run.mode,
        dailyBest: 0,
        unlocks: [],
        ...extra,
      }
      set({ lastRun, modeBest: next })
      return lastRun
    }

    const isBest = score > previous
    const best = Math.max(previous, score)
    if (isBest) storage.set('best', best)

    let dailyBest = 0
    if (run.mode === 'daily' && run.day) {
      dailyBest = Math.max(dailyBestFor(daily, run.day), score)
      const record = { day: run.day, best: dailyBest }
      storage.set('daily', record)
      const streak = nextStreak(get().streak, run.day)
      storage.set('streak', streak)
      extra.streak = streak.count
      set({ daily: record, streak })
      get().unlockAchievement('daily')
      if (streak.count >= 3) get().unlockAchievement('streak3')
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
      ...extra,
    }
    set({ lastRun, best })
    return lastRun
  },

  setChallenge(challenge) {
    set({ challenge })
  },

  markHint(kind) {
    if (get().hints[kind]) return
    const hints = { ...get().hints, [kind]: true }
    storage.set('hints', hints)
    set({ hints })
  },

  unlockAchievement(id) {
    const { achievements } = get()
    if (achievements.includes(id)) return
    const next = [...achievements, id]
    storage.set('achievements', next)
    set({ achievements: next })
    pushToast({ type: 'achievement', achievement: id })
  },

  dismissToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  },

  setUpdate(ready, apply) {
    set({ updateReady: ready, applyUpdate: apply })
  },
}))

function pushToast(toast: ToastData) {
  const { toasts } = useAppStore.getState()
  useAppStore.setState({ toasts: [...toasts, { ...toast, id: ++toastId } as Toast] })
}

/** The part of a run event that missions care about. */
function toMissionEvent(e: ProgressEvent): MissionEvent | null {
  if (e.type === 'catch' || e.type === 'tick' || e.type === 'end') return e
  if (e.type === 'bullseye' || e.type === 'set' || e.type === 'burp' || e.type === 'power')
    return { type: e.type }
  return null
}

/** Missions treat every run mode by the rules it plays with. */
const missionMode = (mode: RunMode): MissionMode => (mode === 'challenge' ? 'classic' : mode)
