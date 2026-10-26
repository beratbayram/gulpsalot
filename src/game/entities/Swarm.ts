import { Container } from 'pixi.js'
import type { Rng } from '../../lib/random'
import { CONFIG } from '../config'
import { Insect, type InsectKind, type Zone } from './Insect'

export interface SpawnRules {
  flyInterval: number
  maxFlies: number
  beeInterval: number
  maxBees: number
  beesActive: boolean
  flySpeed: number
  beeSpeed: number
}

/** Owns every insect: spawning, pooling, updating and lookups. */
export class Swarm {
  readonly layer = new Container()
  readonly list: Insect[] = []
  private readonly pool: Record<InsectKind, Insect[]> = { fly: [], bee: [] }
  private flyTimer = 0
  private beeTimer = 0
  private readonly rng: Rng

  constructor(rng: Rng) {
    this.rng = rng
  }

  reset(firstFly: number) {
    this.flyTimer = firstFly
    this.beeTimer = 0
  }

  spawnTick(dt: number, rules: SpawnRules, zone: Zone) {
    this.flyTimer -= dt
    if (this.flyTimer <= 0) {
      if (this.count('fly') < rules.maxFlies) this.spawn('fly', rules.flySpeed, zone)
      this.flyTimer = rules.flyInterval * this.rng.range(0.75, 1.25)
    }
    if (!rules.beesActive) return
    this.beeTimer -= dt
    if (this.beeTimer <= 0) {
      if (this.count('bee') < rules.maxBees) this.spawn('bee', rules.beeSpeed, zone)
      this.beeTimer = rules.beeInterval * this.rng.range(0.75, 1.25)
    }
  }

  update(dt: number, zone: Zone) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const it = this.list[i]
      it.update(dt, this.rng, zone)
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

  /** Active insects of a kind that still count against the spawn cap. */
  count(kind: InsectKind) {
    let n = 0
    for (const it of this.list)
      if (it.kind === kind && (it.state === 'wander' || it.state === 'flee')) n++
    return n
  }

  nearestFree(kind: InsectKind | null, x: number, y: number, inside?: Zone) {
    let best: Insect | null = null
    let bestD = Infinity
    for (const it of this.list) {
      if (!it.free || (kind && it.kind !== kind)) continue
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

  /** Sends everything away, used when a run ends or restarts. */
  scatter(zone: Zone, kind?: InsectKind) {
    for (const it of this.list) if (!kind || it.kind === kind) it.leave(zone)
  }

  private spawn(kind: InsectKind, speed: number, zone: Zone) {
    const it = this.pool[kind].pop() ?? new Insect(kind)
    const [minLife, maxLife] = kind === 'fly' ? CONFIG.insects.flyLife : CONFIG.insects.beeLife
    it.spawn(this.rng, zone, speed * this.rng.range(0.85, 1.15), this.rng.range(minLife, maxLife))
    this.list.push(it)
    this.layer.addChild(it.view)
    return it
  }
}
