import { Container, FillGradient, Graphics } from 'pixi.js'
import { TAU, clamp, damp, easeOutCubic, lerp, mixColor } from '../../lib/math'
import { createNoise1D } from '../../lib/noise'
import { Rng } from '../../lib/random'
import { PALETTE } from '../draw/palette'
import type { Layout } from '../layout'

/** Extra margin so letterboxed screens still see scenery instead of empty bars. */
const BLEED = 320

interface Drifter {
  g: Container
  speed: number
  span: number
}

interface Reed {
  g: Graphics
  phase: number
  amp: number
  speed: number
}

interface Glint {
  g: Graphics
  x: number
  phase: number
}

interface Mote {
  g: Graphics
  x: number
  y: number
  seed: number
}

interface Star {
  g: Graphics
  phase: number
  speed: number
}

/** Scenery tint at dusk and at night. Multiplies everything below the sky. */
const DUSK_AMBIENT = 0xffd9c4
const NIGHT_AMBIENT = 0x98a6d6
const DUSK_CLOUD = 0xffc0c8
const NIGHT_CLOUD = 0x56648f

interface Ripple {
  g: Graphics
  x: number
  y: number
  t: number
  strength: number
  active: boolean
}

/** The whole backdrop: sky, clouds, hills, water, reeds and the lily pad Pofik sits on. */
export class Pond {
  /** Behind Pofik and the insects. */
  readonly back = new Container()
  /** In front of everything except effects (foreground reeds). */
  readonly front = new Container()
  /** Current time-of-day tint, for things drawn outside the pond (Pofik, insects). */
  ambient = 0xffffff

  private readonly rng = new Rng(7)
  private readonly wind = createNoise1D(11)
  private readonly drift = createNoise1D(23)
  private time = 0
  private layout!: Layout

  private sky = new Container()
  private scenery = new Container()
  private duskSky = new Graphics()
  private nightSky = new Graphics()
  private stars: Star[] = []
  private moon = new Container()
  private skyPhase = 0
  private skyTarget = 0
  private sunY = 0
  private clouds: Drifter[] = []
  private sun = new Container()
  private reeds: Reed[] = []
  private glints: Glint[] = []
  private motes: Mote[] = []
  private ripples: Ripple[] = []
  private smallPads: { c: Container; y: number }[] = []
  private lily = new Container()
  private pad = new Container()
  private ambientRipple = 1.5

  /** Vertical bob of the main pad, used to keep Pofik seated on it. */
  padBob = 0

  build(layout: Layout) {
    this.layout = layout
    for (const c of [this.back, this.front]) {
      c.removeChildren().forEach((child) => child.destroy({ children: true }))
    }
    // Rebuilt from scratch: the old ones were destroyed with their parent's children.
    this.sky = new Container()
    this.scenery = new Container()
    this.moon = new Container()
    this.stars = []
    this.sun = new Container()
    this.pad = new Container()
    this.lily = new Container()
    this.clouds = []
    this.reeds = []
    this.glints = []
    this.motes = []
    this.ripples = []
    this.smallPads = []

    const { worldW: W, worldH: H, waterY, padY } = layout

    // The sky keeps its own colors; everything below it is tinted by time of day.
    this.back.addChild(this.sky, this.scenery)
    this.buildSky(W, waterY)
    this.buildSun(W)
    this.buildMoon()
    this.buildClouds(W, waterY)
    this.scenery.addChild(this.drawHills(W, waterY))
    this.buildReeds(this.scenery, W, waterY, false)
    this.scenery.addChild(this.drawWater(W, H, waterY))
    this.buildGlints(W, H, waterY)
    this.buildSmallPads(W, waterY, padY)
    this.buildRipples()
    this.buildMainPad(W, padY)
    this.buildLily(padY)
    this.buildMotes(W, waterY)
    this.buildReeds(this.front, W, H, true)
    this.applySky(0)
  }

  /** 0 = day, 1 = dusk, 2 = night. The sky eases towards it. */
  setSky(phase: number) {
    this.skyTarget = phase
  }

  /** Expanding ring on the water. */
  ripple(x: number, y: number, strength = 1) {
    const r = this.ripples.find((it) => !it.active) ?? this.ripples[0]
    r.active = true
    r.t = 0
    r.x = x
    r.y = y
    r.strength = strength
    r.g.visible = true
  }

  update(dt: number) {
    this.time += dt
    const t = this.time
    const { worldW: W, padY } = this.layout

    this.skyPhase = damp(this.skyPhase, this.skyTarget, 1.4, dt)
    if (Math.abs(this.skyPhase - this.skyTarget) < 0.0005) this.skyPhase = this.skyTarget
    this.applySky(dt)

    for (const c of this.clouds) {
      c.g.x += c.speed * dt
      if (c.g.x > W + c.span) c.g.x = -c.span
    }

    this.sun.scale.set(1 + Math.sin(t * 0.9) * 0.025)
    this.sun.rotation = t * 0.05
    this.moon.rotation = Math.sin(t * 0.4) * 0.04

    const gust = 0.5 + 0.5 * this.wind(t * 0.18)
    for (const r of this.reeds) {
      const sway = Math.sin(t * r.speed + r.phase) * r.amp * (0.55 + gust * 0.9)
      r.g.skew.x = sway + gust * 0.05
    }

    for (const gl of this.glints) {
      gl.g.x = gl.x + Math.sin(t * 0.7 + gl.phase) * 7
      gl.g.alpha = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.4 + gl.phase * 2))
    }

    this.padBob = Math.sin(t * 1.3) * 2.2 + Math.sin(t * 0.47) * 1.2
    this.pad.y = padY + this.padBob
    this.pad.rotation = Math.sin(t * 0.8) * 0.006
    this.lily.y = padY + 34 + Math.sin(t * 1.1 + 1) * 2
    this.lily.rotation = Math.sin(t * 0.6) * 0.04
    this.smallPads.forEach((p, i) => (p.c.y = p.y + Math.sin(t * 1.2 + i * 2) * 1.6))

    for (const m of this.motes) {
      m.x += (8 + this.drift(m.seed + t * 0.3) * 14) * dt
      m.y += this.drift(m.seed * 3 + t * 0.25) * 10 * dt
      if (m.x > W + 20) m.x = -20
      m.g.position.set(m.x, m.y)
      m.g.alpha = 0.35 + 0.35 * Math.sin(t * 1.7 + m.seed)
    }

    this.ambientRipple -= dt
    if (this.ambientRipple <= 0) {
      this.ambientRipple = this.rng.range(2.2, 4)
      const side = this.rng.sign()
      this.ripple(W / 2 + side * this.rng.range(70, 130), padY + this.rng.range(-4, 10), 0.45)
    }

    for (const r of this.ripples) {
      if (!r.active) continue
      r.t += dt / (1.1 + r.strength * 0.5)
      if (r.t >= 1) {
        r.active = false
        r.g.visible = false
        continue
      }
      const k = easeOutCubic(r.t)
      const radius = 18 + 110 * k * r.strength
      r.g
        .clear()
        .ellipse(r.x, r.y, radius, radius * 0.26)
        .stroke({ width: 2.5, color: PALETTE.white, alpha: (1 - r.t) * 0.55 })
    }
  }

  private buildSky(W: number, waterY: number) {
    const layer = (stops: [number, number, number]) => {
      const g = new Graphics()
      const gradient = new FillGradient({
        type: 'linear',
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0, color: stops[0] },
          { offset: 0.65, color: stops[1] },
          { offset: 1, color: stops[2] },
        ],
        textureSpace: 'local',
      })
      g.rect(-BLEED, -BLEED, W + BLEED * 2, waterY + BLEED + 4).fill(gradient)
      this.sky.addChild(g)
      return g
    }
    layer([PALETTE.skyTop, 0xb4e2f8, PALETTE.skyBottom])
    this.duskSky = layer([0x7d7bca, 0xf39cb0, 0xffcf94])
    this.nightSky = layer([0x16204a, 0x2b3b70, 0x4a5c94])

    for (let i = 0; i < 46; i++) {
      const g = new Graphics()
      const big = this.rng.chance(0.15)
      if (big) g.star(0, 0, 4, 4, 1.4).fill(PALETTE.white)
      else g.circle(0, 0, this.rng.range(0.8, 1.8)).fill(PALETTE.white)
      g.position.set(this.rng.range(-60, W + 60), this.rng.range(-BLEED * 0.6, waterY - 150))
      this.sky.addChild(g)
      this.stars.push({ g, phase: this.rng.range(0, TAU), speed: this.rng.range(1, 3) })
    }
  }

  private buildMoon() {
    const g = new Graphics()
    g.circle(0, 0, 40).fill({ color: 0xfff6d6, alpha: 0.12 })
    g.circle(0, 0, 30).fill({ color: 0xfff6d6, alpha: 0.18 })
    g.circle(0, 0, 22).fill(0xfff4cf)
    g.circle(-6, -5, 4.5).fill(0xeadfb8)
    g.circle(7, 6, 3).fill(0xeadfb8)
    g.circle(5, -9, 2.2).fill(0xeadfb8)
    this.moon.addChild(g)
    this.moon.position.set(72, 300)
    this.sky.addChild(this.moon)
  }

  /** Crossfades the sky layers, sets the sun and moon, and tints the scenery. */
  private applySky(dt: number) {
    const p = this.skyPhase
    const dusk = clamp(p, 0, 1)
    const night = clamp(p - 1, 0, 1)
    this.duskSky.alpha = dusk
    this.nightSky.alpha = night
    this.duskSky.visible = dusk > 0.001
    this.nightSky.visible = night > 0.001

    const sunset = easeOutCubic(clamp(p / 1.2, 0, 1))
    this.sun.y = lerp(this.sunY, this.layout.waterY - 40, sunset)
    this.sun.tint = mixColor(0xffffff, 0xff9a5c, dusk)
    this.sun.alpha = 1 - clamp((p - 0.9) / 0.5, 0, 1)
    this.sun.visible = this.sun.alpha > 0.001

    const rise = easeOutCubic(clamp((p - 1.1) / 0.9, 0, 1))
    this.moon.alpha = clamp((p - 1.15) / 0.6, 0, 1)
    this.moon.y = lerp(300, 176, rise)
    this.moon.visible = this.moon.alpha > 0.001

    for (const s of this.stars) {
      if (night <= 0.001) {
        s.g.visible = false
        continue
      }
      s.phase += dt * s.speed
      s.g.visible = true
      s.g.alpha = night * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(s.phase)))
    }

    const cloud =
      p <= 1 ? mixColor(0xffffff, DUSK_CLOUD, dusk) : mixColor(DUSK_CLOUD, NIGHT_CLOUD, night)
    for (const c of this.clouds) c.g.tint = cloud

    this.ambient =
      p <= 1 ? mixColor(0xffffff, DUSK_AMBIENT, dusk) : mixColor(DUSK_AMBIENT, NIGHT_AMBIENT, night)
    this.scenery.tint = this.ambient
    this.front.tint = this.ambient
  }

  private buildSun(W: number) {
    const s = this.sun
    const glow = new Graphics()
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU
      glow
        .moveTo(Math.cos(a - 0.09) * 46, Math.sin(a - 0.09) * 46)
        .lineTo(Math.cos(a) * 78, Math.sin(a) * 78)
        .lineTo(Math.cos(a + 0.09) * 46, Math.sin(a + 0.09) * 46)
        .closePath()
    }
    glow.fill({ color: PALETTE.sunGlow, alpha: 0.35 })
    glow.circle(0, 0, 56).fill({ color: PALETTE.sunGlow, alpha: 0.3 })
    glow.circle(0, 0, 44).fill({ color: PALETTE.sunGlow, alpha: 0.5 })
    glow.circle(0, 0, 34).fill(PALETTE.sun)
    s.addChild(glow)
    this.sunY = 196
    s.position.set(W - 64, this.sunY)
    this.sky.addChild(s)
  }

  private buildClouds(W: number, waterY: number) {
    const specs = [
      { x: 0.12, y: 168, w: 120, speed: 7 },
      { x: 0.68, y: 252, w: 92, speed: 10 },
      { x: 0.35, y: 330, w: 150, speed: 5 },
      { x: 0.9, y: 420, w: 80, speed: 12 },
    ]
    for (const spec of specs) {
      if (spec.y > waterY - 160) continue
      const g = new Graphics()
      drawCloud(g, spec.w, PALETTE.cloudShade, 6)
      drawCloud(g, spec.w, PALETTE.cloud, 0)
      g.position.set(spec.x * W, spec.y)
      g.alpha = 0.95
      this.sky.addChild(g)
      this.clouds.push({ g, speed: spec.speed, span: spec.w })
    }
  }

  private drawHills(W: number, waterY: number) {
    const g = new Graphics()
    const ridge = (base: number, amp: number, f1: number, f2: number, phase: number) => {
      const pts: number[] = [-BLEED, waterY + 10]
      for (let x = -BLEED; x <= W + BLEED; x += 16) {
        const y =
          base - amp * (0.6 + 0.4 * Math.sin(x * f1 + phase)) - amp * 0.35 * Math.sin(x * f2)
        pts.push(x, y)
      }
      pts.push(W + BLEED, waterY + 10)
      return pts
    }
    g.poly(ridge(waterY - 34, 42, 0.011, 0.033, 0.8)).fill(PALETTE.hillFar)
    g.poly(ridge(waterY - 6, 28, 0.017, 0.041, 2.1)).fill(PALETTE.hillNear)
    // Round bushes along the near shore.
    const bushes = [-30, 34, 70, 290, 336, 380, 430]
    for (const bx of bushes) {
      const r = 14 + ((bx * 7) % 9)
      g.circle(bx, waterY - 8, r + 4).fill(PALETTE.bushDark)
      g.circle(bx - 6, waterY - 12, r).fill(PALETTE.bush)
    }
    return g
  }

  private drawWater(W: number, H: number, waterY: number) {
    const g = new Graphics()
    const gradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: PALETTE.waterTop },
        { offset: 1, color: PALETTE.waterBottom },
      ],
      textureSpace: 'local',
    })
    g.rect(-BLEED, waterY, W + BLEED * 2, H - waterY + BLEED).fill(gradient)
    g.rect(-BLEED, waterY - 1, W + BLEED * 2, 4).fill({ color: PALETTE.waterLine, alpha: 0.85 })
    return g
  }

  private buildGlints(W: number, H: number, waterY: number) {
    for (let i = 0; i < 11; i++) {
      const g = new Graphics()
      const w = this.rng.range(14, 38)
      g.roundRect(-w / 2, -1.5, w, 3, 1.5).fill(PALETTE.white)
      const x = this.rng.range(10, W - 10)
      g.position.set(x, this.rng.range(waterY + 16, H - 20))
      this.scenery.addChild(g)
      this.glints.push({ g, x, phase: this.rng.range(0, TAU) })
    }
  }

  private buildSmallPads(W: number, waterY: number, padY: number) {
    const specs = [
      { x: 52, y: waterY + 30, rx: 26 },
      { x: W - 40, y: waterY + 58, rx: 32 },
      { x: W - 92, y: padY + 70, rx: 22 },
    ]
    for (const s of specs) {
      const c = new Container()
      const g = new Graphics()
      drawPadShape(g, s.rx, s.rx * 0.3, 0.7)
      g.fill(PALETTE.padDark)
      drawPadShape(g, s.rx * 0.85, s.rx * 0.22, 0.7, -2)
      g.fill(PALETTE.pad)
      c.addChild(g)
      c.position.set(s.x, s.y)
      this.scenery.addChild(c)
      this.smallPads.push({ c, y: s.y })
    }
  }

  private buildRipples() {
    for (let i = 0; i < 8; i++) {
      const g = new Graphics()
      g.visible = false
      this.scenery.addChild(g)
      this.ripples.push({ g, x: 0, y: 0, t: 0, strength: 1, active: false })
    }
  }

  private buildMainPad(W: number, padY: number) {
    const p = this.pad
    const shadow = new Graphics()
    shadow.ellipse(0, 10, 118, 30).fill({ color: 0x1e5a6a, alpha: 0.25 })
    const g = new Graphics()
    drawPadShape(g, 116, 33, 0.55)
    g.fill(PALETTE.padDark).stroke({ width: 3, color: PALETTE.ink, join: 'round' })
    drawPadShape(g, 104, 26, 0.55, -3)
    g.fill(PALETTE.pad)
    // Veins.
    for (const a of [-2.6, -2.05, -1.5, -0.95, -0.4, 0.15, 2.3, 2.85]) {
      g.moveTo(0, -3).lineTo(Math.cos(a) * 92, -3 + Math.sin(a) * 22)
    }
    g.stroke({ width: 2, color: PALETTE.padDark, alpha: 0.7, cap: 'round' })
    g.ellipse(-30, -10, 34, 8).fill({ color: PALETTE.padLight, alpha: 0.55 })
    p.addChild(shadow, g)
    p.position.set(W / 2, padY)
    this.scenery.addChild(p)
  }

  private buildLily(padY: number) {
    const c = this.lily
    const g = new Graphics()
    g.ellipse(0, 6, 30, 8).fill({ color: PALETTE.padDark })
    const petal = (angle: number, len: number, color: number) => {
      const cx = Math.cos(angle) * len * 0.5
      const cy = Math.sin(angle) * len * 0.22
      g.ellipse(cx, cy - 6, len * 0.42, 9)
      g.fill(color)
    }
    for (let i = 0; i < 6; i++) petal(Math.PI + (i / 5) * Math.PI, 30, PALETTE.lilyPetalDeep)
    for (let i = 0; i < 5; i++)
      petal(Math.PI * 1.1 + (i / 4) * Math.PI * 0.8, 24, PALETTE.lilyPetal)
    g.circle(0, -8, 6).fill(PALETTE.lilyCenter)
    c.addChild(g)
    c.position.set(46, padY + 34)
    this.scenery.addChild(c)
  }

  private buildMotes(W: number, waterY: number) {
    for (let i = 0; i < 10; i++) {
      const g = new Graphics()
      g.circle(0, 0, this.rng.range(1.2, 2.4)).fill(PALETTE.white)
      const m = { g, x: this.rng.range(0, W), y: this.rng.range(150, waterY - 20), seed: i * 13.7 }
      this.scenery.addChild(g)
      this.motes.push(m)
    }
  }

  private buildReeds(parent: Container, W: number, baseY: number, foreground: boolean) {
    const clusters = foreground
      ? [
          { x: -14, count: 3, h: [150, 210] as const },
          { x: W + 12, count: 3, h: [130, 190] as const },
        ]
      : [
          { x: 18, count: 5, h: [70, 120] as const },
          { x: W - 22, count: 5, h: [64, 110] as const },
        ]
    for (const cl of clusters) {
      for (let i = 0; i < cl.count; i++) {
        const g = new Graphics()
        const h = this.rng.range(cl.h[0], cl.h[1])
        const w = foreground ? this.rng.range(13, 18) : this.rng.range(7, 10)
        const curve = this.rng.range(-18, 18)
        const color = foreground
          ? i % 2
            ? PALETTE.reedDark
            : PALETTE.reed
          : i % 2
            ? PALETTE.bush
            : PALETTE.reed
        const withCattail = this.rng.chance(foreground ? 0.4 : 0.35)
        if (withCattail) {
          g.moveTo(-2, 0)
            .quadraticCurveTo(curve * 0.4, -h * 0.5, curve * 0.6, -h * 1.05)
            .lineTo(curve * 0.6 + 3, -h * 1.05)
            .quadraticCurveTo(curve * 0.4 + 3, -h * 0.5, 2, 0)
            .closePath()
            .fill(PALETTE.reedDark)
          const cw = foreground ? 14 : 9
          g.roundRect(curve * 0.6 - cw / 2 + 1.5, -h * 0.98, cw, h * 0.26, cw / 2).fill(
            PALETTE.cattail,
          )
        } else {
          g.moveTo(-w / 2, 0)
            .quadraticCurveTo(-w / 2 + curve * 0.4, -h * 0.55, curve, -h)
            .quadraticCurveTo(w / 2 + curve * 0.4, -h * 0.55, w / 2, 0)
            .closePath()
            .fill(color)
        }
        const spread = foreground ? 26 : 16
        g.position.set(cl.x + (i - cl.count / 2) * spread * (cl.x < W / 2 ? 1 : -1), baseY + 6)
        parent.addChild(g)
        this.reeds.push({
          g,
          phase: this.rng.range(0, TAU),
          amp: this.rng.range(0.05, 0.1),
          speed: this.rng.range(0.9, 1.5),
        })
      }
    }
  }
}

function drawCloud(g: Graphics, w: number, color: number, dy: number) {
  const h = w * 0.34
  g.roundRect(-w / 2, -h * 0.25 + dy, w, h * 0.62, h * 0.31)
  g.circle(-w * 0.24, -h * 0.12 + dy, h * 0.42)
  g.circle(-w * 0.02, -h * 0.38 + dy, h * 0.55)
  g.circle(w * 0.24, -h * 0.18 + dy, h * 0.44)
  g.fill(color)
}

/** Lily pad ellipse with a wedge notch cut towards the front. */
function drawPadShape(g: Graphics, rx: number, ry: number, notch: number, dy = 0) {
  const notchAt = Math.PI / 2 + notch
  const gap = 0.2
  const steps = 40
  g.moveTo(0, dy)
  for (let i = 0; i <= steps; i++) {
    const a = notchAt + gap + (i / steps) * (TAU - gap * 2)
    g.lineTo(Math.cos(a) * rx, dy + Math.sin(a) * ry)
  }
  g.closePath()
}
