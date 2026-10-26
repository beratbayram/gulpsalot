import { clamp, lerp } from '../lib/math'
import { CONFIG, type Range } from './config'

const { hunger: H, spawn: S } = CONFIG

/** 0 at run start, 1 once the difficulty ramp is complete. Eased so the first seconds stay gentle. */
export function rampProgress(time: number) {
  const t = clamp(time / S.rampTime, 0, 1)
  return t * t * (3 - 2 * t) * 0.6 + t * 0.4
}

const at = (range: Range, t: number) => lerp(range[0], range[1], t)

export interface Difficulty {
  flyInterval: number
  maxFlies: number
  beeInterval: number
  maxBees: number
  beesActive: boolean
  flySpeed: number
  beeSpeed: number
}

export function difficulty(time: number): Difficulty {
  const t = rampProgress(time)
  return {
    flyInterval: at(S.flyInterval, t),
    maxFlies: Math.round(at(S.maxFlies, t)),
    beeInterval: at(S.beeInterval, t),
    maxBees: Math.round(at(S.maxBees, t)),
    beesActive: time >= S.beeStart,
    flySpeed: at(S.flySpeed, t),
    beeSpeed: at(S.beeSpeed, t),
  }
}

export const drainRate = (time: number) =>
  Math.min(H.drainMax, H.drainStart + H.drainPerSecond * Math.max(0, time))

export const drainHunger = (hunger: number, dt: number, time: number) =>
  Math.max(0, hunger - drainRate(time) * dt)

export const feed = (hunger: number, flies: number) => Math.min(H.max, hunger + H.perFly * flies)

export const sting = (hunger: number) => Math.max(0, hunger - H.sting)

export const revive = (hunger: number) => Math.max(hunger, H.continueTo)

export const isStarved = (hunger: number) => hunger <= 0

export const isCritical = (hunger: number) => hunger > 0 && hunger / H.max <= H.critical
