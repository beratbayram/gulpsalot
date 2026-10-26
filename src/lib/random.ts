/** Small, fast seeded PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Rng {
  private readonly next: () => number

  constructor(seed = Date.now()) {
    this.next = mulberry32(seed)
  }

  float() {
    return this.next()
  }

  range(min: number, max: number) {
    return min + (max - min) * this.next()
  }

  int(min: number, max: number) {
    return Math.floor(this.range(min, max + 1))
  }

  chance(p: number) {
    return this.next() < p
  }

  sign() {
    return this.next() < 0.5 ? -1 : 1
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]
  }
}
