import { ColorMatrixFilter, Container, FillGradient, Graphics, Sprite, Texture } from 'pixi.js'
import { TAU, bump, clamp, lerp } from '../../lib/math'
import { createNoise1D } from '../../lib/noise'
import { Rng } from '../../lib/random'
import { Spring, Spring2 } from '../../lib/spring'
import {
  ellipsePath,
  grain,
  originAnchor,
  paper,
  rgba,
  softBlob,
  toTexture,
  type Paper,
} from '../draw/paint'
import { PALETTE } from '../draw/palette'
import type { TongueRoot } from './Tongue'

type Expression = 'normal' | 'swallow' | 'boop' | 'stunned'

// Cute proportions: big head, big eyes set high, small smile.
const EYE_X = 40
const EYE_Y = -122
const EYE_R = 20
const LOOK_MAX = 3.5
const MOUTH_Y = -86
const MOUTH_W = 26
const THROAT_Y = -66

const SKIN_TOP = 0xa6dc62
const SKIN_MID = 0x74bb42
const SKIN_DARK = 0x3f8228
const TUMMY = 0xf3efcf
const BLUSH = 0xff9fb0

/** Eyelids: skin toned, lighter on top where the sun hits. */
const LID_GRADIENTS = [-1, 1].map(
  (side) =>
    new FillGradient({
      type: 'linear',
      start: { x: side * EYE_X, y: EYE_Y - EYE_R },
      end: { x: side * EYE_X, y: EYE_Y + EYE_R },
      colorStops: [
        { offset: 0, color: SKIN_TOP },
        { offset: 0.7, color: SKIN_MID },
        { offset: 1, color: 0x5a9c34 },
      ],
      textureSpace: 'global',
    }),
)

/**
 * Pofik as a soft, chubby little frog: realistic lighting and skin, cute
 * proportions. Skin, eyes and tummy are painted once into textures; per frame
 * only springs move them and a small Graphics layer draws pupils, lids, blush
 * and the mouth. He stays expressive through real frog behavior: throat
 * breathing, eyes that sink when swallowing, slow blinks.
 */
export class Pofik {
  readonly view = new Container()
  private readonly rig = new Container()
  private readonly pupils = new Graphics()
  private readonly face = new Graphics()
  private shadow: Sprite | null = null
  private body: Sprite | null = null
  private throat: Sprite | null = null
  private irises: Sprite[] = []
  private shines: Sprite[] = []
  private textures: Texture[] = []
  private paintedRes = 0
  private readonly deadFilter = new ColorMatrixFilter()

  private readonly squash = new Spring(1, { freq: 2.8, damping: 0.4 })
  private readonly lean = new Spring(0, { freq: 2.2, damping: 0.5 })
  private readonly hop = new Spring(0, { freq: 2.6, damping: 0.45 })
  private readonly fullness = new Spring(1, { freq: 1.2, damping: 0.8 })
  private readonly throatBulge = new Spring(1, { freq: 3.6, damping: 0.32 })
  private readonly look = new Spring2(0, 0, { freq: 4, damping: 0.75 })
  private readonly mouthOpen = new Spring(0, { freq: 9, damping: 0.8 })
  private readonly eyeSink = new Spring(0, { freq: 5, damping: 0.6 })

  private readonly rng = new Rng(3)
  private readonly idleNoise = createNoise1D(5)
  private expression: Expression = 'normal'
  private expressionTimer = 0
  private blinkTimer = 2.5
  private blinkT = -1
  private doubleBlink = false
  private stunTimer = 0
  private invulnerable = 0
  private time = 0
  private dead = false
  private hunger01 = 1
  private lookX = 0
  private lookY = 0
  private hasLookTarget = false
  private tremble = 0
  private blush = 0

  constructor() {
    this.blinkTimer = this.rng.range(1.5, 4)
    this.deadFilter.saturate(-0.55)
    this.deadFilter.brightness(0.85, true)
    this.view.addChild(this.rig)
  }

  /** (Re)paints the textures for the given pixels-per-unit. Cheap to call; skips small changes. */
  build(res: number) {
    if (this.paintedRes && Math.abs(res - this.paintedRes) / this.paintedRes < 0.15) return
    this.paintedRes = res
    this.view.removeChildren()
    this.rig.removeChildren().forEach((c) => {
      if (c !== this.pupils && c !== this.face) c.destroy()
    })
    this.textures.forEach((t) => t.destroy(true))
    this.textures = []

    this.shadow = this.sprite(paintShadow(res))
    this.body = this.sprite(paintBody(res))
    this.throat = this.sprite(paintThroat(res))
    this.throat.position.set(0, THROAT_Y)
    const irisTex = this.texture(paintIris(res))
    const shineTex = this.texture(paintShine(res))
    this.irises = [-1, 1].map((side) => {
      const s = new Sprite(irisTex)
      s.anchor.set(0.5)
      s.position.set(side * EYE_X, EYE_Y)
      return s
    })
    this.shines = [-1, 1].map((side) => {
      const s = new Sprite(shineTex)
      s.anchor.set(0.5)
      s.position.set(side * EYE_X, EYE_Y)
      return s
    })
    this.rig.addChild(
      this.body,
      this.throat,
      ...this.irises,
      this.pupils,
      ...this.shines,
      this.face,
    )
    this.view.addChild(this.shadow, this.rig)
  }

  dispose() {
    this.textures.forEach((t) => t.destroy(true))
    this.textures = []
  }

  get isDead() {
    return this.dead
  }

  setSeat(x: number, y: number) {
    this.view.position.set(x, y)
  }

  setHunger(h01: number) {
    this.hunger01 = h01
    if (!this.dead) this.fullness.target = 0.95 + 0.09 * h01
  }

  lookAt(x: number, y: number) {
    this.lookX = x
    this.lookY = y
    this.hasLookTarget = true
  }

  clearLook() {
    this.hasLookTarget = false
  }

  /**
   * The resting tongue inside the open mouth, in world space. The tongue is
   * anchored here so it grows out of the mouth instead of starting mid-air.
   */
  tongueRoot(out: TongueRoot) {
    const { w, h } = this.mouthShape()
    const { x: sx, y: sy } = this.rig.scale
    const r = this.rig.rotation
    const ly = (MOUTH_Y + 3 + h * 0.55) * sy
    out.x = this.view.x + this.rig.x - ly * Math.sin(r)
    out.y = this.view.y + this.rig.y + ly * Math.cos(r)
    out.rx = w * 0.42 * sx
    out.ry = Math.max(1.6, h * 0.3) * sy
    out.rot = r
    return out
  }

  containsPoint(x: number, y: number) {
    const dx = (x - this.view.x) / 88
    const dy = (y - (this.view.y + this.rig.y - 76)) / 82
    return dx * dx + dy * dy <= 1
  }

  // Reactions ---------------------------------------------------------------

  /** Tongue launch: a small lunge towards the shot. */
  shoot(dirX: number) {
    this.squash.kick(1.8)
    this.lean.target = clamp(dirX * 0.2, -0.14, 0.14)
    this.lean.kick(dirX * 0.6)
    this.mouthOpen.target = 1
  }

  tongueHome() {
    this.lean.target = 0
    this.mouthOpen.target = 0
  }

  /** Frogs push their eyes down into the head to help swallow. */
  gulp(count: number) {
    this.setExpression('swallow', 0.45)
    this.eyeSink.kick(24)
    this.throatBulge.kick(2.4 + Math.min(count, 4) * 0.7)
    this.squash.kick(-1.6)
    this.blush = 1
  }

  sting(stunSeconds: number) {
    this.stunTimer = stunSeconds
    this.setExpression('stunned', stunSeconds)
    this.tremble = 1
    this.squash.kick(2.6)
    this.hop.kick(-200)
    this.lean.kick(this.rng.sign() * 2)
  }

  boop() {
    this.setExpression('boop', 0.36)
    this.squash.kick(-2.2)
    this.throatBulge.kick(2.2)
    this.hop.kick(-80)
    this.blush = 1
  }

  growl() {
    this.throatBulge.kick(-1.6)
    this.squash.kick(-0.6)
  }

  slump() {
    this.dead = true
    this.stunTimer = 0
    this.setExpression('normal', 0)
    this.squash.target = 0.88
    this.fullness.target = 0.92
    this.lean.target = 0.04
  }

  revive() {
    const wasDead = this.dead
    this.dead = false
    this.stunTimer = 0
    this.tremble = 0
    this.squash.target = 1
    this.lean.target = 0
    this.setExpression('normal', 0)
    this.blinkT = 0
    this.blush = 0.8
    if (wasDead) {
      this.squash.kick(3)
      this.hop.kick(-240)
    } else {
      this.squash.kick(2)
      this.hop.kick(-120)
    }
  }

  setInvulnerable(seconds: number) {
    this.invulnerable = seconds
  }

  // Simulation --------------------------------------------------------------

  update(dt: number) {
    this.time += dt
    const t = this.time

    if (this.hasLookTarget && this.expression !== 'stunned') {
      const hx = this.view.x
      const hy = this.view.y + this.rig.y + EYE_Y * this.rig.scale.y
      const dx = this.lookX - hx
      const dy = this.lookY - hy
      const d = Math.hypot(dx, dy) || 1
      const m = Math.min(LOOK_MAX, d * 0.02 + 1.4)
      this.look.setTarget((dx / d) * m, (dy / d) * m * 0.8)
    } else if (this.dead) {
      this.look.setTarget(0, 2)
    } else {
      this.look.setTarget(this.idleNoise(t * 0.25) * 2, this.idleNoise(t * 0.21 + 9) * 1)
    }

    this.squash.step(dt)
    this.lean.step(dt)
    this.hop.step(dt)
    this.fullness.step(dt)
    this.throatBulge.step(dt)
    this.look.step(dt)
    this.mouthOpen.step(dt)
    this.eyeSink.step(dt)

    if (this.hop.value > 0) {
      const impact = this.hop.velocity
      this.hop.value = 0
      this.hop.velocity = -impact * 0.25
      if (impact > 120) this.squash.kick(-Math.min(impact / 140, 2.4))
    }

    if (this.expressionTimer > 0) {
      this.expressionTimer -= dt
      if (this.expressionTimer <= 0) this.expression = 'normal'
    }
    if (this.stunTimer > 0) this.stunTimer -= dt
    if (this.invulnerable > 0) this.invulnerable -= dt
    this.tremble = Math.max(0, this.tremble - dt * 1.3)
    this.blush = Math.max(0, this.blush - dt * 0.8)
    this.updateBlink(dt)

    // Calm breathing in the body, fast buccal pumping in the throat.
    const breathe = Math.sin(t * TAU * 0.35) * (this.dead ? 0.004 : 0.012)
    const s = this.squash.value
    const full = this.fullness.value
    const sy = (s + breathe) * (1 + (full - 1) * 0.3)
    const sx = (1 + (1 - s) * 0.75 - breathe * 0.5) * full
    this.rig.scale.set(sx, sy)
    this.rig.rotation = this.lean.value
    this.rig.y = this.hop.value
    this.rig.x = this.tremble > 0 ? Math.sin(t * 70) * this.tremble * 1.6 : 0

    if (this.throat) {
      const pumpRate = this.dead ? 0 : this.hunger01 < 0.25 ? 1.4 : 2.4
      const pump = Math.sin(t * TAU * pumpRate) * 0.03
      const bulge = this.throatBulge.value
      this.throat.scale.set(1 + (bulge - 1) * 0.5, bulge + pump)
    }

    if (this.shadow) {
      const lift = clamp(-this.hop.value / 260, 0, 0.5)
      this.shadow.scale.set(sx * (1 - lift), 1 - lift)
      this.shadow.alpha = 1 - lift
    }

    const lifeless = this.dead
    if (lifeless !== Boolean(this.rig.filters))
      this.rig.filters = lifeless ? [this.deadFilter] : null
    this.rig.alpha = this.invulnerable > 0 && Math.sin(t * 30) > 0 ? 0.6 : 1
  }

  /** Redraws pupils, lids, blush and mouth. Called once per rendered frame. */
  render() {
    const sink = clamp(this.eyeSink.value, -2, 6)
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1
      const iris = this.irises[i]
      const shine = this.shines[i]
      if (!iris || !shine) continue
      iris.y = EYE_Y + sink
      iris.scale.set(1, 1 - sink * 0.025)
      // Catchlights shift a touch with the gaze so the eyes feel wet and alive.
      shine.position.set(side * EYE_X + this.look.x * 0.3, EYE_Y + sink + this.look.y * 0.3)
    }
    this.drawPupils(sink)
    this.drawFace(sink)
  }

  // Internals -----------------------------------------------------------------

  private texture(p: Paper) {
    const t = toTexture(p)
    this.textures.push(t)
    return t
  }

  private sprite(p: Paper) {
    const s = new Sprite(this.texture(p))
    const a = originAnchor(p)
    s.anchor.set(a.x, a.y)
    return s
  }

  private setExpression(e: Expression, seconds: number) {
    this.expression = e
    this.expressionTimer = seconds
  }

  private mouthShape() {
    const open = clamp(this.mouthOpen.value, 0, 1.2)
    return { open, w: MOUTH_W + 8 * open, h: 4 + 20 * open }
  }

  private updateBlink(dt: number) {
    if (this.blinkT >= 0) {
      this.blinkT += dt / 0.2
      if (this.blinkT >= 1) {
        if (this.doubleBlink) {
          this.doubleBlink = false
          this.blinkT = 0
        } else {
          this.blinkT = -1
          this.blinkTimer = this.rng.range(2.5, 6)
        }
      }
      return
    }
    this.blinkTimer -= dt
    if (this.blinkTimer <= 0 && this.expression === 'normal') {
      this.blinkT = 0
      this.doubleBlink = this.rng.chance(0.2)
    }
    if (this.expression === 'boop' && this.blinkT < 0) {
      this.blinkT = 0
      this.doubleBlink = true
    }
  }

  private lidLevel() {
    let level = this.dead ? 0.85 : this.hunger01 < 0.25 ? 0.2 : 0
    if (this.expression === 'stunned') level = 0.92 + Math.sin(this.time * 20) * 0.03
    if (this.expression === 'swallow') level = Math.max(level, 0.9)
    if (this.blinkT >= 0) level = lerp(level, 1, bump(this.blinkT))
    return level
  }

  private drawPupils(sink: number) {
    const g = this.pupils
    g.clear()
    // Big, nearly round pupils read as young and friendly; hungry eyes go wide.
    const dilate = this.expression === 'stunned' ? 0.75 : this.hunger01 < 0.25 ? 1.12 : 1
    for (const side of [-1, 1]) {
      const cx = side * EYE_X + this.look.x
      const cy = EYE_Y + sink + this.look.y
      g.ellipse(cx, cy, 12 * dilate, 10.5 * dilate).fill(PALETTE.pupil)
      g.ellipse(cx, cy + 4 * dilate, 8 * dilate, 4 * dilate).fill({ color: 0x2a2416, alpha: 0.5 })
    }
  }

  private drawFace(sink: number) {
    const g = this.face
    g.clear()
    const lid = this.lidLevel()
    for (const side of [-1, 1]) {
      drawLid(
        g,
        side * EYE_X,
        EYE_Y + sink * 0.4,
        EYE_R + 1.6,
        lid,
        LID_GRADIENTS[side < 0 ? 0 : 1],
      )
    }

    // Soft rosy cheeks, stronger right after a snack or a boop.
    const blushAlpha = 0.22 + this.blush * 0.25
    for (const side of [-1, 1]) {
      g.ellipse(side * 50, MOUTH_Y - 1, 10, 5.5).fill({ color: BLUSH, alpha: blushAlpha })
    }

    const { open, w, h } = this.mouthShape()
    const y = MOUTH_Y
    if (open < 0.05) {
      const sad = this.dead || this.hunger01 < 0.25
      const curve = sad ? -2 : 7
      g.moveTo(-MOUTH_W, y - 1)
        .quadraticCurveTo(0, y + curve, MOUTH_W, y - 1)
        .stroke({ width: 2.2, color: PALETTE.mouthLine, alpha: 0.85, cap: 'round' })
      if (!sad) {
        // Little upturned corners.
        for (const side of [-1, 1]) {
          g.moveTo(side * (MOUTH_W - 1), y - 0.5)
            .quadraticCurveTo(side * (MOUTH_W + 3), y - 2, side * (MOUTH_W + 4), y - 4.5)
            .stroke({ width: 1.8, color: PALETTE.mouthLine, alpha: 0.75, cap: 'round' })
        }
      }
      return
    }
    // Open: upper lip stays on the mouth line, the jaw drops below it.
    g.moveTo(-w, y)
      .quadraticCurveTo(0, y + 5, w, y)
      .bezierCurveTo(w * 0.7, y + h * 1.3, -w * 0.7, y + h * 1.3, -w, y)
      .closePath()
      .fill(PALETTE.mouthInside)
    g.ellipse(0, y + 4 + h * 0.4, w * 0.5, h * 0.35).fill({ color: 0x2a0c10, alpha: 0.6 })
    g.ellipse(0, y + 3 + h * 0.55, w * 0.42, Math.max(1.6, h * 0.3)).fill(PALETTE.tongue)
    g.moveTo(-w, y)
      .quadraticCurveTo(0, y + 5, w, y)
      .stroke({ width: 2.2, color: PALETTE.mouthLine, alpha: 0.9, cap: 'round' })
  }
}

/** Upper eyelid closing over a round eye. `level` 0 = open, 1 = closed. */
function drawLid(
  g: Graphics,
  cx: number,
  cy: number,
  r: number,
  level: number,
  fill: FillGradient,
) {
  if (level <= 0.01) return
  const s = clamp(-1 + 2 * level, -1, 1)
  const t0 = Math.asin(s)
  const edgeY = cy + r * s
  const half = r * Math.cos(t0)
  // The lid edge curves down a little, so closed eyes look content.
  const sag = 4 * (1 - Math.abs(s)) + (level > 0.85 ? 3 : 0)
  g.moveTo(cx - half, edgeY)
    .arc(cx, cy, r, Math.PI - t0, TAU + t0)
    .quadraticCurveTo(cx, edgeY + sag, cx - half, edgeY)
    .fill(fill)
  g.moveTo(cx - half, edgeY)
    .quadraticCurveTo(cx, edgeY + sag, cx + half, edgeY)
    .stroke({ width: 1.4, color: 0x24361a, alpha: 0.7, cap: 'round' })
}

// Painters -------------------------------------------------------------------

function bodyPath() {
  const path = new Path2D()
  ellipsePath(path, 0, -54, 70, 54)
  ellipsePath(path, 0, -96, 64, 38)
  ellipsePath(path, -EYE_X, EYE_Y + 2, 27, 27)
  ellipsePath(path, EYE_X, EYE_Y + 2, 27, 27)
  ellipsePath(path, -58, -20, 28, 20)
  ellipsePath(path, 58, -20, 28, 20)
  ellipsePath(path, -76, -4, 16, 5, -0.1)
  ellipsePath(path, 76, -4, 16, 5, 0.1)
  return path
}

function paintBody(res: number) {
  const p = paper(-110, -160, 220, 172, res)
  const ctx = p.ctx
  const path = bodyPath()

  ctx.save()
  ctx.clip(path)
  const base = ctx.createLinearGradient(0, -152, 0, 0)
  base.addColorStop(0, rgba(SKIN_TOP))
  base.addColorStop(0.45, rgba(SKIN_MID))
  base.addColorStop(1, rgba(SKIN_DARK))
  ctx.fillStyle = base
  ctx.fillRect(-110, -160, 220, 172)

  // Creamy tummy.
  softBlob(ctx, 0, -40, 44, 34, TUMMY, 0.62, 0.72)

  // A sprinkle of soft freckles on the back and sides, none on the face or tummy.
  const r = new Rng(12)
  for (let i = 0; i < 46; i++) {
    const x = r.range(-72, 72)
    const y = r.range(-140, -14)
    const nearFace = Math.abs(x) < 34 && y > -110 && y < -70
    const onTummy = Math.hypot(x / 46, (y + 40) / 34) < 1
    if (nearFace || onTummy) continue
    const size = r.range(1.2, 3)
    softBlob(ctx, x, y, size, size * r.range(0.7, 1), 0x4c8a2c, r.range(0.35, 0.6), 0.55)
  }
  for (let i = 0; i < 18; i++) {
    softBlob(ctx, r.range(-60, 60), r.range(-140, -60), r.range(1, 2), 1, 0xe8ffc0, 0.4, 0.5)
  }

  // Round volume, lit from the upper right, with a warm glow through the edges.
  const vol = ctx.createRadialGradient(16, -100, 24, 0, -76, 124)
  vol.addColorStop(0, 'rgba(0,0,0,0)')
  vol.addColorStop(0.7, 'rgba(20, 50, 10, 0.08)')
  vol.addColorStop(1, 'rgba(20, 50, 10, 0.4)')
  ctx.fillStyle = vol
  ctx.fillRect(-110, -160, 220, 172)
  softBlob(ctx, 58, -90, 18, 30, 0xeaffa0, 0.18, 0)

  // Eye sockets: thin dark rims the big eyeballs sit in.
  for (const side of [-1, 1]) {
    softBlob(ctx, side * EYE_X, EYE_Y, EYE_R + 2, EYE_R + 2, 0x1a2a10, 0.95, 0.88)
    softBlob(ctx, side * EYE_X + 8, EYE_Y - 22, 12, 4, 0xffffff, 0.4, 0)
  }
  // Wet, glossy highlights.
  softBlob(ctx, 10, -110, 22, 6, 0xffffff, 0.35, 0)
  softBlob(ctx, 54, -48, 10, 7, 0xffffff, 0.2, 0)
  softBlob(ctx, 22, -44, 14, 6, 0xffffff, 0.25, 0)
  for (let i = 0; i < 12; i++) {
    softBlob(ctx, r.range(-50, 60), r.range(-140, -50), r.range(0.5, 1), 0.6, 0xffffff, 0.5, 0.5)
  }
  ctx.restore()

  silhouetteShading(p, path)
  paintHands(ctx)
  grain(p, 7, 7)
  return p
}

/**
 * Inner shadow along the edge and a thin outline outside it, both traced from
 * the filled silhouette. Stroking the path would also draw every overlapping
 * ellipse the body is built from.
 */
function silhouetteShading(p: Paper, path: Path2D) {
  const { ctx, res, ox, oy, w, h } = p
  const mask = paper(ox, oy, w, h, res)
  mask.ctx.fillStyle = '#fff'
  mask.ctx.fill(path)

  const inner = paper(ox, oy, w, h, res)
  inner.ctx.setTransform(1, 0, 0, 1, 0, 0)
  inner.ctx.fillStyle = 'rgb(24, 56, 12)'
  inner.ctx.fillRect(0, 0, inner.canvas.width, inner.canvas.height)
  inner.ctx.globalCompositeOperation = 'destination-out'
  inner.ctx.filter = `blur(${6 * res}px)`
  inner.ctx.drawImage(mask.canvas, 0, 0)

  const ring = paper(ox, oy, w, h, res)
  ring.ctx.setTransform(1, 0, 0, 1, 0, 0)
  const d = Math.max(1, 1.1 * res)
  for (let a = 0; a < 8; a++) {
    ring.ctx.drawImage(mask.canvas, Math.cos((a / 8) * TAU) * d, Math.sin((a / 8) * TAU) * d)
  }
  ring.ctx.globalCompositeOperation = 'source-in'
  ring.ctx.fillStyle = 'rgb(24, 44, 14)'
  ring.ctx.fillRect(0, 0, ring.canvas.width, ring.canvas.height)
  ring.ctx.globalCompositeOperation = 'destination-out'
  ring.ctx.drawImage(mask.canvas, 0, 0)

  ctx.save()
  ctx.clip(path)
  ctx.globalAlpha = 0.4
  ctx.drawImage(inner.canvas, ox, oy, w, h)
  ctx.restore()
  ctx.save()
  ctx.globalAlpha = 0.4
  ctx.drawImage(ring.canvas, ox, oy, w, h)
  ctx.restore()
}

/** Short chubby forearms with little round toe pads tucked in front of the tummy. */
function paintHands(ctx: CanvasRenderingContext2D) {
  for (const side of [-1, 1]) {
    const arm = new Path2D()
    arm.moveTo(side * 46, -40)
    arm.quadraticCurveTo(side * 54, -22, side * 44, -7)
    arm.lineTo(side * 28, -7)
    arm.quadraticCurveTo(side * 34, -22, side * 32, -38)
    arm.closePath()
    ctx.save()
    ctx.translate(-side * 2, 2)
    ctx.filter = 'blur(3px)'
    ctx.fillStyle = 'rgba(30, 60, 14, 0.35)'
    ctx.fill(arm)
    ctx.restore()
    const g = ctx.createLinearGradient(side * 30, -24, side * 52, -24)
    g.addColorStop(0, rgba(0x5fa436))
    g.addColorStop(0.5, rgba(SKIN_MID))
    g.addColorStop(1, rgba(0x4f9030))
    ctx.fillStyle = g
    ctx.fill(arm)
    ctx.save()
    ctx.clip(arm)
    softBlob(ctx, side * 44, -32, 4, 8, 0xffffff, 0.16, 0)
    ctx.restore()

    const pads = [
      [side * 47, -3],
      [side * 40, -1],
      [side * 32, -1],
      [side * 25, -3],
    ]
    for (const [px, py] of pads) {
      ctx.fillStyle = rgba(SKIN_MID)
      ctx.beginPath()
      ctx.ellipse(px, py, 3.6, 3, 0, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = 'rgba(30, 60, 14, 0.45)'
      ctx.lineWidth = 0.6
      ctx.stroke()
      softBlob(ctx, px + 0.8, py - 1, 1.2, 0.8, 0xffffff, 0.45, 0.4)
    }
  }
}

function paintThroat(res: number) {
  const p = paper(-44, -26, 88, 52, res)
  const ctx = p.ctx
  softBlob(ctx, 0, 0, 32, 14, TUMMY, 0.22, 0.6)
  grain(p, 6, 9)
  return p
}

function paintShadow(res: number) {
  const p = paper(-100, -20, 200, 34, res * 0.5)
  softBlob(p.ctx, 0, 0, 90, 13, 0x0a1a08, 0.5, 0.35)
  return p
}

/** Warm golden iris with soft fibers and a darker rim. */
function paintIris(res: number) {
  const r = EYE_R
  const p = paper(-r, -r, r * 2, r * 2, res * 2)
  const ctx = p.ctx
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, TAU)
  ctx.clip()
  const g = ctx.createRadialGradient(2, 3, 2, 0, 0, r)
  g.addColorStop(0, '#f7dc84')
  g.addColorStop(0.55, '#e0ac48')
  g.addColorStop(0.85, '#9a6420')
  g.addColorStop(1, '#4a3010')
  ctx.fillStyle = g
  ctx.fillRect(-r, -r, r * 2, r * 2)
  const rng = new Rng(77)
  for (let i = 0; i < 60; i++) {
    const a = rng.range(0, TAU)
    const r0 = rng.range(9, 12)
    const r1 = rng.range(15, r)
    ctx.strokeStyle = rng.chance(0.5) ? 'rgba(120, 70, 15, 0.3)' : 'rgba(255, 235, 170, 0.3)'
    ctx.lineWidth = rng.range(0.3, 0.6)
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
    ctx.stroke()
  }
  const top = ctx.createLinearGradient(0, -r, 0, -r * 0.3)
  top.addColorStop(0, 'rgba(30, 20, 0, 0.35)')
  top.addColorStop(1, 'rgba(30, 20, 0, 0)')
  ctx.fillStyle = top
  ctx.fillRect(-r, -r, r * 2, r * 2)
  ctx.restore()
  return p
}

/** Two big catchlights and a tiny sparkle: the main ingredient of "cute". */
function paintShine(res: number) {
  const p = paper(-16, -16, 32, 32, res * 2)
  const ctx = p.ctx
  softBlob(ctx, 6, -7, 6, 5, 0xffffff, 0.95, 0.65)
  softBlob(ctx, -6, 7, 2.6, 2.2, 0xffffff, 0.85, 0.6)
  softBlob(ctx, 10.5, -1.5, 1.2, 1.2, 0xffffff, 0.8, 0.5)
  return p
}
