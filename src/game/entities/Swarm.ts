import { Container } from 'pixi.js'
import { lerp } from '../../lib/math'
import { Rng } from '../../lib/random'
import { CONFIG } from '../config'
import type { Difficulty } from '../rules'
import { Insect, type FlightEnv, type InsectKind, type Zone } from './Insect'

/**
 * Kinds with their own spawn clock, in the order their random numbers are drawn.
 * New kinds go at the end so the existing ones keep drawing the same numbers.
 */
const TIMED = [
  'fly',
  'bee',
  'dragonfly',
  'firefly',
  'moth',
  'ladybug',
  'wasp',
  'spider',
  'beetle',
] as const
type TimedKind = (typeof TIMED)[number]

/** Matches one kind, every prey or hazard kind, or anything (null). */
export type InsectFilter = InsectKind | 'prey' | 'hazard' | null

const matches = (it: Insect, filter: InsectFilter) =>
  filter === null ||
  (filter === 'prey' ? it.isPrey : filter === 'hazard' ? it.isHazard : it.kind === filter)

/** Owns every insect: spawning, pooling, updating and lookups. */
export class Swarm {
  readonly layer = new Container()
  readonly list: Insect[] = []
  /** Called for every new insect, e.g. to play an entrance sound. */
  onSpawn: ((it: Insect) => void) | null = null
  /** Shared with every insect; the game updates it each step. */
  readonly env: FlightEnv = { lure: false, lureX: 0, lureY: 0, lightX: 200, lightY: 300, wind: 0 }
  private readonly pool: Record<InsectKind, Insect[]> = {
    fly: [],
    golden: [],
    dragonfly: [],
    firefly: [],
    moth: [],
    ladybug: [],
    beetle: [],
    bee: [],
    wasp: [],
    spider: [],
  }
  private readonly timers: Record<TimedKind, number> = {
    fly: 0,
    bee: 0,
    dragonfly: 0,
    firefly: 0,
    moth: 0,
    ladybug: 0,
    wasp: 0,
    spider: 0,
    beetle: 0,
  }
  /**
   * One spawn stream per kind. If kinds shared a stream, two kinds coming due
   * in the same sub-step would draw in an order that depends on frame rate.
   */
  private readonly streams = Object.fromEntries(TIMED.map((k) => [k, new Rng(1)])) as Record<
    TimedKind,
    Rng
  >
  private ambient = 0xffffff
  private contrast = false

  /** Reseeds every kind's stream from the run seed. */
  reseed(seed: number) {
    TIMED.forEach((kind, i) => {
      this.streams[kind].reseed(Math.imul(seed ^ Math.imul(i + 1, 0x9e3779b9), 0x85ebca6b) >>> 0)
    })
  }

  reset(firstFly: number) {
    for (const kind of TIMED) this.timers[kind] = 0
    this.timers.fly = firstFly
  }

  /**
   * Every spawn attempt draws the same random numbers whether or not it is
   * capped, so a seeded run spawns the same insects for every player.
   */
  spawnTick(dt: number, rules: Difficulty, zone: Zone) {
    for (const kind of TIMED) {
      const rule = rules[kind]
      if (!rule.active) continue
      this.timers[kind] -= dt
      if (this.timers[kind] > 0) continue
      const rng = this.streams[kind]
      this.timers[kind] = rule.interval * rng.range(0.75, 1.25)
      const roll = rng.float()
      const seed = rng.int(1, 0x7fffffff)
      const speed = rng.range(0.85, 1.15)
      const life = rng.float()

      if (kind === 'fly' && roll < rules.goldenChance && this.count('golden') === 0) {
        this.spawn('golden', seed, zone, rules.goldenSpeed * speed, life)
      } else if (this.count(kind) < rule.max) {
        this.spawn(kind, seed, zone, rule.speed * speed, life)
      }
    }
  }

  update(dt: number, zone: Zone) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const it = this.list[i]
      it.update(dt, zone, this.env)
      if (it.state === 'gone') {
        this.list.splice(i, 1)
        this.layer.removeChild(it.view)
        this.pool[it.kind].push(it)
      }
    }
  }

  sync() {
    for (const it of this.list) it.sync()
  }

  /** Turns the hazard warning rings on or off, for insects now and later. */
  setContrast(on: boolean) {
    this.contrast = on
    for (const it of this.list) it.setContrast(on)
  }

  setAmbient(color: number) {
    if (color === this.ambient) return
    this.ambient = color
    for (const it of this.list) it.setAmbient(color)
  }

  /** Active insects of a kind that still count against the spawn cap. */
  count(kind: InsectKind) {
    let n = 0
    for (const it of this.list)
      if (it.kind === kind && (it.state === 'wander' || it.state === 'flee')) n++
    return n
  }

  nearestFree(filter: InsectFilter, x: number, y: number, inside?: Zone) {
    let best: Insect | null = null
    let bestD = Infinity
    for (const it of this.list) {
      if (!it.free || !matches(it, filter)) continue
      if (inside && (it.x < inside.left - 10 || it.x > inside.right + 10 || it.y < inside.top - 10))
        continue
      const d = (it.x - x) ** 2 + (it.y - y) ** 2
      if (d < bestD) {
        bestD = d
        best = it
      }
    }
    return best
  }

  /**
   * Spawns outside the regular clock (a frenzy). Takes its numbers from `rng`,
   * never the spawn stream, so seeded runs stay the same for everyone.
   */
  spawnExtra(kind: InsectKind, rng: Rng, zone: Zone, speed: number) {
    return this.spawn(
      kind,
      rng.int(1, 0x7fffffff),
      zone,
      speed * rng.range(0.85, 1.15),
      rng.float(),
    )
  }

  /** Sends everything away, used when a run ends or restarts. */
  scatter(zone: Zone, filter: InsectFilter = null) {
    for (const it of this.list) if (matches(it, filter)) it.leave(zone)
  }

  private spawn(kind: InsectKind, seed: number, zone: Zone, speed: number, life01: number) {
    const it = this.pool[kind].pop() ?? new Insect(kind)
    const [minLife, maxLife] = CONFIG.insects[kind].life
    it.setAmbient(this.ambient)
    it.setContrast(this.contrast)
    it.spawn(seed, zone, speed, lerp(minLife, maxLife, life01), this.env)
    this.list.push(it)
    this.layer.addChild(it.view)
    this.onSpawn?.(it)
    return it
  }
}
