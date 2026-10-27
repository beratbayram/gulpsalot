import { describe, expect, it } from 'vitest'
import { CONFIG } from './config'
import {
  comboMultiplier,
  difficulty,
  drainHunger,
  drainRate,
  feed,
  isCritical,
  isStarved,
  preyValue,
  rampProgress,
  revive,
  skyPhase,
  sting,
} from './rules'

describe('hunger', () => {
  it('drains faster over time up to a cap', () => {
    expect(drainRate(0)).toBe(CONFIG.hunger.drainStart)
    expect(drainRate(30)).toBeGreaterThan(drainRate(0))
    expect(drainRate(10_000)).toBe(CONFIG.hunger.drainMax)
  })

  it('never drops below zero', () => {
    expect(drainHunger(1, 10, 0)).toBe(0)
  })

  it('feeding is capped at max', () => {
    const fly = CONFIG.prey.fly.food
    expect(feed(50, fly)).toBe(50 + fly)
    expect(feed(95, fly * 3)).toBe(CONFIG.hunger.max)
  })

  it('a sting takes a big bite and can end the run', () => {
    expect(sting(100)).toBe(100 - CONFIG.hunger.sting)
    expect(isStarved(sting(10))).toBe(true)
  })

  it('continue restores to the continue level but never lowers hunger', () => {
    expect(revive(0)).toBe(CONFIG.hunger.continueTo)
    expect(revive(90)).toBe(90)
  })

  it('flags the critical zone but not death', () => {
    expect(isCritical(CONFIG.hunger.max * 0.2)).toBe(true)
    expect(isCritical(CONFIG.hunger.max * 0.5)).toBe(false)
    expect(isCritical(0)).toBe(false)
  })
})

describe('prey', () => {
  it('adds up points and food for one swallow', () => {
    const { fly, golden } = CONFIG.prey
    expect(preyValue(['fly'])).toEqual({ points: fly.points, food: fly.food })
    expect(preyValue(['fly', 'golden'])).toEqual({
      points: fly.points + golden.points,
      food: fly.food + golden.food,
    })
  })

  it('special prey is worth more than a fly', () => {
    for (const kind of ['golden', 'dragonfly', 'firefly'] as const) {
      expect(CONFIG.prey[kind].points).toBeGreaterThan(CONFIG.prey.fly.points)
    }
    expect(CONFIG.prey.golden.points).toBeGreaterThan(CONFIG.prey.dragonfly.points)
  })
})

describe('combo', () => {
  it('starts at x1 and climbs with the chain up to x5', () => {
    expect(comboMultiplier(0)).toBe(1)
    expect(comboMultiplier(1)).toBe(1)
    const [x2, x3, x4, x5] = CONFIG.combo.steps
    expect(comboMultiplier(x2)).toBe(2)
    expect(comboMultiplier(x3)).toBe(3)
    expect(comboMultiplier(x4)).toBe(4)
    expect(comboMultiplier(x5)).toBe(5)
    expect(comboMultiplier(1000)).toBe(5)
  })

  it('a multi-catch counts towards the chain at once', () => {
    expect(comboMultiplier(2)).toBeGreaterThan(comboMultiplier(1))
  })
})

describe('sky', () => {
  it('goes from day to dusk to night and stays there', () => {
    const { duskStart, duskEnd, nightStart, nightEnd } = CONFIG.sky
    expect(skyPhase(0)).toBe(0)
    expect(skyPhase(duskStart)).toBe(0)
    expect(skyPhase(duskEnd)).toBeCloseTo(1)
    expect(skyPhase(nightStart)).toBeCloseTo(1)
    expect(skyPhase(nightEnd)).toBeCloseTo(2)
    expect(skyPhase(10_000)).toBeCloseTo(2)
  })

  it('never gets lighter as time passes', () => {
    let prev = skyPhase(0)
    for (let t = 1; t <= 200; t++) {
      expect(skyPhase(t)).toBeGreaterThanOrEqual(prev)
      prev = skyPhase(t)
    }
  })
})

describe('difficulty', () => {
  it('ramps from 0 to 1 and stays there', () => {
    expect(rampProgress(0)).toBe(0)
    expect(rampProgress(CONFIG.spawn.rampTime)).toBeCloseTo(1)
    expect(rampProgress(CONFIG.spawn.rampTime * 5)).toBeCloseTo(1)
  })

  it('is monotonic: never gets easier as time passes', () => {
    let prev = difficulty(0)
    for (let t = 1; t <= 200; t += 1) {
      const d = difficulty(t)
      expect(d.fly.interval).toBeLessThanOrEqual(prev.fly.interval + 1e-9)
      expect(d.bee.interval).toBeLessThanOrEqual(prev.bee.interval + 1e-9)
      expect(d.bee.max).toBeGreaterThanOrEqual(prev.bee.max)
      expect(d.fly.speed).toBeGreaterThanOrEqual(prev.fly.speed)
      expect(d.dragonfly.interval).toBeLessThanOrEqual(prev.dragonfly.interval + 1e-9)
      prev = d
    }
  })

  it('keeps bees away at the start and caps everything at the end', () => {
    expect(difficulty(0).bee.active).toBe(false)
    expect(difficulty(CONFIG.spawn.beeStart).bee.active).toBe(true)
    const end = difficulty(10_000)
    expect(end.bee.max).toBe(CONFIG.spawn.maxBees[1])
    expect(end.fly.max).toBe(CONFIG.spawn.maxFlies[1])
    expect(end.fly.interval).toBeCloseTo(CONFIG.spawn.flyInterval[1])
  })

  it('brings in special insects over time', () => {
    const start = difficulty(0)
    expect(start.goldenChance).toBe(0)
    expect(start.dragonfly.active).toBe(false)
    expect(start.firefly.active).toBe(false)

    expect(difficulty(CONFIG.spawn.golden.start).goldenChance).toBeGreaterThan(0)
    expect(difficulty(CONFIG.spawn.dragonfly.start).dragonfly.active).toBe(true)
    // Fireflies wait for the night.
    expect(difficulty(CONFIG.sky.duskEnd).firefly.active).toBe(false)
    expect(difficulty(CONFIG.sky.nightEnd).firefly.active).toBe(true)
  })

  it('golden flies stay rare and fast', () => {
    const end = difficulty(10_000)
    expect(end.goldenChance).toBeLessThan(0.1)
    expect(end.goldenSpeed).toBeGreaterThan(end.fly.speed)
  })
})
