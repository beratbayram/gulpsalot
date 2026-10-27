import { clamp, invLerp, lerp } from '../lib/math'
import { CONFIG, type Range } from './config'

const { hunger: H, spawn: S } = CONFIG

export type PreyKind = keyof typeof CONFIG.prey

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
  /** Chance that a fly spawn is a golden fly instead. */
  goldenChance: number
  goldenSpeed: number
}

export function difficulty(time: number): Difficulty {
  const t = rampProgress(time)
  const flySpeed = at(S.flySpeed, t)
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
    dragonfly: {
      active: time >= S.dragonfly.start,
      interval: at(S.dragonfly.interval, t),
      max: Math.round(at(S.dragonfly.max, t)),
      speed: at(S.dragonfly.speed, t),
    },
    firefly: {
      active: skyPhase(time) >= S.firefly.minSky,
      interval: at(S.firefly.interval, t),
      max: Math.round(at(S.firefly.max, t)),
      speed: at(S.firefly.speed, t),
    },
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
