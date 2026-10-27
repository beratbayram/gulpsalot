import { clamp, invLerp } from '../lib/math'
import { createNoise1D } from '../lib/noise'
import { mulberry32 } from '../lib/random'
import { CONFIG } from './config'

export type Weather = keyof typeof CONFIG.weather.odds

export const WEATHERS = Object.keys(CONFIG.weather.odds) as Weather[]

/**
 * The weather for a run seed. Uses its own generator, never the spawn stream,
 * so everyone playing the same seed (the daily) gets the same weather.
 */
export function pickWeather(seed: number): Weather {
  const roll = mulberry32(seed ^ 0x6a09e667)()
  let sum = 0
  for (const kind of WEATHERS) {
    sum += CONFIG.weather.odds[kind]
    if (roll < sum) return kind
  }
  return 'clear'
}

/** Which way the wind blows for a run: -1 (to the left) or 1. */
export const windSide = (seed: number) => (mulberry32(seed ^ 0x3c6ef372)() < 0.5 ? -1 : 1)

const gusts = createNoise1D(41)

/** Sideways push at a moment of a windy run, gusting smoothly over time. */
export function windAt(time: number, side: number) {
  const { base, gust } = CONFIG.weather.wind
  const g = 0.5 + 0.5 * gusts(time * 0.22)
  return side * (base + gust * g * g)
}

/** How thick the morning fog is: 1 at the start of a run, thinning to a light haze. */
export function fogAt(runTime: number) {
  const [from, to] = CONFIG.weather.fogLift
  return 1 - 0.8 * clamp(invLerp(from, to, runTime), 0, 1)
}
