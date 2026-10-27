import { clamp, invLerp, lerp } from '../lib/math'
import { CONFIG, type Range } from './config'

const { hunger: H, spawn: S } = CONFIG

export type PreyKind = keyof typeof CONFIG.prey
export type HazardKind = 'bee' | 'wasp' | 'spider'
export type PowerKind = keyof typeof CONFIG.power

export const POWERS = Object.keys(CONFIG.power) as PowerKind[]

/** 0 at run start, 1 once the difficulty ramp is complete. Eased so the first seconds stay gentle. */
export function rampProgress(time: number) {
  const t = clamp(time / S.rampTime, 0, 1)
  return t * t * (3 - 2 * t) * 0.6 + t * 0.4
}

const at = (range: Range, t: number) => lerp(range[0], range[1], t)
const smooth = (t: number) => {
  const k = clamp(t, 0, 1)
  return k * k * (3 - 2 * k)
}

/** 0 = day, 1 = dusk, 2 = night. Follows run time and never goes back. */
export function skyPhase(time: number) {
  const { duskStart, duskEnd, nightStart, nightEnd } = CONFIG.sky
  return smooth(invLerp(duskStart, duskEnd, time)) + smooth(invLerp(nightStart, nightEnd, time))
}

export interface SpawnRule {
  active: boolean
  interval: number
  max: number
  speed: number
}

export interface Difficulty {
  fly: SpawnRule
  bee: SpawnRule
  dragonfly: SpawnRule
  firefly: SpawnRule
  moth: SpawnRule
  ladybug: SpawnRule
  wasp: SpawnRule
  spider: SpawnRule
  beetle: SpawnRule
  /** Chance that a fly spawn is a golden fly instead. */
  goldenChance: number
  goldenSpeed: number
}

/** A kind that starts at `start` seconds and ramps with the rest. */
const timed = (
  rule: { start: number; interval: Range; max: Range; speed: Range },
  time: number,
  t: number,
): SpawnRule => ({
  active: time >= rule.start,
  interval: at(rule.interval, t),
  max: Math.round(at(rule.max, t)),
  speed: at(rule.speed, t),
})

export function difficulty(time: number): Difficulty {
  const t = rampProgress(time)
  const flySpeed = at(S.flySpeed, t)
  const sky = skyPhase(time)
  return {
    fly: {
      active: true,
      interval: at(S.flyInterval, t),
      max: Math.round(at(S.maxFlies, t)),
      speed: flySpeed,
    },
    bee: {
      active: time >= S.beeStart,
      interval: at(S.beeInterval, t),
      max: Math.round(at(S.maxBees, t)),
      speed: at(S.beeSpeed, t),
    },
    dragonfly: timed(S.dragonfly, time, t),
    firefly: {
      active: sky >= S.firefly.minSky,
      interval: at(S.firefly.interval, t),
      max: Math.round(at(S.firefly.max, t)),
      speed: at(S.firefly.speed, t),
    },
    moth: {
      active: sky >= S.moth.minSky,
      interval: at(S.moth.interval, t),
      max: Math.round(at(S.moth.max, t)),
      speed: at(S.moth.speed, t),
    },
    ladybug: timed(S.ladybug, time, t),
    wasp: timed(S.wasp, time, t),
    spider: timed(S.spider, time, t),
    beetle: timed(S.beetle, time, t),
    goldenChance: time >= S.golden.start ? at(S.golden.chance, t) : 0,
    goldenSpeed: flySpeed * S.golden.speed,
  }
}

export const drainRate = (time: number) =>
  Math.min(H.drainMax, H.drainStart + H.drainPerSecond * Math.max(0, time))

export const drainHunger = (hunger: number, dt: number, time: number) =>
  Math.max(0, hunger - drainRate(time) * dt)

export const feed = (hunger: number, food: number) => Math.min(H.max, hunger + food)

export const sting = (hunger: number) => Math.max(0, hunger - H.sting)

export const revive = (hunger: number) => Math.max(hunger, H.continueTo)

export const isStarved = (hunger: number) => hunger <= 0

export const isCritical = (hunger: number) => hunger > 0 && hunger / H.max <= H.critical

/** Score multiplier for a chain of quick catches: x1 up to x5. */
export const comboMultiplier = (chain: number) =>
  1 + CONFIG.combo.steps.filter((step) => chain >= step).length

/** Total points and food for one swallow, before the combo multiplier. */
export function preyValue(kinds: readonly PreyKind[]) {
  let points = 0
  let food = 0
  for (const kind of kinds) {
    points += CONFIG.prey[kind].points
    food += CONFIG.prey[kind].food
  }
  return { points, food }
}

export interface SetState {
  kind: PreyKind | null
  count: number
}

/**
 * Follows catches of the same kind in a row. Returns the kinds that completed
 * a set with these catches; a completed set starts counting again from zero.
 */
export function trackSets(state: SetState, kinds: readonly PreyKind[]) {
  const completed: PreyKind[] = []
  for (const kind of kinds) {
    if (kind === state.kind) state.count++
    else {
      state.kind = kind
      state.count = 1
    }
    if (state.count >= CONFIG.set.size) {
      completed.push(kind)
      state.count = 0
    }
  }
  return completed
}

/** Bonus points for completed sets. */
export const setBonus = (completed: readonly PreyKind[]) =>
  completed.reduce((sum, kind) => sum + CONFIG.set.bonus * CONFIG.prey[kind].points, 0)

/** Food that would overflow a full belly, as a fraction of the burp meter. */
export const burpGain = (hunger: number, food: number) =>
  Math.max(0, hunger + food - H.max) / CONFIG.burp.capacity
