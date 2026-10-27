import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import { TAU, clamp, lerp } from '../../lib/math'
import { createNoise1D } from '../../lib/noise'
import { Rng } from '../../lib/random'
import { Spring } from '../../lib/spring'
import { CONFIG, type Range } from '../config'
import { PALETTE } from '../draw/palette'
import { POWERS, type HazardKind, type PowerKind, type PreyKind } from '../rules'

export type InsectKind = PreyKind | HazardKind
export type InsectState = 'wander' | 'leave' | 'flee' | 'caught' | 'gone'

const HAZARDS: readonly InsectKind[] = ['bee', 'wasp', 'spider']

export const isHazardKind = (kind: InsectKind): kind is HazardKind => HAZARDS.includes(kind)

export interface Zone {
  left: number
  right: number
  top: number
  bottom: number
  worldW: number
  worldH: number
}

/** What insects react to besides their own wandering. Updated by the game every step. */
export interface FlightEnv {
  /** The tongue tip while it is out, which wasps chase. */
  lure: boolean
  lureX: number
  lureY: number
  /** The light moths circle around. */
  lightX: number
  lightY: number
  /** Sideways push from the weather, in world units per second squared. */
  wind: number
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
  // Erratic loops around a light.
  moth: {
    scale: 1.1,
    steer: 3.2,
    jitter: 380,
    flapHz: 13,
    bobHz: 7,
    hoverChance: 0.05,
    hover: [0.1, 0.25],
    dartChance: 0.3,
    retarget: [0.25, 0.55],
  },
  // Bumbles along slowly, easy to spot.
  beetle: {
    scale: 1.15,
    steer: 2.2,
    jitter: 160,
    flapHz: 20,
    bobHz: 4,
    hoverChance: 0.35,
    hover: [0.4, 0.9],
    dartChance: 0,
    retarget: [1.1, 2.2],
  },
  ladybug: {
    scale: 1.1,
    steer: 2.6,
    jitter: 200,
    flapHz: 22,
    bobHz: 5,
    hoverChance: 0.4,
    hover: [0.4, 1],
    dartChance: 0,
    retarget: [1, 2.2],
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
  wasp: {
    scale: 1.1,
    steer: 3.6,
    jitter: 220,
    flapHz: 24,
    bobHz: 8,
    hoverChance: 0.3,
    hover: [0.3, 0.8],
    dartChance: 0.25,
    retarget: [0.9, 2],
  },
  // Spiders hang on silk and move on their own (see `updateSpider`); only the leg wiggle is used.
  spider: {
    scale: 1,
    steer: 0,
    jitter: 0,
    flapHz: 3,
    bobHz: 0,
    hoverChance: 0,
    hover: [0, 0],
    dartChance: 0,
    retarget: [1, 1],
  },
}

const CALM_ENV: FlightEnv = { lure: false, lureX: 0, lureY: 0, lightX: 200, lightY: 300, wind: 0 }

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
  /** What a power-up beetle does when eaten. Picked on spawn. */
  power: PowerKind = 'frenzy'

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
  private env: FlightEnv = CALM_ENV
  /** Moths: angle around the light. */
  private orbit = 0
  /** Spiders: where the thread hangs from and how deep the spider drops. */
  private anchorX = 0
  private depth = 0
  private swing = 0
  private pluckAmp = 0
  private readonly silk: Graphics | null = null
  /** Hazards: a bold warning ring for the high-contrast option. */
  private readonly marker: Graphics | null = null
  /** Beetles: one shell per power, only the current one visible. */
  private readonly shells: Partial<Record<PowerKind, Container>> = {}

  constructor(kind: InsectKind) {
    this.kind = kind
    this.flight = FLIGHT[kind]
    this.hitR = CONFIG.insects[kind].hitRadius
    if (kind === 'firefly' || kind === 'golden' || kind === 'beetle') {
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
      case 'moth':
        drawMoth(this.art, this.wings)
        break
      case 'ladybug':
        drawLadybug(this.art, this.wings)
        break
      case 'beetle':
        drawBeetle(this.art, this.wings, this.shells)
        break
      case 'bee':
        drawBee(this.art, this.wings)
        break
      case 'wasp':
        drawWasp(this.art, this.wings)
        break
      case 'spider':
        this.silk = new Graphics()
        this.view.addChild(this.silk)
        drawSpider(this.art, this.wings)
    }
    if (isHazardKind(kind)) {
      const r = this.hitR + 13
      const ring = new Graphics()
      ring.circle(0, kind === 'spider' ? 1 : 0, r).stroke({ width: 6, color: PALETTE.white })
      ring.circle(0, kind === 'spider' ? 1 : 0, r).stroke({ width: 3, color: PALETTE.sting })
      ring.visible = false
      this.marker = ring
      this.view.addChildAt(ring, 0)
    }
    this.view.addChild(this.art, this.lit)
    this.view.visible = false
  }

  /** High-contrast mode: hazards get a white and red ring, so they never pass for prey. */
  setContrast(on: boolean) {
    if (this.marker) this.marker.visible = on
  }

  get free() {
    return this.state === 'wander' || this.state === 'leave' || this.state === 'flee'
  }

  get isPrey() {
    return !isHazardKind(this.kind)
  }

  get isHazard() {
    return isHazardKind(this.kind)
  }

  /** Spiders: the silk thread, from above the screen down to the spider. */
  thread() {
    return { x0: this.anchorX, y0: CONFIG.spider.threadTop, x1: this.x, y1: this.y - 12 }
  }

  /** Spiders: the tongue brushed the silk, so the thread twangs. */
  pluck() {
    this.pluckAmp = 26
  }

  /** Time-of-day tint. Golden flies and glowing parts stay bright. */
  setAmbient(color: number) {
    this.ambient = color
  }

  spawn(seed: number, zone: Zone, speed: number, life: number, env: FlightEnv) {
    const rng = this.rng
    rng.reseed(seed)
    this.env = env
    const fromTop = this.kind === 'fly' && rng.chance(0.2)
    const side = rng.sign()
    if (this.kind === 'spider') {
      this.anchorX = rng.range(zone.left + 40, zone.right - 40)
      this.depth = rng.range(zone.top + 70, zone.bottom - 40)
      this.swing = rng.range(0, TAU)
      this.x = this.anchorX
      this.y = CONFIG.spider.threadTop + 10
    } else if (fromTop) {
      this.x = rng.range(zone.left + 30, zone.right - 30)
      this.y = -40
    } else {
      this.x = side < 0 ? -40 : zone.worldW + 40
      // Fireflies rise from the reeds, moths come in high (then head for the light),
      // the rest anywhere. Entry points never depend on decorations, so seeded runs match.
      if (this.kind === 'firefly') this.y = rng.range(zone.bottom - 120, zone.bottom)
      else if (this.kind === 'moth')
        this.y = rng.range(zone.top + 20, lerp(zone.top, zone.bottom, 0.5))
      else this.y = rng.range(zone.top + 20, zone.bottom - 40)
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
    this.pluckAmp = 0
    this.zig = rng.sign()
    this.orbit = Math.atan2(this.y - env.lightY, this.x - env.lightX)
    if (this.kind === 'beetle') {
      this.power = rng.pick(POWERS)
      for (const p of POWERS) this.shells[p]!.visible = p === this.power
      if (this.glow) this.glow.tint = POWER_COLORS[this.power]
    }
    this.heading = Math.atan2((zone.top + zone.bottom) / 2 - this.y, zone.worldW / 2 - this.x)
    this.pickTarget(zone)
    const dx = this.wx - this.x
    const dy = this.wy - this.y
    const d = Math.hypot(dx, dy) || 1
    this.vx = (dx / d) * speed
    this.vy = (dy / d) * speed
    this.facing.snap(Math.sign(this.vx) || 1)
    if (this.kind === 'spider') {
      this.vx = 0
      this.vy = speed
    }
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

  /** Knocked away after stinging the tongue. Spiders climb back up instead. */
  flee(fromX: number, fromY: number, time: number) {
    this.state = 'flee'
    this.fleeTimer = 0.7
    this.angry = 1.3
    this.safeUntil = time + 1.1
    this.hover = 0
    if (this.kind === 'spider') return
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

  update(dt: number, zone: Zone, env: FlightEnv) {
    const f = this.flight
    this.env = env
    this.time += dt
    this.age += dt
    this.flap += dt * TAU * f.flapHz
    if (this.angry > 0) this.angry -= dt
    if (Math.abs(this.vx) > 14) this.facing.target = Math.sign(this.vx)
    this.facing.step(dt)
    if (this.state === 'caught' || this.state === 'gone') return
    if (this.kind === 'spider') {
      this.updateSpider(dt)
      return
    }

    if (this.state === 'wander' && this.age > this.life) this.leave(zone)
    if (this.state === 'flee') {
      this.fleeTimer -= dt
      if (this.fleeTimer <= 0) {
        this.state = 'wander'
        this.pickTarget(zone)
      }
    }

    // Wasps go for the tongue tip while it is out.
    let lured = false
    if (this.kind === 'wasp' && env.lure && this.state === 'wander') {
      const range = CONFIG.wasp.lureRange
      if ((env.lureX - this.x) ** 2 + (env.lureY - this.y) ** 2 < range * range) {
        this.wx = env.lureX
        this.wy = env.lureY
        this.hover = 0
        lured = true
      }
    }

    const dx = this.wx - this.x
    const dy = this.wy - this.y
    const d = Math.hypot(dx, dy) || 1

    if (this.state === 'wander' && !lured) {
      this.retarget -= dt
      if (this.hover > 0) this.hover -= dt
      else if (d < 24 || this.retarget <= 0) this.arrive(zone)
    }
    if (this.dart > 0) this.dart -= dt

    let desired = this.speed
    if (this.dart > 0) desired *= 2.3
    if (this.state === 'leave') desired *= 1.6
    if (this.state === 'flee') desired *= 2.4
    if (lured) desired *= CONFIG.wasp.lureSpeed
    else if (this.hover > 0) desired *= 0.06
    else if (this.state === 'wander') desired *= clamp(d / 60, 0.35, 1)

    const k = Math.min(1, f.steer * dt)
    this.vx += ((dx / d) * desired - this.vx) * k
    this.vy += ((dy / d) * desired - this.vy) * k

    this.vx += jitterNoise(this.seed + this.time * 4.2) * f.jitter * dt
    this.vy += jitterNoise(this.seed * 1.7 + 50 + this.time * 4.6) * f.jitter * dt
    this.vx += env.wind * dt

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
    if (this.kind === 'spider') {
      this.syncSpider()
      return
    }
    const caught = this.state === 'caught'
    const bob = caught ? 0 : Math.sin(this.time * this.flight.bobHz + this.seed) * 2.2
    this.view.position.set(this.x, this.y + bob)
    const s = this.flight.scale * (caught ? 0.92 : 1)
    this.view.scale.set(this.facing.value * s, s)
    this.wings.scale.y = caught ? 0.3 : 0.32 + 0.68 * Math.abs(Math.sin(this.flap))
    this.view.rotation = caught
      ? this.spin
      : clamp(this.vy * 0.0016, -0.35, 0.35) * Math.sign(this.facing.value || 1)
    const ambient = this.kind === 'golden' || this.kind === 'beetle' ? PALETTE.white : this.ambient
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

  /** Drops on its thread, dangles and sways, then climbs back up and out. */
  private updateSpider(dt: number) {
    if (this.state === 'wander' && this.age > this.life) this.state = 'leave'
    const climbing = this.state !== 'wander'
    const targetY = climbing ? CONFIG.spider.threadTop - 40 : this.depth
    const speed = this.speed * (this.state === 'flee' ? 3.2 : climbing ? 1.4 : 1)
    const prevX = this.x
    this.vy = clamp((targetY - this.y) * 2.6, -speed, speed)
    this.y += this.vy * dt
    this.swing += dt * 1.5
    this.pluckAmp = Math.max(0, this.pluckAmp - dt * 22)
    const hang = clamp((this.y - CONFIG.spider.threadTop) / 260, 0, 1)
    this.x = this.anchorX + (Math.sin(this.swing + this.seed) * 9 + this.env.wind * 0.08) * hang
    this.x += Math.sin(this.time * 14) * this.pluckAmp * hang
    this.vx = (this.x - prevX) / Math.max(dt, 1e-6)
    if (climbing && this.y < CONFIG.spider.threadTop - 20) {
      this.state = 'gone'
      this.view.visible = false
    }
  }

  private syncSpider() {
    const caught = this.state === 'caught'
    this.view.position.set(this.x, this.y)
    this.view.scale.set(1)
    this.view.rotation = 0
    const { x0, y0 } = this.thread()
    this.art.rotation = caught ? this.spin : -Math.atan2(this.x - x0, this.y - y0) * 0.8
    // Legs paddle while climbing, twitch while dangling.
    const climbing = this.state === 'leave' || this.state === 'flee'
    this.wings.rotation = Math.sin(this.flap * (climbing ? 3 : 1)) * (climbing ? 0.18 : 0.05)
    this.art.tint = this.angry > 0 && Math.sin(this.time * 30) > -0.3 ? 0xffa89a : this.ambient
    const silk = this.silk!
    silk.clear()
    if (caught) return
    silk
      .moveTo(x0 - this.x, y0 - this.y)
      .lineTo(0, -12)
      .stroke({ width: 1.6, color: PALETTE.white, alpha: 0.85 })
    silk.tint = this.ambient
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
    } else if (this.kind === 'moth') {
      // Loops around the light, sometimes wide, sometimes close.
      const { lightX, lightY } = this.env
      this.orbit += this.zig * rng.range(0.5, 1.3)
      const r = rng.range(34, 115)
      this.wx = clamp(lightX + Math.cos(this.orbit) * r, left, right)
      this.wy = clamp(lightY + Math.sin(this.orbit) * r * 0.75, top, bottom)
      if (rng.chance(0.15)) this.zig = -this.zig
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

/** Shell and glow color for each power-up beetle. */
export const POWER_COLORS: Record<PowerKind, number> = {
  frenzy: PALETTE.frenzy,
  freeze: PALETTE.freeze,
  double: PALETTE.double,
}

let glow: Texture | null = null

/** Soft round light, shared by every glowing insect. Rebuilt if a destroyed game took it along. */
function glowTexture() {
  if (glow && !glow.destroyed) return glow
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
  // A long stinger and three bold stripes, so a bee never reads as a golden fly.
  body
    .poly([-12, -3.5, -26, 1, -12, 5.5])
    .fill(ink)
    .stroke({ width: 1.5, color: ink, join: 'round' })
  body.ellipse(0, 0, 15, 11).fill(PALETTE.bee).stroke({ width: 2.5, color: ink })
  for (const sx of [-9, -3, 3]) {
    const hb = 2 * 11 * Math.sqrt(1 - (sx / 15) ** 2) - 3
    body.roundRect(sx - 2.4, -hb / 2, 4.8, hb, 2.2).fill(PALETTE.beeDark)
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

function drawMoth(art: Container, wings: Container) {
  const ink = PALETTE.ink
  const w = new Graphics()
  // Broad, rounded wings with a darker band, drawn in profile.
  w.moveTo(2, 0)
    .quadraticCurveTo(-6, -22, -20, -20)
    .quadraticCurveTo(-18, -6, 2, 0)
    .closePath()
    .fill(PALETTE.moth)
    .stroke({ width: 1.6, color: ink, alpha: 0.6 })
  w.moveTo(0, -3).quadraticCurveTo(-8, -14, -15, -15).stroke({
    width: 2.4,
    color: PALETTE.mothDark,
    cap: 'round',
  })
  w.circle(-10, -13, 2.2).fill(PALETTE.mothDark)
  wings.addChild(w)
  wings.position.set(0, -1)

  const body = new Graphics()
  body.ellipse(-2, 1, 10, 5.5).fill(PALETTE.mothBody).stroke({ width: 2, color: ink })
  for (const sx of [-6, -2, 2]) body.moveTo(sx, -3).lineTo(sx, 5)
  body.stroke({ width: 1.2, color: PALETTE.mothDark })
  body.circle(8.5, 0, 4.6).fill(PALETTE.moth).stroke({ width: 2, color: ink })
  body.circle(9.8, -1.2, 2.2).fill(ink)
  // Feathery antennae.
  body.moveTo(10, -4).quadraticCurveTo(13, -11, 18, -12).stroke({ width: 1.4, color: ink })
  for (const k of [0.35, 0.6, 0.85]) {
    const ax = 10 + 8 * k
    const ay = -4 - 8 * k
    body.moveTo(ax, ay).lineTo(ax + 2.5, ay + 1.5)
  }
  body.stroke({ width: 1.1, color: ink, cap: 'round' })
  art.addChild(body, wings)
}

function drawLadybug(art: Container, wings: Container) {
  const ink = PALETTE.ink
  const w = new Graphics()
  w.ellipse(-4, -9, 9, 4).fill({ color: PALETTE.wing, alpha: 0.7 }).stroke({
    width: 1.4,
    color: ink,
    alpha: 0.5,
  })
  wings.addChild(w)
  wings.position.set(0, 0)

  const body = new Graphics()
  body.moveTo(-6, 6).lineTo(-8, 10).moveTo(0, 7).lineTo(0, 11).moveTo(6, 6).lineTo(8, 10)
  body.stroke({ width: 1.6, color: ink, cap: 'round' })
  // Shiny dome shell with spots and a split down the middle.
  body.ellipse(-1, 0, 12, 9.5).fill(PALETTE.ladybug).stroke({ width: 2.2, color: ink })
  body.moveTo(-1, -9.5).lineTo(-1, 9.5).stroke({ width: 1.6, color: ink })
  for (const [sx, sy, r] of [
    [-7, -3, 2.4],
    [-5, 4, 2],
    [4, -4, 2.2],
    [5, 3.5, 2.4],
  ] as const)
    body.circle(sx, sy, r).fill(ink)
  body.ellipse(-5, -5, 3.6, 1.8).fill({ color: PALETTE.white, alpha: 0.7 })
  body.circle(11, 0.5, 5).fill(ink)
  body.circle(12.5, -1.5, 1.6).fill(PALETTE.white)
  body.circle(12.8, 2.5, 1.2).fill(PALETTE.white)
  art.addChild(wings, body)
}

function drawWasp(art: Container, wings: Container) {
  const ink = PALETTE.ink
  const body = new Graphics()
  // Long pointed abdomen, a thin waist and a big stinger: a clearly different shape from a bee.
  body.poly([-20, -1.5, -31, 1, -20, 3.5]).fill(ink)
  body
    .moveTo(-21, 1)
    .quadraticCurveTo(-14, -9, -3, -5)
    .quadraticCurveTo(0, 1, -3, 7)
    .quadraticCurveTo(-14, 11, -21, 1)
    .closePath()
    .fill(PALETTE.wasp)
    .stroke({ width: 2.4, color: ink })
  for (const sx of [-16, -10]) body.roundRect(sx - 1.8, -5, 3.6, 11, 1.8).fill(PALETTE.waspDark)
  body.ellipse(3, 0, 5.5, 4.5).fill(PALETTE.waspDark).stroke({ width: 2, color: ink })
  body.circle(11, -2, 6).fill(PALETTE.wasp).stroke({ width: 2.4, color: ink })
  body.circle(13, -3.5, 2.8).fill(PALETTE.white)
  body.circle(13.8, -3.2, 1.5).fill(ink)
  // Angry brow.
  body.moveTo(9.5, -8.4).lineTo(15.5, -6).stroke({ width: 2, color: ink, cap: 'round' })
  body.moveTo(13, -7).quadraticCurveTo(15, -14, 19, -15).stroke({ width: 1.6, color: ink })
  for (const [lx, ly] of [
    [-1, 4],
    [3, 4.5],
    [6, 4],
  ] as const)
    body.moveTo(lx, ly).lineTo(lx - 2, ly + 6)
  body.stroke({ width: 1.4, color: ink, cap: 'round' })

  const w = new Graphics()
  w.ellipse(-6, -8, 10, 3.6).fill({ color: PALETTE.wing, alpha: 0.75 }).stroke({
    width: 1.4,
    color: ink,
    alpha: 0.55,
  })
  w.ellipse(-1, -10, 9, 3.2).fill({ color: PALETTE.wing, alpha: 0.85 }).stroke({
    width: 1.4,
    color: ink,
    alpha: 0.55,
  })
  wings.addChild(w)
  wings.position.set(0, -2)
  art.addChild(body, wings)
}

/** Drawn hanging head down, facing the player. `legs` wiggle while it climbs. */
function drawSpider(art: Container, legs: Container) {
  const ink = PALETTE.ink
  const l = new Graphics()
  for (const side of [-1, 1]) {
    for (const [ax, ay, kx, ky, fx, fy] of [
      [6, -6, 17, -15, 22, -6],
      [7, -2, 20, -6, 25, 2],
      [7, 2, 20, 4, 24, 12],
      [6, 6, 16, 12, 19, 20],
    ] as const) {
      l.moveTo(side * ax, ay)
        .lineTo(side * kx, ky)
        .lineTo(side * fx, fy)
    }
  }
  l.stroke({ width: 2.6, color: ink, cap: 'round', join: 'round' })
  legs.addChild(l)

  const body = new Graphics()
  body.circle(0, -6, 12).fill(PALETTE.spider).stroke({ width: 2.4, color: ink })
  body.ellipse(-4, -11, 4, 2.4).fill({ color: PALETTE.spiderLight, alpha: 0.9 })
  body.circle(0, 7, 8.5).fill(PALETTE.spider).stroke({ width: 2.4, color: ink })
  for (const side of [-1, 1]) {
    body.circle(side * 3.6, 6, 3).fill(PALETTE.white)
    body.circle(side * 3.6, 7, 1.6).fill(ink)
  }
  // Little fangs.
  body.moveTo(-2, 13.5).lineTo(-1.2, 16.5).moveTo(2, 13.5).lineTo(1.2, 16.5)
  body.stroke({ width: 1.8, color: PALETTE.white, cap: 'round' })
  art.addChild(legs, body)
}

/** A round, shiny beetle. Each power gets its own shell color and emblem. */
function drawBeetle(
  art: Container,
  wings: Container,
  shells: Partial<Record<PowerKind, Container>>,
) {
  const ink = PALETTE.ink
  const w = new Graphics()
  w.ellipse(-6, -10, 9, 4).fill({ color: PALETTE.wing, alpha: 0.75 }).stroke({
    width: 1.4,
    color: ink,
    alpha: 0.5,
  })
  wings.addChild(w)

  const legs = new Graphics()
  legs.moveTo(-6, 7).lineTo(-9, 12).moveTo(0, 8).lineTo(0, 13).moveTo(6, 7).lineTo(9, 12)
  legs.stroke({ width: 1.8, color: ink, cap: 'round' })
  art.addChild(wings, legs)

  for (const power of POWERS) {
    const c = new Container()
    const g = new Graphics()
    g.ellipse(-1, 0, 13, 10.5).fill(POWER_COLORS[power]).stroke({ width: 2.4, color: ink })
    g.ellipse(-6, -5, 4, 2).fill({ color: PALETTE.white, alpha: 0.75 })
    const e = PALETTE.white
    if (power === 'frenzy') {
      g.star(-1, 1, 5, 6, 2.6).fill(e).stroke({ width: 1.4, color: ink })
    } else if (power === 'freeze') {
      for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
        g.moveTo(-1 + Math.cos(a) * 6, 1 + Math.sin(a) * 6).lineTo(
          -1 - Math.cos(a) * 6,
          1 - Math.sin(a) * 6,
        )
      }
      g.stroke({ width: 2.2, color: e, cap: 'round' })
    } else {
      g.star(-5, 1, 5, 4.6, 2).fill(e).stroke({ width: 1.2, color: ink })
      g.star(4, 1, 5, 4.6, 2).fill(e).stroke({ width: 1.2, color: ink })
    }
    g.circle(12, 0, 5).fill(ink)
    g.circle(13.4, -1.6, 1.6).fill(PALETTE.white)
    g.moveTo(14, -4).quadraticCurveTo(17, -9, 20, -9).stroke({ width: 1.4, color: ink })
    c.addChild(g)
    c.visible = false
    shells[power] = c
    art.addChild(c)
  }
}
