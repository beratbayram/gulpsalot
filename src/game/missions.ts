import type { PreyKind } from './rules'

/** Prey a "catch" mission can ask for. Ladybugs are not something to aim for. */
export type MissionPrey = Exclude<PreyKind, 'ladybug'>

/**
 * What a mission asks. Counting goals add up over many runs; "reach" goals
 * (score, survive, combo, multi, rush, sharp) must happen within one run.
 */
export type Goal =
  | { type: 'catch'; kind: MissionPrey }
  | { type: 'score' }
  | { type: 'survive' }
  | { type: 'combo' }
  | { type: 'comboNight' }
  | { type: 'multi' }
  | { type: 'bullseye' }
  | { type: 'set' }
  | { type: 'burp' }
  | { type: 'power' }
  | { type: 'daily' }
  | { type: 'rush' }
  | { type: 'sharp' }

export interface MissionDef {
  goal: Goal
  n: number
}

/** Played in order. After the last one the list repeats with bigger targets. */
export const MISSIONS: readonly MissionDef[] = [
  { goal: { type: 'catch', kind: 'fly' }, n: 15 },
  { goal: { type: 'score' }, n: 20 },
  { goal: { type: 'bullseye' }, n: 3 },
  { goal: { type: 'combo' }, n: 3 },
  { goal: { type: 'catch', kind: 'dragonfly' }, n: 3 },
  { goal: { type: 'survive' }, n: 60 },
  { goal: { type: 'set' }, n: 3 },
  { goal: { type: 'multi' }, n: 2 },
  { goal: { type: 'burp' }, n: 1 },
  { goal: { type: 'power' }, n: 2 },
  { goal: { type: 'catch', kind: 'golden' }, n: 1 },
  { goal: { type: 'score' }, n: 50 },
  { goal: { type: 'daily' }, n: 1 },
  { goal: { type: 'catch', kind: 'firefly' }, n: 5 },
  { goal: { type: 'rush' }, n: 30 },
  { goal: { type: 'comboNight' }, n: 3 },
  { goal: { type: 'catch', kind: 'moth' }, n: 5 },
  { goal: { type: 'sharp' }, n: 25 },
  { goal: { type: 'survive' }, n: 100 },
  { goal: { type: 'combo' }, n: 4 },
  { goal: { type: 'catch', kind: 'fly' }, n: 100 },
  { goal: { type: 'score' }, n: 100 },
  { goal: { type: 'multi' }, n: 3 },
  { goal: { type: 'bullseye' }, n: 15 },
  { goal: { type: 'catch', kind: 'beetle' }, n: 5 },
  { goal: { type: 'comboNight' }, n: 5 },
]

export const ACTIVE_MISSIONS = 3

/** Goals whose target stays the same on repeat rounds (combos top out at x5). */
const FIXED: readonly Goal['type'][] = ['combo', 'comboNight', 'multi']

/** A mission slot: which mission in the endless sequence, and how far along it is. */
export interface MissionSlot {
  index: number
  progress: number
}

export interface MissionState {
  /** Sequence index of the next mission to hand out. */
  next: number
  active: MissionSlot[]
}

export const initialMissions = (): MissionState => ({
  next: ACTIVE_MISSIONS,
  active: Array.from({ length: ACTIVE_MISSIONS }, (_, index) => ({ index, progress: 0 })),
})

export const missionDef = (index: number) => MISSIONS[index % MISSIONS.length]

/** Target for a mission in the sequence; every repeat round asks for more. */
export function missionTarget(index: number) {
  const def = missionDef(index)
  const round = Math.floor(index / MISSIONS.length)
  return FIXED.includes(def.goal.type) ? def.n : def.n * (1 + round)
}

/** Which run modes count. Zen counts for nothing. */
export type MissionMode = 'classic' | 'daily' | 'zen' | 'rush' | 'sharp'

/** Things that happen in a run, as far as missions care. */
export type MissionEvent =
  | { type: 'catch'; kinds: readonly PreyKind[]; combo: number; night: boolean; score: number }
  | { type: 'bullseye' | 'set' | 'burp' | 'power' }
  | { type: 'tick'; runTime: number }
  | { type: 'end'; score: number }

/** Modes where score and survival goals count: the classic rules. */
const CLASSIC: readonly MissionMode[] = ['classic', 'daily', 'sharp']

/** How much an event moves a goal: an amount to add, or a value to reach. */
function measure(
  goal: Goal,
  e: MissionEvent,
  mode: MissionMode,
): { add: number } | { reach: number } | null {
  if (mode === 'zen') return null
  switch (goal.type) {
    case 'catch':
      return e.type === 'catch' ? { add: e.kinds.filter((k) => k === goal.kind).length } : null
    case 'multi':
      return e.type === 'catch' ? { reach: e.kinds.length } : null
    case 'combo':
      return e.type === 'catch' ? { reach: e.combo } : null
    case 'comboNight':
      return e.type === 'catch' && e.night ? { reach: e.combo } : null
    case 'score':
      return e.type === 'catch' && CLASSIC.includes(mode) ? { reach: e.score } : null
    case 'survive':
      return e.type === 'tick' && CLASSIC.includes(mode) ? { reach: Math.floor(e.runTime) } : null
    case 'rush':
    case 'sharp':
      return e.type === 'catch' && mode === goal.type ? { reach: e.score } : null
    case 'daily':
      return e.type === 'end' && mode === 'daily' ? { add: 1 } : null
    default:
      return e.type === goal.type ? { add: 1 } : null
  }
}

/**
 * Applies an event to the active missions. Finished missions are replaced by
 * the next ones in the sequence. Returns the new state and what was finished.
 */
export function advanceMissions(state: MissionState, e: MissionEvent, mode: MissionMode) {
  const completed: MissionSlot[] = []
  let next = state.next
  let changed = false
  const active = state.active.map((slot) => {
    const m = measure(missionDef(slot.index).goal, e, mode)
    if (!m) return slot
    const progress = 'add' in m ? slot.progress + m.add : Math.max(slot.progress, m.reach)
    if (progress === slot.progress) return slot
    changed = true
    const target = missionTarget(slot.index)
    if (progress < target) return { index: slot.index, progress }
    completed.push({ index: slot.index, progress: target })
    return { index: next++, progress: 0 }
  })
  return { state: changed ? { next, active } : state, completed }
}

/** A stored mission state, or a fresh one when it is missing or broken. */
export function sanitizeMissions(value: unknown): MissionState {
  const raw = value as Partial<MissionState> | null
  const valid =
    raw &&
    Number.isInteger(raw.next) &&
    Array.isArray(raw.active) &&
    raw.active.length === ACTIVE_MISSIONS &&
    raw.active.every((s) => Number.isInteger(s?.index) && typeof s?.progress === 'number')
  return valid ? { next: raw.next!, active: raw.active!.map((s) => ({ ...s })) } : initialMissions()
}
