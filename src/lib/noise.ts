import { mulberry32 } from './random'

export type Noise1D = (x: number) => number

/**
 * Seeded 1D gradient noise, roughly in [-1, 1].
 * Smooth enough for wandering insects, screen shake and wind.
 */
export function createNoise1D(seed = 1): Noise1D {
  const rand = mulberry32(seed)
  const grads = new Float32Array(256)
  for (let i = 0; i < grads.length; i++) grads[i] = rand() * 2 - 1

  return (x: number) => {
    const i0 = Math.floor(x)
    const t = x - i0
    const g0 = grads[i0 & 255]
    const g1 = grads[(i0 + 1) & 255]
    const d0 = g0 * t
    const d1 = g1 * (t - 1)
    const fade = t * t * t * (t * (t * 6 - 15) + 10)
    return (d0 + (d1 - d0) * fade) * 2
  }
}
