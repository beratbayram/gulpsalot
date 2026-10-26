import { Container, FillGradient, Graphics } from 'pixi.js'
import { TAU, easeOutCubic } from '../../lib/math'
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

  private readonly rng = new Rng(7)
  private readonly wind = createNoise1D(11)
  private readonly drift = createNoise1D(23)
  private time = 0
  private layout!: Layout

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

    this.back.addChild(this.drawSky(W, waterY))
    this.buildSun(W)
    this.buildClouds(W, waterY)
    this.back.addChild(this.drawHills(W, waterY))
    this.buildReeds(this.back, W, waterY, false)
    this.back.addChild(this.drawWater(W, H, waterY))
    this.buildGlints(W, H, waterY)
    this.buildSmallPads(W, waterY, padY)
    this.buildRipples()
    this.buildMainPad(W, padY)
    this.buildLily(padY)
    this.buildMotes(W, waterY)
    this.buildReeds(this.front, W, H, true)
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

    for (const c of this.clouds) {
      c.g.x += c.speed * dt
      if (c.g.x > W + c.span) c.g.x = -c.span
    }

    this.sun.scale.set(1 + Math.sin(t * 0.9) * 0.025)
    this.sun.rotation = t * 0.05

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

  private drawSky(W: number, waterY: number) {
    const g = new Graphics()
    const gradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: PALETTE.skyTop },
        { offset: 0.65, color: 0xb4e2f8 },
        { offset: 1, color: PALETTE.skyBottom },
      ],
      textureSpace: 'local',
    })
    g.rect(-BLEED, -BLEED, W + BLEED * 2, waterY + BLEED + 4).fill(gradient)
    return g
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
    s.position.set(W - 64, 196)
    this.back.addChild(s)
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
      this.back.addChild(g)
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
      this.back.addChild(g)
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
      this.back.addChild(c)
      this.smallPads.push({ c, y: s.y })
    }
  }

  private buildRipples() {
    for (let i = 0; i < 8; i++) {
      const g = new Graphics()
      g.visible = false
      this.back.addChild(g)
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
    this.back.addChild(p)
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
    this.back.addChild(c)
  }

  private buildMotes(W: number, waterY: number) {
    for (let i = 0; i < 10; i++) {
      const g = new Graphics()
      g.circle(0, 0, this.rng.range(1.2, 2.4)).fill(PALETTE.white)
      const m = { g, x: this.rng.range(0, W), y: this.rng.range(150, waterY - 20), seed: i * 13.7 }
      this.back.addChild(g)
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
