import { describe, expect, it } from 'vitest'
import { StepClock } from '../game/clock'
import { clamp, distSqPointSegment, mixColor, remap, segmentsIntersect, sweptHit } from './math'
import { createNoise1D } from './noise'
import { Rng } from './random'
import { Spring, Spring2 } from './spring'

const run = (spring: Spring, seconds: number, dt = 1 / 120) => {
  let peak = spring.value
  for (let t = 0; t < seconds; t += dt) {
    spring.step(dt)
    peak = Math.max(peak, spring.value)
  }
  return peak
}

describe('Spring', () => {
  it('converges on its target', () => {
    const s = new Spring(0, { freq: 4, damping: 0.6 })
    s.target = 100
    run(s, 2)
    expect(s.value).toBeCloseTo(100, 1)
    expect(s.isSettled(0.05)).toBe(true)
  })

  it('overshoots when underdamped and not when critically damped', () => {
    const under = new Spring(0, { freq: 4, damping: 0.5 })
    under.target = 1
    const critical = new Spring(0, { freq: 4, damping: 1 })
    critical.target = 1
    // Theory: overshoot for damping 0.5 is about 16%.
    const peak = run(under, 1)
    expect(peak).toBeGreaterThan(1.1)
    expect(peak).toBeLessThan(1.2)
    expect(run(critical, 1)).toBeLessThanOrEqual(1.0001)
  })

  it('stays stable at the stiffest settings the game uses', () => {
    const s = new Spring(0, { freq: 12, damping: 0.4 })
    s.target = 500
    run(s, 3)
    expect(Number.isFinite(s.value)).toBe(true)
    expect(s.value).toBeCloseTo(500, 0)
  })

  it('works in 2D', () => {
    const s = new Spring2(0, 0, { freq: 5, damping: 0.8 })
    s.setTarget(30, -40)
    for (let i = 0; i < 240; i++) s.step(1 / 120)
    expect(s.x).toBeCloseTo(30, 1)
    expect(s.y).toBeCloseTo(-40, 1)
  })
})

describe('math', () => {
  it('clamps and remaps', () => {
    expect(clamp(5, 0, 1)).toBe(1)
    expect(remap(5, 0, 10, 100, 200)).toBe(150)
    expect(remap(50, 0, 10, 100, 200)).toBe(200)
  })

  it('measures point to segment distance', () => {
    expect(distSqPointSegment(5, 3, 0, 0, 10, 0)).toBe(9)
    expect(distSqPointSegment(-4, 3, 0, 0, 10, 0)).toBe(25)
  })

  it('catches fast movers that would tunnel past a target between frames', () => {
    // The tip jumps 200 units in one step, straight through a fly at x=100.
    expect(sweptHit(0, 0, 200, 0, 100, 10, 15)).toBe(true)
    expect(sweptHit(0, 0, 200, 0, 100, 40, 15)).toBe(false)
  })

  it('detects crossing segments', () => {
    expect(segmentsIntersect(0, 0, 10, 10, 0, 10, 10, 0)).toBe(true)
    expect(segmentsIntersect(0, 0, 10, 0, 0, 5, 10, 5)).toBe(false)
    expect(segmentsIntersect(0, 0, 4, 4, 6, 0, 10, -4)).toBe(false)
  })

  it('mixes colors', () => {
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080)
    expect(mixColor(0xff0000, 0x0000ff, 0)).toBe(0xff0000)
  })
})

describe('noise and rng', () => {
  it('is deterministic per seed and bounded', () => {
    const a = createNoise1D(7)
    const b = createNoise1D(7)
    for (let x = 0; x < 50; x += 0.37) {
      expect(a(x)).toBe(b(x))
      expect(Math.abs(a(x))).toBeLessThanOrEqual(1.01)
    }
  })

  it('produces repeatable sequences', () => {
    const a = new Rng(42)
    const b = new Rng(42)
    const seqA = Array.from({ length: 5 }, () => a.range(0, 10))
    const seqB = Array.from({ length: 5 }, () => b.range(0, 10))
    expect(seqA).toEqual(seqB)
    expect(seqA.every((v) => v >= 0 && v < 10)).toBe(true)
  })
})

describe('StepClock', () => {
  it('splits frames into sub-steps no longer than maxStep', () => {
    const clock = new StepClock()
    const steps: number[] = []
    clock.advance(1 / 60, (dt) => steps.push(dt))
    expect(steps).toHaveLength(2)
    steps.forEach((dt) => expect(dt).toBeLessThanOrEqual(clock.maxStep + 1e-9))
  })

  it('handles 90 Hz frames with equal steps', () => {
    const clock = new StepClock()
    const steps: number[] = []
    clock.advance(1 / 90, (dt) => steps.push(dt))
    expect(steps).toHaveLength(2)
    expect(steps[0]).toBeCloseTo(1 / 180)
  })

  it('drops huge frames instead of spiralling', () => {
    const clock = new StepClock()
    let total = 0
    const simulated = clock.advance(5, (dt) => (total += dt))
    expect(simulated).toBeCloseTo(clock.maxFrame)
    expect(total).toBeCloseTo(clock.maxFrame)
  })

  it('freezes during hit-stop', () => {
    const clock = new StepClock()
    clock.hitStopFor(0.05)
    let steps = 0
    clock.advance(0.03, () => steps++)
    expect(steps).toBe(0)
    expect(clock.frozen).toBe(true)
    clock.advance(0.03, () => steps++)
    expect(clock.frozen).toBe(false)
    expect(steps).toBeGreaterThan(0)
  })
})
