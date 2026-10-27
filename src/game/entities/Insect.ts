import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import { TAU, clamp, lerp } from '../../lib/math'
import { createNoise1D } from '../../lib/noise'
import { Rng } from '../../lib/random'
import { Spring } from '../../lib/spring'
import { CONFIG, type Range } from '../config'
import { PALETTE } from '../draw/palette'
import type { PreyKind } from '../rules'

export type InsectKind = PreyKind | 'bee'
export type InsectState = 'wander' | 'leave' | 'flee' | 'caught' | 'gone'

export interface Zone {
  left: number
  right: number
  top: number
  bottom: number
  worldW: number
  worldH: number
}

/** How each kind moves. Speeds come from the spawn rules. */
interface Flight {
  scale: number
  /** How quickly velocity turns towards the target. */
  steer: number
  /** Random wobble added to the velocity. */
  jitter: number
  flapHz: number
  bobHz: number
  hoverChance: number
  hover: Range
  dartChance: number
  retarget: Range
}

const FLIGHT: Record<InsectKind, Flight> = {
  fly: {
    scale: 1.25,
    steer: 4.2,
    jitter: 430,
    flapHz: 26,
    bobHz: 11,
    hoverChance: 0.22,
    hover: [0.25, 0.6],
    dartChance: 0.18,
    retarget: [0.7, 1.7],
  },
  golden: {
    scale: 1.2,
    steer: 5.4,
    jitter: 560,
    flapHz: 32,
    bobHz: 13,
    hoverChance: 0.12,
    hover: [0.15, 0.35],
    dartChance: 0.45,
    retarget: [0.45, 1.1],
  },
  // Dashes in straight lines, stops dead, then darts off at an angle: a zig-zag.
  dragonfly: {
    scale: 1.15,
    steer: 9,
    jitter: 50,
    flapHz: 30,
    bobHz: 4,
    hoverChance: 1,
    hover: [0.22, 0.5],
    dartChance: 0,
    retarget: [0.6, 1],
  },
  firefly: {
    scale: 1.1,
    steer: 1.8,
    jitter: 110,
    flapHz: 16,
    bobHz: 3,
    hoverChance: 0.5,
    hover: [0.5, 1.2],
    dartChance: 0,
    retarget: [1.2, 2.4],
  },
  bee: {
    scale: 1.15,
    steer: 2.3,
    jitter: 130,
    flapHz: 19,
    bobHz: 6,
    hoverChance: 0.45,
    hover: [0.5, 1.3],
    dartChance: 0,
    retarget: [1.4, 3.4],
  },
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
  /** Countdown to the next sparkle, for kinds that leave a trail. */
  trailTimer = 0

  private readonly flight: Flight
  /** Own random stream, reseeded on spawn, so seeded runs fly the same way for everyone. */
  private readonly rng = new Rng(1)
  private readonly wings = new Container()
  private readonly art = new Container()
  /** Parts that give off light. Never tinted by time of day. */
  private readonly lit = new Container()
  private readonly glow: Sprite | null = null
  private readonly seed = seedCounter++ * 17.31
  private readonly facing = new Spring(1, { freq: 3.6, damping: 0.62 })
  private ambient: number = PALETTE.white
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
  private heading = 0
  private zig = 1
  private attachX = 0
  private attachY = 0

  constructor(kind: InsectKind) {
    this.kind = kind
    this.flight = FLIGHT[kind]
    this.hitR = CONFIG.insects[kind].hitRadius
    if (kind === 'firefly' || kind === 'golden') {
      const glow = new Sprite(glowTexture())
      glow.anchor.set(0.5)
      glow.blendMode = 'add'
      glow.tint = kind === 'golden' ? PALETTE.gold : PALETTE.fireflyLight
      this.glow = glow
      this.view.addChild(glow)
    }
    switch (kind) {
      case 'fly':
        drawFly(this.art, this.wings, false)
        break
      case 'golden':
        drawFly(this.art, this.wings, true)
        break
      case 'dragonfly':
        drawDragonfly(this.art, this.wings)
        break
      case 'firefly':
        drawFirefly(this.art, this.wings, this.lit)
        break
      case 'bee':
        drawBee(this.art, this.wings)
    }
    this.view.addChild(this.art, this.lit)
    this.view.visible = false
  }

  get free() {
    return this.state === 'wander' || this.state === 'leave' || this.state === 'flee'
  }

  get isPrey() {
    return this.kind !== 'bee'
  }

  /** Time-of-day tint. Golden flies and glowing parts stay bright. */
  setAmbient(color: number) {
    this.ambient = color
  }

  spawn(seed: number, zone: Zone, speed: number, life: number) {
    const rng = this.rng
    rng.reseed(seed)
    const fromTop = this.kind === 'fly' && rng.chance(0.2)
    const side = rng.sign()
    if (fromTop) {
      this.x = rng.range(zone.left + 30, zone.right - 30)
      this.y = -40
    } else {
      this.x = side < 0 ? -40 : zone.worldW + 40
      // Fireflies rise from the reeds; everything else enters anywhere in the zone.
      const low = this.kind === 'firefly'
      this.y = low
        ? rng.range(zone.bottom - 120, zone.bottom)
        : rng.range(zone.top + 20, zone.bottom - 40)
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
    this.trailTimer = 0
    this.zig = rng.sign()
    this.heading = Math.atan2((zone.top + zone.bottom) / 2 - this.y, zone.worldW / 2 - this.x)
    this.pickTarget(zone)
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

  catchOn(tipX: number, tipY: number) {
    this.state = 'caught'
    this.attachX = clamp(this.x - tipX, -7, 7)
    this.attachY = clamp(this.y - tipY, -7, 7)
    this.spin = this.rng.range(-0.7, 0.7)
  }

  followTip(tipX: number, tipY: number) {
    this.x = tipX + this.attachX
    this.y = tipY + this.attachY
  }

  swallow() {
    this.state = 'gone'
    this.view.visible = false
  }

  update(dt: number, zone: Zone) {
    const f = this.flight
    this.time += dt
    this.age += dt
    this.flap += dt * TAU * f.flapHz
    if (this.angry > 0) this.angry -= dt
    if (Math.abs(this.vx) > 14) this.facing.target = Math.sign(this.vx)
    this.facing.step(dt)
    if (this.state === 'caught' || this.state === 'gone') return

    if (this.state === 'wander' && this.age > this.life) this.leave(zone)
    if (this.state === 'flee') {
      this.fleeTimer -= dt
      if (this.fleeTimer <= 0) {
        this.state = 'wander'
        this.pickTarget(zone)
      }
    }

    const dx = this.wx - this.x
    const dy = this.wy - this.y
    const d = Math.hypot(dx, dy) || 1

    if (this.state === 'wander') {
      this.retarget -= dt
      if (this.hover > 0) this.hover -= dt
      else if (d < 24 || this.retarget <= 0) this.arrive(zone)
    }
    if (this.dart > 0) this.dart -= dt

    let desired = this.speed
    if (this.dart > 0) desired *= 2.3
    if (this.state === 'leave') desired *= 1.6
    if (this.state === 'flee') desired *= 2.4
    if (this.hover > 0) desired *= 0.06
    else if (this.state === 'wander') desired *= clamp(d / 60, 0.35, 1)

    const k = Math.min(1, f.steer * dt)
    this.vx += ((dx / d) * desired - this.vx) * k
    this.vy += ((dy / d) * desired - this.vy) * k

    this.vx += jitterNoise(this.seed + this.time * 4.2) * f.jitter * dt
    this.vy += jitterNoise(this.seed * 1.7 + 50 + this.time * 4.6) * f.jitter * dt

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
    const bob = caught ? 0 : Math.sin(this.time * this.flight.bobHz + this.seed) * 2.2
    this.view.position.set(this.x, this.y + bob)
    const s = this.flight.scale * (caught ? 0.92 : 1)
    this.view.scale.set(this.facing.value * s, s)
    this.wings.scale.y = caught ? 0.3 : 0.32 + 0.68 * Math.abs(Math.sin(this.flap))
    this.view.rotation = caught
      ? this.spin
      : clamp(this.vy * 0.0016, -0.35, 0.35) * Math.sign(this.facing.value || 1)
    const ambient = this.kind === 'golden' ? PALETTE.white : this.ambient
    this.art.tint = this.angry > 0 && Math.sin(this.time * 30) > -0.3 ? 0xffa89a : ambient
    if (this.glow) {
      if (this.kind === 'firefly') {
        // Slow blink with a soft floor, like a real firefly.
        const blink = Math.max(0, Math.sin(this.time * 2.4 + this.seed)) ** 3
        this.glow.alpha = 0.25 + 0.75 * blink
        this.glow.scale.set((0.75 + 0.35 * blink) / this.flight.scale)
        this.glow.position.set(-8, 3)
      } else {
        this.glow.alpha = 0.45 + 0.15 * Math.sin(this.time * 9 + this.seed)
        this.glow.scale.set(0.8 / this.flight.scale)
      }
    }
  }

  private arrive(zone: Zone) {
    const { rng, flight: f } = this
    if (this.retarget > 0 && rng.chance(f.hoverChance)) {
      this.hover = rng.range(f.hover[0], f.hover[1])
      this.retarget = 0
      return
    }
    this.pickTarget(zone)
    if (rng.chance(f.dartChance)) this.dart = 0.32
  }

  private pickTarget(zone: Zone) {
    const { rng, flight: f } = this
    const { left, right, top, bottom, worldW } = zone
    if (this.kind === 'bee') {
      this.wx =
        this.x < worldW / 2 ? rng.range(worldW * 0.55, right) : rng.range(left, worldW * 0.45)
      this.wy = rng.range(top + 40, bottom)
    } else if (this.kind === 'dragonfly') {
      // Turn sharply, alternating sides, and bounce back in from the edges.
      this.zig = -this.zig
      const a = this.heading + this.zig * rng.range(0.85, 1.35)
      const len = rng.range(110, 170)
      let tx = this.x + Math.cos(a) * len
      let ty = this.y + Math.sin(a) * len
      if (tx < left || tx > right) tx = this.x - Math.cos(a) * len
      if (ty < top || ty > bottom) ty = this.y - Math.sin(a) * len
      this.wx = clamp(tx, left, right)
      this.wy = clamp(ty, top, bottom)
      this.heading = Math.atan2(this.wy - this.y, this.wx - this.x)
    } else {
      // Fireflies stay in the lower half, near the water.
      const minY = this.kind === 'firefly' ? lerp(top, bottom, 0.4) : top
      for (let i = 0; i < 4; i++) {
        this.wx = rng.range(left, right)
        this.wy = rng.range(minY, bottom)
        if (Math.hypot(this.wx - this.x, this.wy - this.y) > 70) break
      }
    }
    this.retarget = rng.range(f.retarget[0], f.retarget[1])
  }
}

let glow: Texture | null = null

/** Soft round light, shared by every glowing insect. */
function glowTexture() {
  if (glow) return glow
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255, 255, 255, 0.85)')
  g.addColorStop(0.25, 'rgba(255, 255, 255, 0.4)')
  g.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  glow = Texture.from(canvas)
  return glow
}

function drawFly(art: Container, wings: Container, golden: boolean) {
  const ink = PALETTE.ink
  const bodyColor = golden ? PALETTE.gold : PALETTE.fly
  const headColor = golden ? PALETTE.goldDark : PALETTE.flyHead
  const wingColor = golden ? PALETTE.goldLight : PALETTE.wing
  const body = new Graphics()
  body
    .moveTo(-4, 4)
    .lineTo(-6, 9)
    .moveTo(0, 5)
    .lineTo(0, 10)
    .moveTo(4, 4)
    .lineTo(6, 9)
    .stroke({ width: 1.6, color: ink, cap: 'round' })
  body.ellipse(-2, 0, 9, 6.5).fill(bodyColor).stroke({ width: 2, color: ink })
  body
    .moveTo(-5, -5)
    .quadraticCurveTo(-3, 0, -5, 5)
    .stroke({ width: 1.4, color: golden ? PALETTE.goldDark : 0x5b6274 })
  if (golden) body.ellipse(-4, -2.5, 3.5, 1.6).fill({ color: PALETTE.white, alpha: 0.8 })
  body.circle(7.5, -1, 5.2).fill(headColor).stroke({ width: 2, color: ink })
  body.circle(9.2, -2.4, 3.4).fill(PALETTE.white)
  body.circle(10.2, -2.2, 1.7).fill(ink)

  const w = new Graphics()
  w.ellipse(-6, -5, 7.5, 4.5).fill({ color: wingColor, alpha: 0.78 }).stroke({
    width: 1.5,
    color: ink,
    alpha: 0.55,
  })
  w.ellipse(1, -7, 8.5, 5).fill({ color: wingColor, alpha: 0.85 }).stroke({
    width: 1.5,
    color: ink,
    alpha: 0.55,
  })
  wings.addChild(w)
  wings.position.set(-1, -4)
  art.addChild(body, wings)
}

function drawDragonfly(art: Container, wings: Container) {
  const ink = PALETTE.ink
  const body = new Graphics()
  // Long thin tail with segment rings.
  body.roundRect(-36, -2.6, 34, 5.2, 2.6).fill(PALETTE.dragonfly).stroke({ width: 2, color: ink })
  for (const sx of [-29, -22, -15, -8]) {
    body.moveTo(sx, -2.2).lineTo(sx, 2.2)
  }
  body.stroke({ width: 1.4, color: PALETTE.dragonflyDark })
  body.ellipse(2, 0, 7.5, 5.6).fill(PALETTE.dragonflyDark).stroke({ width: 2, color: ink })
  body.circle(11, -1, 5.6).fill(PALETTE.dragonfly).stroke({ width: 2, color: ink })
  // Big compound eye.
  body.circle(12.6, -2.6, 4.2).fill(PALETTE.dragonflyEye)
  body.circle(13.6, -3.6, 1.4).fill(PALETTE.white)

  const w = new Graphics()
  const wing = { color: PALETTE.wing, alpha: 0.72 }
  const edge = { width: 1.4, color: ink, alpha: 0.5 }
  w.ellipse(-10, -6, 15, 3.6).fill(wing).stroke(edge)
  w.ellipse(-6, -9, 16, 3.8).fill(wing).stroke(edge)
  w.ellipse(-3, -12.5, 14, 3.4).fill(wing).stroke(edge)
  wings.addChild(w)
  wings.position.set(2, -2)
  art.addChild(wings, body)
}

function drawFirefly(art: Container, wings: Container, lit: Container) {
  const ink = PALETTE.ink
  const tail = new Graphics()
  tail.ellipse(-7, 2, 6.5, 5.2).fill(PALETTE.fireflyLight).stroke({ width: 2, color: ink })
  tail.ellipse(-8.5, 0.5, 2.6, 1.6).fill({ color: PALETTE.white, alpha: 0.8 })
  lit.addChild(tail)
  const body = new Graphics()
  body.ellipse(1, -1, 8, 6).fill(PALETTE.firefly).stroke({ width: 2, color: ink })
  body.moveTo(1, -6.5).lineTo(1, 4.5).stroke({ width: 1.3, color: 0x6c6188 })
  body.circle(9, -1, 4.4).fill(0xe0705a).stroke({ width: 2, color: ink })
  body.circle(10.4, -2.2, 2.6).fill(PALETTE.white)
  body.circle(11.1, -2, 1.3).fill(ink)
  body
    .moveTo(11, -5)
    .quadraticCurveTo(14, -10, 17, -10)
    .stroke({ width: 1.4, color: ink, cap: 'round' })

  const w = new Graphics()
  w.ellipse(-2, -6, 7, 4).fill({ color: PALETTE.wing, alpha: 0.75 }).stroke({
    width: 1.4,
    color: ink,
    alpha: 0.5,
  })
  wings.addChild(w)
  wings.position.set(0, -3)
  art.addChild(body, wings)
}

function drawBee(art: Container, wings: Container) {
  const ink = PALETTE.ink
  const body = new Graphics()
  body.poly([-13, -2, -22, 1, -13, 4]).fill(ink)
  body.ellipse(0, 0, 15, 11).fill(PALETTE.bee).stroke({ width: 2.5, color: ink })
  for (const sx of [-7, 0.5]) {
    const hb = 2 * 11 * Math.sqrt(1 - (sx / 15) ** 2) - 3
    body.roundRect(sx - 2.6, -hb / 2, 5.2, hb, 2.4).fill(PALETTE.beeDark)
  }
  body
    .moveTo(13, -8)
    .quadraticCurveTo(15, -16, 20, -17)
    .stroke({ width: 2, color: ink, cap: 'round' })
  body.circle(20, -17, 2.2).fill(ink)
  body.circle(13, -2, 7.5).fill(PALETTE.beeDark).stroke({ width: 2.5, color: ink })
  body.circle(15.5, -3.8, 3.3).fill(PALETTE.white)
  body.circle(16.4, -3.6, 1.7).fill(ink)
  // A tiny frown so bees read as "do not touch".
  body
    .moveTo(12.5, -8.6)
    .lineTo(17.5, -6.8)
    .stroke({ width: 1.8, color: PALETTE.white, cap: 'round' })

  const w = new Graphics()
  w.ellipse(-5, -6, 8, 6).fill({ color: PALETTE.wing, alpha: 0.8 }).stroke({
    width: 1.6,
    color: ink,
    alpha: 0.6,
  })
  w.ellipse(3, -8, 9, 7).fill({ color: PALETTE.wing, alpha: 0.88 }).stroke({
    width: 1.6,
    color: ink,
    alpha: 0.6,
  })
  wings.addChild(w)
  wings.position.set(-2, -9)
  art.addChild(body, wings)
}
