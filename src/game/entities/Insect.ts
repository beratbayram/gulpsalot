import { Container, Sprite, type Texture } from 'pixi.js'
import { TAU, clamp } from '../../lib/math'
import { createNoise1D } from '../../lib/noise'
import type { Rng } from '../../lib/random'
import { Spring } from '../../lib/spring'
import { CONFIG } from '../config'
import { PALETTE } from '../draw/palette'
import { getInsectArt } from './insectArt'

export type InsectKind = 'fly' | 'bee'
export type InsectState = 'wander' | 'leave' | 'flee' | 'caught' | 'gone'

export interface Zone {
  left: number
  right: number
  top: number
  bottom: number
  worldW: number
  worldH: number
}

const jitterNoise = createNoise1D(99)
let seedCounter = 1

export class Insect {
  readonly view = new Container()
  readonly kind: InsectKind
  readonly hitR: number
  x = 0
  y = 0
  vx = 0
  vy = 0
  speed = 80
  age = 0
  life = 8
  state: InsectState = 'gone'
  /** Bees can't sting again until this game time. */
  safeUntil = 0

  private readonly art = new Container()
  private readonly wings: Sprite[] = []
  private readonly wingBase: number[] = []
  private readonly blur: Sprite
  private readonly baseScale: number
  private readonly seed = seedCounter++ * 17.31
  private readonly facing = new Spring(1, { freq: 3.6, damping: 0.62 })
  private wx = 0
  private wy = 0
  private retarget = 0
  private dart = 0
  private hover = 0
  private fleeTimer = 0
  private angry = 0
  private flap = 0
  private time = 0
  private spin = 0
  private attachX = 0
  private attachY = 0

  constructor(kind: InsectKind) {
    this.kind = kind
    this.hitR = kind === 'fly' ? CONFIG.insects.flyHitRadius : CONFIG.insects.beeHitRadius
    this.baseScale = 1
    const art = getInsectArt()[kind]
    const body = new Sprite(art.body)
    body.anchor.set(art.bodyAnchor.x, art.bodyAnchor.y)
    this.blur = makeWing(art.blur, art.wingRoot, 0)
    this.blur.anchor.set(0.5)
    this.blur.position.set(art.wingRoot.x - 5, art.wingRoot.y - 3)
    this.art.addChild(body)
    // Far wing behind the near one, both rooted on the thorax.
    for (const [angle, alpha] of art.wingAngles) {
      const w = makeWing(art.wing, art.wingRoot, angle)
      w.alpha = alpha
      this.wings.push(w)
      this.wingBase.push(angle)
      this.art.addChild(w)
    }
    this.art.addChild(this.blur)
    this.view.addChild(this.art)
    this.view.visible = false
  }

  get free() {
    return this.state === 'wander' || this.state === 'leave' || this.state === 'flee'
  }

  spawn(rng: Rng, zone: Zone, speed: number, life: number) {
    const fromTop = this.kind === 'fly' && rng.chance(0.2)
    const side = rng.sign()
    if (fromTop) {
      this.x = rng.range(zone.left + 30, zone.right - 30)
      this.y = -40
    } else {
      this.x = side < 0 ? -40 : zone.worldW + 40
      this.y = rng.range(zone.top + 20, zone.bottom - 40)
    }
    this.state = 'wander'
    this.age = 0
    this.life = life
    this.speed = speed
    this.dart = 0
    this.hover = 0
    this.angry = 0
    this.fleeTimer = 0
    this.safeUntil = 0
    this.pickTarget(rng, zone)
    const dx = this.wx - this.x
    const dy = this.wy - this.y
    const d = Math.hypot(dx, dy) || 1
    this.vx = (dx / d) * speed
    this.vy = (dy / d) * speed
    this.facing.snap(Math.sign(this.vx) || 1)
    this.view.visible = true
    this.view.alpha = 1
    this.view.rotation = 0
  }

  leave(zone: Zone) {
    if (!this.free) return
    this.state = 'leave'
    this.hover = 0
    this.wx = this.x < zone.worldW / 2 ? -120 : zone.worldW + 120
    this.wy = this.y - 80
  }

  /** Knocked away after stinging the tongue. */
  flee(fromX: number, fromY: number, time: number) {
    this.state = 'flee'
    this.fleeTimer = 0.7
    this.angry = 1.3
    this.safeUntil = time + 1.1
    this.hover = 0
    const dx = this.x - fromX
    const dy = this.y - fromY
    const d = Math.hypot(dx, dy) || 1
    this.vx = (dx / d) * 380
    this.vy = (dy / d) * 380 - 60
    this.wx = this.x + (dx / d) * 180
    this.wy = this.y + (dy / d) * 180 - 60
  }

  catchOn(tipX: number, tipY: number, rng: Rng) {
    this.state = 'caught'
    this.attachX = clamp(this.x - tipX, -7, 7)
    this.attachY = clamp(this.y - tipY, -7, 7)
    this.spin = rng.range(-0.7, 0.7)
  }

  followTip(tipX: number, tipY: number) {
    this.x = tipX + this.attachX
    this.y = tipY + this.attachY
  }

  swallow() {
    this.state = 'gone'
    this.view.visible = false
  }

  update(dt: number, rng: Rng, zone: Zone) {
    this.time += dt
    this.age += dt
    this.flap += dt * TAU * (this.kind === 'fly' ? 26 : 19)
    if (this.angry > 0) this.angry -= dt
    if (Math.abs(this.vx) > 14) this.facing.target = Math.sign(this.vx)
    this.facing.step(dt)
    if (this.state === 'caught' || this.state === 'gone') return

    if (this.state === 'wander' && this.age > this.life) this.leave(zone)
    if (this.state === 'flee') {
      this.fleeTimer -= dt
      if (this.fleeTimer <= 0) {
        this.state = 'wander'
        this.pickTarget(rng, zone)
      }
    }

    const dx = this.wx - this.x
    const dy = this.wy - this.y
    const d = Math.hypot(dx, dy) || 1

    if (this.state === 'wander') {
      this.retarget -= dt
      if (this.hover > 0) this.hover -= dt
      else if (d < 24 || this.retarget <= 0) this.arrive(rng, zone)
    }
    if (this.dart > 0) this.dart -= dt

    let desired = this.speed
    if (this.dart > 0) desired *= 2.3
    if (this.state === 'leave') desired *= 1.6
    if (this.state === 'flee') desired *= 2.4
    if (this.hover > 0) desired *= 0.06
    else if (this.state === 'wander') desired *= clamp(d / 60, 0.35, 1)

    const steer = this.kind === 'fly' ? 4.2 : 2.3
    const k = Math.min(1, steer * dt)
    this.vx += ((dx / d) * desired - this.vx) * k
    this.vy += ((dy / d) * desired - this.vy) * k

    const jitter = this.kind === 'fly' ? 430 : 130
    this.vx += jitterNoise(this.seed + this.time * 4.2) * jitter * dt
    this.vy += jitterNoise(this.seed * 1.7 + 50 + this.time * 4.6) * jitter * dt

    this.x += this.vx * dt
    this.y += this.vy * dt

    // Soft walls while wandering so nobody drifts under the HUD or onto Pofik.
    if (this.state === 'wander' && this.age > 1.2) {
      if (this.y > zone.bottom) this.vy -= (this.y - zone.bottom) * 8 * dt
      if (this.y < zone.top) this.vy += (zone.top - this.y) * 8 * dt
    }

    if (this.state === 'leave') {
      const out =
        this.x < -80 || this.x > zone.worldW + 80 || this.y < -100 || this.y > zone.worldH + 80
      if (out) {
        this.state = 'gone'
        this.view.visible = false
      }
    }
  }

  sync() {
    if (this.state === 'gone') return
    const caught = this.state === 'caught'
    const bob = caught ? 0 : Math.sin(this.time * (this.kind === 'fly' ? 11 : 6) + this.seed) * 2.2
    this.view.position.set(this.x, this.y + bob)
    const s = this.baseScale * (caught ? 0.92 : 1)
    this.view.scale.set(this.facing.value * s, s)
    // Real wings beat far faster than the frame rate: show a soft blur disc plus
    // a wing caught at a random-looking phase each frame.
    const beat = Math.sin(this.flap)
    this.wings.forEach((w, i) => {
      w.rotation = caught ? this.wingBase[i] * 0.4 + 0.2 : this.wingBase[i] - beat * 0.75
      w.scale.y = caught ? 0.8 : 0.7 + 0.3 * Math.abs(Math.cos(this.flap))
    })
    this.blur.visible = !caught
    this.blur.alpha = 0.35 + 0.15 * Math.abs(beat)
    this.view.rotation = caught
      ? this.spin
      : clamp(this.vy * 0.0016, -0.35, 0.35) * Math.sign(this.facing.value || 1)
    this.art.tint = this.angry > 0 && Math.sin(this.time * 30) > -0.3 ? 0xffb8a8 : PALETTE.white
  }

  private arrive(rng: Rng, zone: Zone) {
    const hoverChance = this.kind === 'fly' ? 0.22 : 0.45
    if (this.retarget > 0 && rng.chance(hoverChance)) {
      this.hover = this.kind === 'fly' ? rng.range(0.25, 0.6) : rng.range(0.5, 1.3)
      this.retarget = 0
      return
    }
    this.pickTarget(rng, zone)
    if (this.kind === 'fly' && rng.chance(0.18)) this.dart = 0.32
  }

  private pickTarget(rng: Rng, zone: Zone) {
    const { left, right, top, bottom, worldW } = zone
    if (this.kind === 'bee') {
      this.wx =
        this.x < worldW / 2 ? rng.range(worldW * 0.55, right) : rng.range(left, worldW * 0.45)
      this.wy = rng.range(top + 40, bottom)
    } else {
      for (let i = 0; i < 4; i++) {
        this.wx = rng.range(left, right)
        this.wy = rng.range(top, bottom)
        if (Math.hypot(this.wx - this.x, this.wy - this.y) > 70) break
      }
    }
    this.retarget = rng.range(0.7, 1.7) * (this.kind === 'bee' ? 2 : 1)
  }
}

function makeWing(texture: Texture, root: { x: number; y: number }, angle: number) {
  const w = new Sprite(texture)
  w.anchor.set(0, 0.5)
  w.position.set(root.x, root.y)
  w.rotation = angle
  return w
}
