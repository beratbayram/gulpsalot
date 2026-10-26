import { Container, DisplacementFilter, Graphics, Sprite, Texture } from 'pixi.js'
import { TAU, easeOutCubic } from '../../lib/math'
import { createNoise1D } from '../../lib/noise'
import { Rng } from '../../lib/random'
import { PALETTE } from '../draw/palette'
import {
  createNoise2D,
  fbm,
  grain,
  originAnchor,
  paper,
  rgba,
  shadePixels,
  softBlob,
  toTexture,
  type Paper,
} from '../draw/paint'
import type { Layout } from '../layout'

/** Margin painted beyond the world so letterboxed screens still see scenery. */
const BLEED = 160
const SUN_X_FROM_RIGHT = 70
const SUN_Y = 190

interface Sway {
  s: Sprite
  phase: number
  amp: number
  speed: number
}

interface Ripple {
  g: Graphics
  x: number
  y: number
  t: number
  strength: number
  active: boolean
}

/**
 * The backdrop: painted sky, clouds, forest, pond water with a rippling
 * reflection, lily pads and reeds. Everything is painted once per layout into
 * textures; per frame only transforms, alpha and a displacement map move.
 */
export class Pond {
  /** Behind Pofik and the insects. */
  readonly back = new Container()
  /** In front of everything except effects (out-of-focus foreground reeds). */
  readonly front = new Container()
  /** Vertical bob of the main pad, used to keep Pofik seated on it. */
  padBob = 0

  private readonly rng = new Rng(7)
  private readonly wind = createNoise1D(11)
  private readonly drift = createNoise1D(23)
  private layout!: Layout
  private time = 0
  private textures: Texture[] = []
  private clouds: { s: Sprite; speed: number; span: number }[] = []
  private sways: Sway[] = []
  private glints: { s: Sprite; phase: number; speed: number; peak: number }[] = []
  private motes: { s: Sprite; x: number; y: number; seed: number }[] = []
  private floaters: { c: Container; y: number; phase: number }[] = []
  private ripples: Ripple[] = []
  private pad = new Container()
  private displacement: Sprite | null = null
  private ambientRipple = 1.5

  build(layout: Layout, res: number) {
    this.layout = layout
    for (const c of [this.back, this.front]) {
      c.removeChildren().forEach((child) => child.destroy({ children: true }))
    }
    this.textures.forEach((t) => t.destroy(true))
    this.textures = []
    this.clouds = []
    this.sways = []
    this.glints = []
    this.motes = []
    this.floaters = []
    this.ripples = []
    this.pad = new Container()

    const { worldW: W, worldH: H, waterY, padY } = layout

    const sky = paintSky(W, waterY, res)
    const land = paintLand(W, waterY, res)
    this.back.addChild(this.sprite(sky))
    this.buildClouds(W, waterY, res)
    this.back.addChild(this.sprite(land))
    this.back.addChild(this.sprite(paintWater(W, H, waterY, res)))
    this.buildReflection(sky, land, W, waterY, res)
    this.buildGlints(W, waterY, res)
    this.buildShoreReeds(W, waterY, res)
    this.buildSmallPads(W, waterY, padY, res)
    this.buildRipples()
    this.buildMainPad(W, padY, res)
    this.buildMotes(W, waterY, res)
    this.buildForeground(W, H, res)
  }

  dispose() {
    this.textures.forEach((t) => t.destroy(true))
    this.textures = []
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
      c.s.x += c.speed * dt
      if (c.s.x > W + c.span) c.s.x = -c.span
    }

    if (this.displacement) {
      this.displacement.x = (this.displacement.x + 7 * dt) % 512
      this.displacement.y = (this.displacement.y + 4 * dt) % 256
    }

    const gust = 0.5 + 0.5 * this.wind(t * 0.18)
    for (const r of this.sways) {
      r.s.skew.x = Math.sin(t * r.speed + r.phase) * r.amp * (0.5 + gust * 0.9) + gust * r.amp * 0.6
    }

    for (const g of this.glints) {
      const k = Math.max(0, Math.sin(t * g.speed + g.phase))
      g.s.alpha = k * k * k * g.peak
    }

    this.padBob = Math.sin(t * 1.1) * 1.6 + Math.sin(t * 0.43) * 0.9
    this.pad.y = padY + this.padBob
    this.pad.rotation = Math.sin(t * 0.7) * 0.004
    for (const f of this.floaters) {
      f.c.y = f.y + Math.sin(t * 0.9 + f.phase) * 1.2
      f.c.rotation = Math.sin(t * 0.5 + f.phase) * 0.012
    }

    for (const m of this.motes) {
      m.x += (6 + this.drift(m.seed + t * 0.3) * 10) * dt
      m.y += this.drift(m.seed * 3 + t * 0.25) * 8 * dt
      if (m.x > W + 20) m.x = -20
      m.s.position.set(m.x, m.y)
      m.s.alpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.3 + m.seed))
    }

    this.ambientRipple -= dt
    if (this.ambientRipple <= 0) {
      this.ambientRipple = this.rng.range(2.5, 4.5)
      const side = this.rng.sign()
      this.ripple(W / 2 + side * this.rng.range(80, 140), padY + this.rng.range(-2, 14), 0.4)
    }

    for (const r of this.ripples) {
      if (!r.active) continue
      r.t += dt / (1.4 + r.strength * 0.6)
      if (r.t >= 1) {
        r.active = false
        r.g.visible = false
        continue
      }
      const k = easeOutCubic(r.t)
      const radius = 14 + 110 * k * r.strength
      const fade = (1 - r.t) * (0.35 + 0.25 * r.strength)
      r.g
        .clear()
        .ellipse(r.x, r.y + 1.5, radius + 2, (radius + 2) * 0.24)
        .stroke({ width: 2, color: PALETTE.waterDeep, alpha: fade * 0.8 })
        .ellipse(r.x, r.y, radius, radius * 0.24)
        .stroke({ width: 1.4, color: PALETTE.waterLight, alpha: fade })
    }
  }

  // Building ------------------------------------------------------------------

  private texture(p: Paper) {
    const t = toTexture(p)
    this.textures.push(t)
    return t
  }

  /** Sprite whose position is the paper's coordinate origin. */
  private sprite(p: Paper) {
    const s = new Sprite(this.texture(p))
    const a = originAnchor(p)
    s.anchor.set(a.x, a.y)
    return s
  }

  private buildClouds(W: number, waterY: number, res: number) {
    const specs = [
      { x: 0.15, y: 150, w: 170, speed: 4, seed: 3 },
      { x: 0.72, y: 250, w: 120, speed: 6, seed: 8 },
      { x: 0.4, y: 340, w: 210, speed: 3, seed: 13 },
    ]
    for (const spec of specs) {
      if (spec.y > waterY - 190) continue
      const s = this.sprite(paintCloud(spec.w, spec.seed, res * 0.75))
      s.position.set(spec.x * W, spec.y)
      s.alpha = 0.92
      this.back.addChild(s)
      this.clouds.push({ s, speed: spec.speed, span: spec.w })
    }
  }

  private buildReflection(sky: Paper, land: Paper, W: number, waterY: number, res: number) {
    const depth = 300
    const p = paper(-BLEED, waterY, W + BLEED * 2, depth, res * 0.6)
    const ctx = p.ctx
    ctx.save()
    ctx.translate(0, 2 * waterY)
    ctx.scale(1, -1)
    ctx.drawImage(sky.canvas, sky.ox, sky.oy, sky.w, sky.h)
    ctx.drawImage(land.canvas, land.ox, land.oy, land.w, land.h)
    ctx.restore()
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = rgba(PALETTE.waterMid, 0.45)
    ctx.fillRect(-BLEED, waterY, W + BLEED * 2, depth)
    ctx.globalCompositeOperation = 'destination-in'
    const fade = ctx.createLinearGradient(0, waterY, 0, waterY + depth)
    fade.addColorStop(0, 'rgba(0,0,0,0.85)')
    fade.addColorStop(0.5, 'rgba(0,0,0,0.35)')
    fade.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = fade
    ctx.fillRect(-BLEED, waterY, W + BLEED * 2, depth)
    ctx.globalCompositeOperation = 'source-over'

    const holder = new Container()
    holder.addChild(this.sprite(p))
    const map = new Sprite(this.texture(paintDisplacementMap()))
    map.texture.source.addressMode = 'repeat'
    map.scale.set(2.4, 0.4)
    map.renderable = false
    this.displacement = map
    holder.filters = [new DisplacementFilter({ sprite: map, scale: { x: 9, y: 2.5 } })]
    this.back.addChild(map, holder)
  }

  private buildGlints(W: number, waterY: number, res: number) {
    const tex = this.texture(paintGlint(res))
    const sunX = W - SUN_X_FROM_RIGHT
    for (let i = 0; i < 26; i++) {
      const d = this.rng.range(0, 1) ** 1.6
      const y = waterY + 6 + d * 230
      const spread = 10 + d * 70
      const s = new Sprite(tex)
      s.anchor.set(0.5)
      s.blendMode = 'add'
      s.position.set(sunX + this.rng.range(-spread, spread), y)
      s.scale.set(0.5 + (1 - d) * 0.7)
      s.alpha = 0
      this.back.addChild(s)
      this.glints.push({
        s,
        phase: this.rng.range(0, TAU),
        speed: this.rng.range(1.5, 4),
        peak: 0.5 + (1 - d) * 0.5,
      })
    }
  }

  private buildShoreReeds(W: number, waterY: number, res: number) {
    const clusters = [
      { x: 14, count: 6, h: [60, 120] as const },
      { x: W - 16, count: 6, h: [55, 110] as const },
    ]
    for (const cl of clusters) {
      for (let i = 0; i < cl.count; i++) {
        const h = this.rng.range(cl.h[0], cl.h[1])
        const cattail = this.rng.chance(0.35)
        const p = cattail
          ? paintCattail(h, this.rng.range(-10, 10), res, false)
          : paintBlade(
              h,
              this.rng.range(5, 8),
              this.rng.range(-16, 16),
              res,
              false,
              this.rng.float(),
            )
        const s = this.sprite(p)
        const dir = cl.x < W / 2 ? 1 : -1
        s.position.set(cl.x + dir * (i - 1) * 9 + this.rng.range(-4, 4), waterY + 6)
        this.back.addChild(s)
        this.sways.push({
          s,
          phase: this.rng.range(0, TAU),
          amp: this.rng.range(0.04, 0.08),
          speed: this.rng.range(0.8, 1.4),
        })
      }
    }
  }

  private buildSmallPads(W: number, waterY: number, padY: number, res: number) {
    const specs = [
      { x: 48, y: waterY + 30, rx: 26, seed: 21 },
      { x: W - 44, y: waterY + 58, rx: 34, seed: 22 },
      { x: 120, y: waterY + 76, rx: 20, seed: 23 },
      { x: W - 96, y: padY + 72, rx: 24, seed: 24 },
    ]
    for (const spec of specs) {
      const c = new Container()
      c.addChild(this.sprite(paintPad(spec.rx, spec.rx * 0.3, spec.seed, res)))
      c.position.set(spec.x, spec.y)
      this.back.addChild(c)
      this.floaters.push({ c, y: spec.y, phase: this.rng.range(0, TAU) })
    }
    const lily = new Container()
    lily.addChild(this.sprite(paintPad(30, 9, 31, res)))
    const flower = this.sprite(paintLily(res))
    flower.position.set(-2, -3)
    lily.addChild(flower)
    lily.position.set(44, padY + 34)
    this.back.addChild(lily)
    this.floaters.push({ c: lily, y: padY + 34, phase: 1.3 })
  }

  private buildRipples() {
    for (let i = 0; i < 8; i++) {
      const g = new Graphics()
      g.visible = false
      this.back.addChild(g)
      this.ripples.push({ g, x: 0, y: 0, t: 0, strength: 1, active: false })
    }
  }

  private buildMainPad(W: number, padY: number, res: number) {
    this.pad.addChild(this.sprite(paintPad(122, 35, 41, res, true)))
    this.pad.position.set(W / 2, padY)
    this.back.addChild(this.pad)
  }

  private buildMotes(W: number, waterY: number, res: number) {
    const tex = this.texture(paintGlint(res, 0.35))
    for (let i = 0; i < 14; i++) {
      const s = new Sprite(tex)
      s.anchor.set(0.5)
      s.blendMode = 'add'
      s.scale.set(this.rng.range(0.3, 0.6))
      const m = { s, x: this.rng.range(0, W), y: this.rng.range(160, waterY - 30), seed: i * 13.7 }
      this.back.addChild(s)
      this.motes.push(m)
    }
  }

  /** Big, out-of-focus reeds at the screen edges for depth. */
  private buildForeground(W: number, H: number, res: number) {
    const specs = [
      { x: -6, h: 230, curve: 22, cattail: false },
      { x: 12, h: 170, curve: 12, cattail: true },
      { x: W + 8, h: 210, curve: -20, cattail: false },
      { x: W - 10, h: 150, curve: -10, cattail: true },
    ]
    for (const spec of specs) {
      const p = spec.cattail
        ? paintCattail(spec.h, spec.curve, res * 0.6, true)
        : paintBlade(spec.h, 14, spec.curve, res * 0.6, true, 0.3)
      const s = this.sprite(p)
      s.position.set(spec.x, H + 8)
      this.front.addChild(s)
      this.sways.push({ s, phase: this.rng.range(0, TAU), amp: 0.045, speed: 0.7 })
    }
  }
}

// Painters -------------------------------------------------------------------

function paintSky(W: number, waterY: number, res: number) {
  const x0 = -BLEED
  const y0 = -BLEED
  const w = W + BLEED * 2
  const p = paper(x0, y0, w, waterY - y0 + 2, res * 0.5)
  const ctx = p.ctx
  const g = ctx.createLinearGradient(0, y0, 0, waterY)
  g.addColorStop(0, rgba(PALETTE.skyTop))
  g.addColorStop(0.6, rgba(PALETTE.skyMid))
  g.addColorStop(1, rgba(PALETTE.skyHorizon))
  ctx.fillStyle = g
  ctx.fillRect(x0, y0, w, waterY - y0 + 2)

  const sx = W - SUN_X_FROM_RIGHT
  softBlob(ctx, sx, SUN_Y, 330, 330, PALETTE.sunGlow, 0.32, 0)
  softBlob(ctx, sx, SUN_Y, 120, 120, PALETTE.sun, 0.6, 0)
  softBlob(ctx, sx, SUN_Y, 30, 30, 0xffffff, 1, 0.7)

  const haze = ctx.createLinearGradient(0, waterY - 220, 0, waterY)
  haze.addColorStop(0, 'rgba(238, 240, 228, 0)')
  haze.addColorStop(1, 'rgba(238, 240, 228, 0.6)')
  ctx.fillStyle = haze
  ctx.fillRect(x0, waterY - 220, w, 222)
  return p
}

function paintCloud(w: number, seed: number, res: number) {
  const h = w * 0.42
  const p = paper(-w / 2 - 20, -h - 10, w + 40, h + 24, res)
  const ctx = p.ctx
  const r = new Rng(seed)
  for (let i = 0; i < 34; i++) {
    const t = r.float()
    const arc = Math.sin(t * Math.PI)
    const x = (t - 0.5) * w * 0.92
    const y = -h * 0.18 - arc * h * 0.42 * r.range(0.5, 1)
    const rad = r.range(h * 0.14, h * 0.3) * (0.55 + arc * 0.6)
    softBlob(ctx, x, y, rad, rad, PALETTE.cloud, 0.85, 0.45)
  }
  softBlob(ctx, 0, -h * 0.12, w * 0.5, h * 0.13, PALETTE.cloud, 0.8, 0.4)
  ctx.globalCompositeOperation = 'source-atop'
  const g = ctx.createLinearGradient(0, -h, 0, 4)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.5, rgba(PALETTE.cloudShade, 0.18))
  g.addColorStop(1, rgba(PALETTE.cloudShade, 0.85))
  ctx.fillStyle = g
  ctx.fillRect(-w, -h - 10, w * 2, h + 24)
  softBlob(ctx, w * 0.22, -h * 0.7, w * 0.4, h * 0.4, 0xfffbf0, 0.6, 0)
  ctx.globalCompositeOperation = 'source-over'
  return p
}

function paintLand(W: number, waterY: number, res: number) {
  const top = waterY - 170
  const x0 = -BLEED
  const x1 = W + BLEED
  const p = paper(x0, top, x1 - x0, waterY - top + 4, res)
  const ctx = p.ctx
  const n = createNoise2D(5)
  const r = new Rng(9)

  // Far ridge, hazy and slightly soft.
  ctx.filter = 'blur(1.2px)'
  ctx.beginPath()
  ctx.moveTo(x0, waterY + 4)
  for (let x = x0; x <= x1; x += 4) {
    ctx.lineTo(x, waterY - 70 - fbm(n, x * 0.012, 0.5, 3) * 70)
  }
  ctx.lineTo(x1, waterY + 4)
  ctx.closePath()
  ctx.fillStyle = rgba(PALETTE.forestFar)
  ctx.fill()

  // Tree line: overlapping crowns with sunlit tops.
  const crownRow = (baseY: number, height: number, minR: number, maxR: number, color: number) => {
    for (let x = x0; x <= x1; x += r.range(minR * 0.7, minR * 1.2)) {
      const crownTop = baseY - fbm(n, x * 0.02, 3.3, 3) * height
      const rad = r.range(minR, maxR)
      ctx.fillStyle = rgba(color)
      ctx.beginPath()
      ctx.ellipse(x, crownTop + rad * 0.6, rad, rad * 1.15, 0, 0, TAU)
      ctx.fill()
      ctx.fillRect(x - rad, crownTop + rad * 0.6, rad * 2, waterY - crownTop)
    }
  }
  ctx.filter = 'blur(0.6px)'
  crownRow(waterY - 40, 55, 9, 16, PALETTE.forestMid)
  ctx.filter = 'none'
  crownRow(waterY - 14, 30, 10, 18, PALETTE.forestNear)

  // Sunlight and atmospheric haze, only on what was painted.
  ctx.globalCompositeOperation = 'source-atop'
  for (let i = 0; i < 160; i++) {
    const x = r.range(x0, x1)
    const y = waterY - 20 - r.range(0, 110)
    softBlob(ctx, x + 3, y, r.range(4, 9), r.range(3, 6), PALETTE.foliageLight, 0.22, 0.2)
  }
  const haze = ctx.createLinearGradient(0, top, 0, waterY)
  haze.addColorStop(0, 'rgba(225, 233, 228, 0.45)')
  haze.addColorStop(0.6, 'rgba(225, 233, 228, 0.12)')
  haze.addColorStop(1, 'rgba(20, 35, 20, 0.25)')
  ctx.fillStyle = haze
  ctx.fillRect(x0, top, x1 - x0, waterY - top + 4)
  ctx.globalCompositeOperation = 'source-over'

  // Shore grass along the water line.
  for (let x = x0; x <= x1; x += r.range(1.5, 3.5)) {
    const h = r.range(4, 18) * (0.6 + fbm(n, x * 0.05, 7, 2))
    const lean = r.range(-3, 3)
    const tone = r.float()
    ctx.strokeStyle = rgba(
      tone < 0.2 ? PALETTE.reedDry : tone < 0.6 ? PALETTE.reed : PALETTE.reedDark,
      0.9,
    )
    ctx.lineWidth = r.range(0.6, 1.4)
    ctx.beginPath()
    ctx.moveTo(x, waterY + 2)
    ctx.quadraticCurveTo(x + lean * 0.3, waterY - h * 0.6, x + lean, waterY - h)
    ctx.stroke()
  }
  grain(p, 10, 3)
  return p
}

function paintWater(W: number, H: number, waterY: number, res: number) {
  const x0 = -BLEED
  const w = W + BLEED * 2
  const h = H - waterY + BLEED
  const p = paper(x0, waterY, w, h, res * 0.5)
  const ctx = p.ctx
  const g = ctx.createLinearGradient(0, waterY, 0, waterY + h)
  g.addColorStop(0, rgba(PALETTE.waterTop))
  g.addColorStop(0.25, rgba(PALETTE.waterMid))
  g.addColorStop(1, rgba(PALETTE.waterDeep))
  ctx.fillStyle = g
  ctx.fillRect(x0, waterY, w, h)
  const n = createNoise2D(17)
  shadePixels(p, (x, y, d, i) => {
    const v = fbm(n, x * 0.015, (y - waterY) * 0.05, 3)
    const k = 0.88 + v * 0.22
    d[i] *= k
    d[i + 1] *= k
    d[i + 2] *= k
  })
  return p
}

/** Horizontal-ripple displacement map. Tileable: only whole-period sines. */
function paintDisplacementMap() {
  const size = 256
  const p = paper(0, 0, size, size, 1)
  const img = p.ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x / size
      const fy = y / size
      const i = (y * size + x) * 4
      img.data[i] = 128 + 72 * Math.sin(TAU * (fy * 6 + 0.3 * Math.sin(TAU * fx * 2)))
      img.data[i + 1] = 128 + 30 * Math.sin(TAU * (fy * 4 + fx))
      img.data[i + 2] = 128
      img.data[i + 3] = 255
    }
  }
  p.ctx.putImageData(img, 0, 0)
  return p
}

/** Small soft sparkle: a glow with a faint cross. */
function paintGlint(res: number, cross = 1) {
  const p = paper(-12, -12, 24, 24, res * 2)
  const ctx = p.ctx
  softBlob(ctx, 0, 0, 7, 7, 0xffffff, 0.9, 0.1)
  if (cross > 0) {
    softBlob(ctx, 0, 0, 12, 1.2, 0xffffff, 0.55 * cross, 0.1)
    softBlob(ctx, 0, 0, 1.2, 6, 0xffffff, 0.4 * cross, 0.1)
  }
  return p
}

/**
 * Lily pad seen at a low angle: an ellipse with a notch, radial veins, waxy
 * shine, a slightly curled darker rim and a soft shadow on the water.
 */
function paintPad(rx: number, ry: number, seed: number, res: number, shadow = true) {
  const p = paper(-rx - 8, -ry - 8, rx * 2 + 16, ry * 2 + 20, res)
  const ctx = p.ctx
  const r = new Rng(seed)
  const n = createNoise2D(seed)
  const notch = Math.PI / 2 + r.range(0.3, 0.8)

  if (shadow) softBlob(ctx, 2, 5, rx + 4, ry + 3, PALETTE.waterDeep, 0.5, 0.5)

  const path = new Path2D()
  const gap = 0.16
  path.moveTo(0, 0)
  for (let i = 0; i <= 64; i++) {
    const a = notch + gap + (i / 64) * (TAU - gap * 2)
    const wob = 1 + (n(i * 0.4, 1) - 0.5) * 0.04
    path.lineTo(Math.cos(a) * rx * wob, Math.sin(a) * ry * wob)
  }
  path.closePath()

  ctx.save()
  ctx.clip(path)
  const g = ctx.createRadialGradient(-rx * 0.15, -ry * 0.2, 0, 0, 0, rx)
  g.addColorStop(0, rgba(PALETTE.padLight))
  g.addColorStop(0.6, rgba(PALETTE.pad))
  g.addColorStop(1, rgba(PALETTE.padDark))
  ctx.fillStyle = g
  ctx.fillRect(-rx - 8, -ry - 8, rx * 2 + 16, ry * 2 + 16)

  // Age spots.
  for (let i = 0; i < Math.round(rx / 6); i++) {
    const a = r.range(0, TAU)
    const d = r.range(0.3, 0.95)
    softBlob(
      ctx,
      Math.cos(a) * rx * d,
      Math.sin(a) * ry * d,
      r.range(2, 6),
      r.range(1, 3),
      0x8a7a2a,
      0.25,
      0.3,
    )
  }
  // Veins radiating from the stem.
  ctx.strokeStyle = rgba(PALETTE.padLight, 0.45)
  ctx.lineWidth = Math.max(0.5, rx / 110)
  for (let i = 0; i < 16; i++) {
    const a = notch + 0.4 + (i / 16) * (TAU - 0.8)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(
      Math.cos(a + 0.08) * rx * 0.5,
      Math.sin(a + 0.08) * ry * 0.5,
      Math.cos(a) * rx,
      Math.sin(a) * ry,
    )
    ctx.stroke()
  }
  // Waxy sheen towards the sun (upper right), and a darker curled rim.
  softBlob(ctx, rx * 0.25, -ry * 0.35, rx * 0.55, ry * 0.35, 0xffffff, 0.16, 0)
  ctx.strokeStyle = rgba(PALETTE.padRim, 0.55)
  ctx.lineWidth = Math.max(1, rx / 45)
  ctx.stroke(path)
  ctx.restore()

  // Raised front edge catching light.
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(0, 0, rx, ry, 0, 0.15, Math.PI - 0.15)
  ctx.strokeStyle = rgba(PALETTE.padLight, 0.35)
  ctx.lineWidth = Math.max(0.6, rx / 80)
  ctx.stroke()
  ctx.restore()
  grain(p, 8, seed)
  return p
}

function paintLily(res: number) {
  const p = paper(-24, -26, 48, 34, res * 1.5)
  const ctx = p.ctx
  const petal = (angle: number, len: number, lift: number, width: number) => {
    ctx.save()
    ctx.translate(0, -lift)
    ctx.rotate(angle)
    const g = ctx.createLinearGradient(0, 0, len, 0)
    g.addColorStop(0, rgba(PALETTE.lilyPetal))
    g.addColorStop(0.7, rgba(PALETTE.lilyPetal))
    g.addColorStop(1, rgba(PALETTE.lilyPink))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(len * 0.5, -width, len, 0)
    ctx.quadraticCurveTo(len * 0.5, width, 0, 0)
    ctx.fill()
    ctx.strokeStyle = 'rgba(160, 140, 130, 0.35)'
    ctx.lineWidth = 0.4
    ctx.stroke()
    ctx.restore()
  }
  // Back petals flatter and wider, front ones more upright.
  for (let i = 0; i < 8; i++) petal(Math.PI + (i / 7) * Math.PI, 20, 2, 5)
  for (let i = 0; i < 6; i++) petal(Math.PI * 1.08 + (i / 5) * Math.PI * 0.84, 15, 6, 4.5)
  for (let i = 0; i < 4; i++) petal(Math.PI * 1.2 + (i / 3) * Math.PI * 0.6, 11, 10, 4)
  softBlob(ctx, 0, -9, 5, 3.5, PALETTE.lilyCenter, 1, 0.5)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU
    softBlob(ctx, Math.cos(a) * 3.5, -10 + Math.sin(a) * 2, 0.9, 0.9, 0xe0a020, 1, 0.5)
  }
  return p
}

function paintBlade(h: number, w: number, curve: number, res: number, blur: boolean, tone: number) {
  const pad = blur ? 12 : 4
  const p = paper(
    Math.min(0, curve) - w - pad,
    -h - pad,
    Math.abs(curve) + w * 2 + pad * 2,
    h + pad * 2,
    res,
  )
  const ctx = p.ctx
  if (blur) ctx.filter = 'blur(3px)'
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0)
  const base = tone < 0.5 ? PALETTE.reed : PALETTE.reedDark
  g.addColorStop(0, rgba(base))
  g.addColorStop(0.45, rgba(PALETTE.foliageLight, 0.95))
  g.addColorStop(1, rgba(PALETTE.reedDark))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(-w / 2, 0)
  ctx.quadraticCurveTo(-w / 2 + curve * 0.4, -h * 0.55, curve, -h)
  ctx.quadraticCurveTo(w / 2 + curve * 0.4, -h * 0.55, w / 2, 0)
  ctx.closePath()
  ctx.fill()
  if (blur) {
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = 'rgba(15, 30, 15, 0.35)'
    ctx.fillRect(p.ox, p.oy, p.w, p.h)
  }
  return p
}

function paintCattail(h: number, curve: number, res: number, blur: boolean) {
  const pad = blur ? 14 : 5
  const p = paper(
    Math.min(0, curve) - 10 - pad,
    -h - 14 - pad,
    Math.abs(curve) + 20 + pad * 2,
    h + 14 + pad * 2,
    res,
  )
  const ctx = p.ctx
  if (blur) ctx.filter = 'blur(3px)'
  const tipX = curve * 0.6
  ctx.strokeStyle = rgba(PALETTE.reedDark)
  ctx.lineWidth = blur ? 3 : 1.8
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(curve * 0.3, -h * 0.5, tipX, -h - 12)
  ctx.stroke()
  // Velvety brown head.
  const headW = blur ? 9 : 5.5
  const headH = h * 0.24
  const hy = -h * 0.9
  const g = ctx.createLinearGradient(tipX - headW, 0, tipX + headW, 0)
  g.addColorStop(0, '#3a2414')
  g.addColorStop(0.4, rgba(PALETTE.cattail))
  g.addColorStop(0.7, '#7a5232')
  g.addColorStop(1, '#2e1c10')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.roundRect(tipX * 0.95 - headW, hy - headH / 2, headW * 2, headH, headW)
  ctx.fill()
  if (blur) {
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = 'rgba(15, 25, 10, 0.3)'
    ctx.fillRect(p.ox, p.oy, p.w, p.h)
  }
  return p
}
