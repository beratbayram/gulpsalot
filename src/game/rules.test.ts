import { describe, expect, it } from 'vitest'
import { CONFIG } from './config'
import {
  difficulty,
  drainHunger,
  drainRate,
  feed,
  isCritical,
  isStarved,
  rampProgress,
  revive,
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
    expect(feed(50, 1)).toBe(50 + CONFIG.hunger.perFly)
    expect(feed(95, 3)).toBe(CONFIG.hunger.max)
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
      expect(d.flyInterval).toBeLessThanOrEqual(prev.flyInterval + 1e-9)
      expect(d.beeInterval).toBeLessThanOrEqual(prev.beeInterval + 1e-9)
      expect(d.maxBees).toBeGreaterThanOrEqual(prev.maxBees)
      expect(d.flySpeed).toBeGreaterThanOrEqual(prev.flySpeed)
      prev = d
    }
  })

  it('keeps bees away at the start and caps everything at the end', () => {
    expect(difficulty(0).beesActive).toBe(false)
    expect(difficulty(CONFIG.spawn.beeStart).beesActive).toBe(true)
    const end = difficulty(10_000)
    expect(end.maxBees).toBe(CONFIG.spawn.maxBees[1])
    expect(end.maxFlies).toBe(CONFIG.spawn.maxFlies[1])
    expect(end.flyInterval).toBeCloseTo(CONFIG.spawn.flyInterval[1])
  })
})
