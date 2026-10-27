import {
  ColorMatrixFilter,
  Container,
  FillGradient,
  Graphics,
  GraphicsPath,
  Sprite,
  Texture,
} from 'pixi.js'
import { TAU, bump, clamp, lerp, mixColor } from '../../lib/math'
import { createNoise1D } from '../../lib/noise'
import { Rng } from '../../lib/random'
import { Spring, Spring2 } from '../../lib/spring'
import { DEFAULT_LOOK, skinColors, type Look, type SkinColors } from '../cosmetics'
import { HAT_ANCHOR, HAT_ART, HAT_OUTLINE, type HatArt } from '../draw/hats'
import { PALETTE } from '../draw/palette'
import type { TongueRoot } from './Tongue'

type Expression = 'normal' | 'happy' | 'boop' | 'stunned' | 'yuck' | 'burp' | 'yawn'

const EYE_X = 36
const EYE_Y = -114
const EYE_R = 19
const PUPIL_R = 8.5
const LOOK_MAX = 7
const MOUTH_Y = -64
const OUTLINE = 4

/**
 * Gulpsalot himself. Static body parts are drawn once; the face is redrawn every
 * frame because eyes, lids and mouth change continuously. All motion comes
 * from springs so every reaction overlaps and settles naturally.
 */
export class Gulpsalot {
  readonly view = new Container()
  private readonly shadow = new Graphics()
  private readonly rig = new Container()
  private readonly body = new Graphics()
  private readonly belly = new Graphics()
  private readonly face = new Graphics()
  /** Eye whites and pupils, apart from the face so they can glow at night. */
  private readonly eyes = new Graphics()
  /** Soft halos around the eyes, faded in after dark. */
  private readonly eyeGlow = new Container()
  private readonly hat = new Container()
  private readonly stars = new Container()
  private readonly starList: Graphics[] = []
  /** Blends Gulpsalot towards red when stung. A plain tint would multiply green into brown. */
  private readonly hurtFilter = new ColorMatrixFilter()

  private readonly squash = new Spring(1, { freq: 3.2, damping: 0.32 })
  private readonly lean = new Spring(0, { freq: 2.4, damping: 0.45 })
  private readonly hop = new Spring(0, { freq: 2.6, damping: 0.42 })
  private readonly fullness = new Spring(1, { freq: 1.4, damping: 0.75 })
  private readonly bellyBulge = new Spring(1, { freq: 4.2, damping: 0.28 })
  private readonly look = new Spring2(0, 0, { freq: 5, damping: 0.62 })
  private readonly mouthOpen = new Spring(0, { freq: 9, damping: 0.75 })
  private readonly cheeks = new Spring(0, { freq: 5, damping: 0.45 })
  /** The hat lags behind Gulpsalot's moves and wobbles back. */
  private readonly hatTilt = new Spring(0, { freq: 3.4, damping: 0.3 })

  private readonly rng = new Rng(3)
  private readonly idleNoise = createNoise1D(5)
  private expression: Expression = 'normal'
  private expressionTimer = 0
  private blinkTimer = 2
  private blinkT = -1
  private doubleBlink = false
  private stunTimer = 0
  private invulnerable = 0
  private flash = 0
  private blush = 0
  private time = 0
  private dead = false
  private hunger01 = 1
  /** 0 = day, 1 = dusk, 2 = night: Gulpsalot gets sleepy at dusk and his eyes glow at night. */
  private sky = 0
  /** Crouching low while a heron passes. */
  private hiding = false
  private lookX = 0
  private lookY = 0
  private hasLookTarget = false
  private outfit: Look = DEFAULT_LOOK
  private skin: SkinColors = skinColors(DEFAULT_LOOK.skin)
  private skinGradient: FillGradient | null = null

  constructor() {
    this.drawShadow()
    this.drawBody()
    this.drawBelly()
    this.buildStars()
    this.belly.position.set(0, -36)
    const k = 0.62
    this.hurtFilter.matrix = [
      1 - k,
      0,
      0,
      0,
      k * 1.0,
      0,
      1 - k,
      0,
      0,
      k * 0.36,
      0,
      0,
      1 - k,
      0,
      k * 0.38,
      0,
      0,
      0,
      1,
      0,
    ]
    this.hat.position.set(HAT_ANCHOR.x, HAT_ANCHOR.y)
    for (const side of [-1, 1]) {
      const halo = new Sprite(haloTexture())
      halo.anchor.set(0.5)
      halo.blendMode = 'add'
      halo.tint = 0xfff2b0
      halo.scale.set(0.6)
      halo.position.set(side * EYE_X, EYE_Y)
      this.eyeGlow.addChild(halo)
    }
    this.eyeGlow.alpha = 0
    this.rig.addChild(this.body, this.belly, this.eyeGlow, this.eyes, this.face, this.hat)
    this.view.addChild(this.shadow, this.rig, this.stars)
  }

  /** Skin and hat. Redraws the body, so call it only when the look changes. */
  setLook(look: Look) {
    if (look.skin !== this.outfit.skin) {
      this.skin = skinColors(look.skin)
      this.drawBody()
      this.drawBelly()
    }
    if (look.hat !== this.outfit.hat) {
      this.hat.removeChildren().forEach((c) => c.destroy())
      if (look.hat !== 'none') this.hat.addChild(drawHat(HAT_ART[look.hat]))
      this.hatTilt.kick(4)
      this.squash.kick(-2)
    }
    this.outfit = look
  }

  get isDead() {
    return this.dead
  }

  setSeat(x: number, y: number) {
    this.view.position.set(x, y)
  }

  setHunger(h01: number) {
    this.hunger01 = h01
    if (!this.dead) this.fullness.target = 0.92 + 0.14 * h01
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
    const open = clamp(this.mouthOpen.value, 0, 1.25)
    const h = 4 + 26 * open
    const w = 24 + 9 * open
    const { x: sx, y: sy } = this.rig.scale
    const r = this.rig.rotation
    const ly = (MOUTH_Y + h * 0.72) * sy
    out.x = this.view.x - ly * Math.sin(r)
    out.y = this.view.y + this.rig.y + ly * Math.cos(r)
    out.rx = w * 0.45 * sx
    out.ry = Math.max(2, h * 0.25) * sy
    out.rot = r
    return out
  }

  containsPoint(x: number, y: number) {
    const dx = (x - this.view.x) / 88
    const dy = (y - (this.view.y + this.rig.y - 72)) / 82
    return dx * dx + dy * dy <= 1
  }

  // Reactions ---------------------------------------------------------------

  /** Tongue launch: stretch towards the shot and lean into it. */
  shoot(dirX: number) {
    this.squash.kick(2.6)
    this.hatTilt.kick(-dirX * 2.2)
    this.lean.target = clamp(dirX * 0.28, -0.2, 0.2)
    this.lean.kick(dirX * 0.8)
    this.mouthOpen.target = 1
  }

  tongueHome() {
    this.lean.target = 0
    this.mouthOpen.target = 0
  }

  gulp(count: number) {
    this.setExpression('happy', 0.5)
    this.cheeks.kick(9)
    this.bellyBulge.kick(2.6 + Math.min(count, 4) * 0.8)
    this.squash.kick(-2.2)
    this.blush = 1
  }

  sting(stunSeconds: number) {
    this.stunTimer = stunSeconds
    this.setExpression('stunned', stunSeconds)
    this.flash = 1
    this.squash.kick(4.2)
    this.hop.kick(-260)
    this.lean.kick(this.rng.sign() * 3)
    this.hatTilt.kick(this.rng.sign() * 7)
  }

  boop() {
    this.setExpression('boop', 0.42)
    this.squash.kick(-3.4)
    this.bellyBulge.kick(2.2)
    this.hop.kick(-90)
    this.hatTilt.kick(this.rng.sign() * 3)
    this.blush = 1
  }

  growl() {
    this.bellyBulge.kick(-2.4)
    this.squash.kick(-0.9)
  }

  /** Swallowed something bitter (a ladybug). */
  yuck() {
    this.setExpression('yuck', 0.95)
    this.squash.kick(2.4)
    this.lean.kick(this.rng.sign() * 1.6)
    this.hatTilt.kick(this.rng.sign() * 4)
    this.cheeks.kick(-4)
  }

  /** A big burp: belly squeezes, mouth pops wide open. */
  burp() {
    this.setExpression('burp', 0.7)
    this.bellyBulge.kick(-5)
    this.squash.kick(4)
    this.hop.kick(-140)
    this.hatTilt.kick(this.rng.sign() * 6)
    this.blush = 1
  }

  /** A big bored yawn, after a long time without a catch. */
  yawn() {
    if (this.expression !== 'normal' || this.dead) return
    this.setExpression('yawn', 1.3)
    this.squash.kick(-1.4)
    this.hatTilt.kick(this.rng.sign() * 1.5)
  }

  /**
   * Time-of-day tint for everything but the eyes, which stay bright after dark
   * so they seem to glow.
   */
  setAmbient(color: number, sky: number) {
    this.sky = sky
    const night = clamp(sky - 1, 0, 1)
    for (const part of [this.body, this.belly, this.face, this.hat, this.shadow]) part.tint = color
    this.eyes.tint = mixColor(color, PALETTE.white, night * 0.85)
    this.eyeGlow.alpha = night * 0.4
  }

  /** Crouch and keep still while a heron's shadow passes. */
  setHiding(on: boolean) {
    if (on === this.hiding) return
    this.hiding = on
    if (this.dead) return
    this.squash.target = on ? 0.86 : 1
    this.squash.kick(on ? -1.6 : 2)
  }

  slump() {
    this.dead = true
    this.stunTimer = 0
    this.setExpression('normal', 0)
    this.squash.target = 0.84
    this.fullness.target = 0.88
    this.lean.target = 0.05
  }

  revive() {
    const wasDead = this.dead
    this.dead = false
    this.hiding = false
    this.flash = 0
    this.stunTimer = 0
    this.squash.target = 1
    this.lean.target = 0
    this.setExpression('happy', 0.7)
    if (wasDead) {
      this.squash.kick(5)
      this.hop.kick(-320)
    } else {
      this.squash.kick(3)
      this.hop.kick(-160)
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
      const m = Math.min(LOOK_MAX, d * 0.04 + 2)
      this.look.setTarget((dx / d) * m, (dy / d) * m * 0.85)
    } else if (this.dead) {
      this.look.setTarget(0, 5)
    } else {
      this.look.setTarget(this.idleNoise(t * 0.35) * 5, this.idleNoise(t * 0.29 + 9) * 3)
    }

    this.squash.step(dt)
    this.lean.step(dt)
    this.hop.step(dt)
    this.fullness.step(dt)
    this.bellyBulge.step(dt)
    this.look.step(dt)
    this.mouthOpen.step(dt)
    this.cheeks.step(dt)
    this.hatTilt.target = -this.lean.value * 0.6 + (this.dead ? 0.25 : 0)
    this.hatTilt.step(dt)

    // The pad is solid: hops bounce off it with a landing squash.
    if (this.hop.value > 0) {
      const impact = this.hop.velocity
      this.hop.value = 0
      this.hop.velocity = -impact * 0.3
      if (impact > 120) this.squash.kick(-Math.min(impact / 110, 3.5))
    }

    if (this.expressionTimer > 0) {
      this.expressionTimer -= dt
      if (this.expressionTimer <= 0) this.expression = 'normal'
    }
    if (this.stunTimer > 0) this.stunTimer -= dt
    if (this.invulnerable > 0) this.invulnerable -= dt
    this.flash = Math.max(0, this.flash - dt * 2.2)
    this.blush = Math.max(0, this.blush - dt * 0.9)
    this.updateBlink(dt)

    const breathe = Math.sin(t * TAU * 0.45) * (this.dead ? 0.008 : 0.018)
    const s = this.squash.value
    const full = this.fullness.value
    const sy = (s + breathe) * (1 + (full - 1) * 0.35)
    const sx = (1 + (1 - s) * 0.85 - breathe * 0.6) * full
    this.rig.scale.set(sx, sy)
    this.rig.rotation = this.lean.value
    this.rig.y = this.hop.value
    // Hops lift the hat a little off the head.
    this.hat.rotation = this.hatTilt.value
    this.hat.y = HAT_ANCHOR.y + clamp(this.hop.velocity * 0.012, -6, 4)
    const bb = this.bellyBulge.value
    this.belly.scale.set(bb, 1 + (bb - 1) * 0.6)

    const lift = clamp(-this.hop.value / 300, 0, 0.5)
    this.shadow.scale.set(sx * (1 - lift), 1 - lift)
    this.shadow.alpha = 1 - lift

    const hurt = this.flash > 0.01
    if (hurt !== Boolean(this.rig.filters)) this.rig.filters = hurt ? [this.hurtFilter] : null
    if (hurt) this.hurtFilter.alpha = Math.min(1, this.flash * 1.2)
    this.rig.alpha = this.invulnerable > 0 && Math.sin(t * 38) > 0 ? 0.55 : 1

    this.updateStars(dt)
  }

  /** Redraws the face. Called once per rendered frame, not per simulation step. */
  render() {
    this.drawFace()
  }

  private setExpression(e: Expression, seconds: number) {
    this.expression = e
    this.expressionTimer = seconds
  }

  private updateBlink(dt: number) {
    // Slow, heavy blinks once the sun goes down.
    const dusk = clamp(this.sky, 0, 1)
    if (this.blinkT >= 0) {
      this.blinkT += dt / lerp(0.14, 0.32, dusk)
      if (this.blinkT >= 1) {
        if (this.doubleBlink) {
          this.doubleBlink = false
          this.blinkT = 0
        } else {
          this.blinkT = -1
          this.blinkTimer = this.rng.range(1.8, 5) * lerp(1, 0.7, dusk)
        }
      }
      return
    }
    this.blinkTimer -= dt
    if (this.blinkTimer <= 0 && this.expression === 'normal') {
      this.blinkT = 0
      this.doubleBlink = this.rng.chance(0.22)
    }
  }

  private lidLevel() {
    const sleepy = 0.06 + 0.16 * clamp(this.sky, 0, 1)
    let level = this.dead ? 0.6 : this.hunger01 < 0.25 ? 0.32 : sleepy
    if (this.blinkT >= 0) level = lerp(level, 1, bump(this.blinkT))
    return level
  }

  private updateStars(dt: number) {
    const visible = this.stunTimer > 0
    const targetAlpha = visible ? 1 : 0
    this.stars.alpha += (targetAlpha - this.stars.alpha) * Math.min(1, dt * 12)
    this.stars.visible = this.stars.alpha > 0.01
    if (!this.stars.visible) return
    const cy = this.rig.y - 158
    this.starList.forEach((s, i) => {
      const a = this.time * 5.5 + (i / this.starList.length) * TAU
      s.position.set(Math.cos(a) * 52, cy + Math.sin(a) * 13)
      s.rotation = this.time * 4 + i
      s.scale.set(0.8 + 0.25 * Math.sin(a))
      s.zIndex = Math.sin(a)
    })
  }

  // Drawing -----------------------------------------------------------------

  private drawShadow() {
    this.shadow.ellipse(0, -2, 82, 14).fill({ color: 0x1f5c33, alpha: 0.28 })
  }

  private drawBody() {
    const g = this.body.clear()
    const skin = this.skin
    const ink = PALETTE.ink
    const o = OUTLINE

    // Outline pass: every silhouette shape slightly bigger in ink, so the
    // fills merge into one blob with a single clean outline.
    g.ellipse(-58, -22, 30 + o, 22 + o).fill(ink)
    g.ellipse(58, -22, 30 + o, 22 + o).fill(ink)
    g.ellipse(0, -58, 76 + o, 58 + o).fill(ink)
    g.circle(-EYE_X, EYE_Y + 2, 27 + o).fill(ink)
    g.circle(EYE_X, EYE_Y + 2, 27 + o).fill(ink)
    for (const side of [-1, 1]) {
      g.ellipse(side * 30, -5, 19 + o, 9 + o).fill(ink)
      for (const tx of [-11, 0, 11]) g.circle(side * 30 + tx, -1, 4.5 + o - 1).fill(ink)
    }

    this.skinGradient?.destroy()
    const gradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: -142 },
      end: { x: 0, y: 0 },
      colorStops: [
        { offset: 0, color: skin.bodyLight },
        { offset: 0.5, color: skin.body },
        { offset: 1, color: skin.bodyShade },
      ],
      textureSpace: 'global',
    })
    this.skinGradient = gradient
    g.ellipse(-58, -22, 30, 22).fill(skin.bodyShade)
    g.ellipse(58, -22, 30, 22).fill(skin.bodyShade)
    g.ellipse(0, -58, 76, 58).fill(gradient)
    g.circle(-EYE_X, EYE_Y + 2, 27).fill(gradient)
    g.circle(EYE_X, EYE_Y + 2, 27).fill(gradient)

    // Spots, kept clear of the eyes and the cheek blush.
    g.circle(-60, -80, 5).fill(skin.bodySpot)
    g.circle(-64, -42, 4).fill(skin.bodySpot)
    g.circle(63, -40, 4.5).fill(skin.bodySpot)
    g.circle(52, -82, 3.5).fill(skin.bodySpot)

    // Front feet with toes.
    for (const side of [-1, 1]) {
      const fx = side * 30
      g.ellipse(fx, -5, 19, 9).fill(skin.bodyShade)
      for (const tx of [-11, 0, 11]) g.circle(fx + tx, -1, 4.5).fill(skin.bodyShade)
      g.moveTo(fx - 5.5, -4)
        .lineTo(fx - 5.5, 1)
        .moveTo(fx + 5.5, -4)
        .lineTo(fx + 5.5, 1)
        .stroke({
          width: 2,
          color: ink,
          alpha: 0.45,
          cap: 'round',
        })
    }
  }

  private drawBelly() {
    const g = this.belly.clear()
    g.ellipse(0, 0, 50, 31).fill(this.skin.belly)
    g.moveTo(-26, 12).quadraticCurveTo(0, 20, 26, 12).stroke({
      width: 2,
      color: this.skin.bodyShade,
      alpha: 0.35,
      cap: 'round',
    })
  }

  private buildStars() {
    for (let i = 0; i < 3; i++) {
      const s = new Graphics()
      s.star(0, 0, 5, 9, 4.2)
        .fill(PALETTE.star)
        .stroke({ width: 2.5, color: PALETTE.ink, join: 'round' })
      this.stars.addChild(s)
      this.starList.push(s)
    }
    this.stars.sortableChildren = true
    this.stars.alpha = 0
    this.stars.visible = false
  }

  private drawFace() {
    const g = this.face
    const e = this.eyes
    const ink = PALETTE.ink
    g.clear()
    e.clear()

    const worried =
      (this.hunger01 < 0.25 || this.dead || this.hiding) && this.expression !== 'happy'

    for (const side of [-1, 1]) {
      const ex = side * EYE_X
      const ey = EYE_Y
      switch (this.expression) {
        case 'burp':
        case 'yawn':
        case 'happy':
          g.arc(ex, ey + 7, 11, Math.PI + 0.35, TAU - 0.35).stroke({
            width: 4.5,
            color: ink,
            cap: 'round',
          })
          break
        case 'boop': {
          const d = side * -1
          g.moveTo(ex - 7 * d, ey - 8)
            .lineTo(ex + 7 * d, ey)
            .lineTo(ex - 7 * d, ey + 8)
            .stroke({ width: 4.5, color: ink, cap: 'round', join: 'round' })
          break
        }
        case 'yuck': {
          // Eyes squeezed shut.
          g.moveTo(ex - 11, ey + 1)
            .lineTo(ex - 3, ey - 3)
            .lineTo(ex + 3, ey + 3)
            .lineTo(ex + 11, ey - 1)
            .stroke({ width: 4.5, color: ink, cap: 'round', join: 'round' })
          break
        }
        case 'stunned': {
          e.circle(ex, ey, EYE_R).fill(PALETTE.white).stroke({ width: 3, color: ink })
          const spin = this.time * 9 * side
          g.moveTo(ex, ey)
          for (let k = 1; k <= 24; k++) {
            const a = (k / 24) * TAU * 2.2
            const r = (k / 24) * (EYE_R - 5)
            g.lineTo(ex + Math.cos(a + spin) * r, ey + Math.sin(a + spin) * r)
          }
          g.stroke({ width: 2.8, color: ink, cap: 'round', join: 'round' })
          break
        }
        default: {
          e.circle(ex, ey, EYE_R).fill(PALETTE.white).stroke({ width: 3, color: ink })
          const px = ex + this.look.x
          const py = ey + this.look.y
          e.circle(px, py, PUPIL_R).fill(ink)
          e.circle(px - 3, py - 3.5, 2.8).fill(PALETTE.white)
          const lid = this.lidLevel()
          if (lid > 0.02) drawLid(g, ex, ey, EYE_R, lid, this.skin.body)
        }
      }

      if (worried) {
        g.moveTo(ex + side * 13, ey - 28)
          .lineTo(ex - side * 9, ey - 35)
          .stroke({ width: 4, color: ink, cap: 'round' })
      }
    }

    // Puffed cheeks while swallowing.
    const puff = clamp(this.cheeks.value / 6, 0, 1.2)
    if (puff > 0.03) {
      for (const side of [-1, 1]) {
        g.circle(side * 46, MOUTH_Y - 4, 5 + 10 * puff)
          .fill(this.skin.body)
          .stroke({ width: 3, color: ink })
      }
    }

    const blushAlpha = 0.62 + this.blush * 0.33
    g.ellipse(-52, MOUTH_Y + 4, 11, 6).fill({ color: PALETTE.blush, alpha: blushAlpha })
    g.ellipse(52, MOUTH_Y + 4, 11, 6).fill({ color: PALETTE.blush, alpha: blushAlpha })

    const open = clamp(this.mouthOpen.value, 0, 1.25)
    if (this.expression === 'yawn') {
      // A tall, slow yawn that opens and closes with the expression timer.
      const open = bump(1 - this.expressionTimer / 1.3)
      g.ellipse(0, MOUTH_Y + 6 + 10 * open, 12 + 4 * open, 4 + 18 * open)
        .fill(PALETTE.mouth)
        .stroke({ width: 3.5, color: ink })
      if (open > 0.3) g.ellipse(0, MOUTH_Y + 14 + 18 * open, 8, 4 * open).fill(PALETTE.tongue)
    } else if (this.expression === 'burp') {
      g.ellipse(0, MOUTH_Y + 10, 17, 15)
        .fill(PALETTE.mouth)
        .stroke({ width: 3.5, color: ink })
      g.ellipse(0, MOUTH_Y + 17, 9, 5).fill(PALETTE.tongue)
    } else if (this.expression === 'boop') {
      g.ellipse(0, MOUTH_Y + 2, 7, 6)
        .fill(PALETTE.mouth)
        .stroke({ width: 3, color: ink })
    } else if (this.expression === 'yuck' && open < 0.06) {
      // Wobbly frown with the tongue poking out.
      g.ellipse(9, MOUTH_Y + 9, 8, 7)
        .fill(PALETTE.tongue)
        .stroke({ width: 3, color: ink })
      g.moveTo(-26, MOUTH_Y + 2)
        .quadraticCurveTo(-13, MOUTH_Y - 6, 0, MOUTH_Y + 1)
        .quadraticCurveTo(13, MOUTH_Y + 8, 26, MOUTH_Y)
        .stroke({ width: 4, color: ink, cap: 'round' })
    } else if (open < 0.06) {
      const curve = this.dead ? -9 : this.expression === 'stunned' ? -4 : 13
      g.moveTo(-30, MOUTH_Y)
        .quadraticCurveTo(0, MOUTH_Y + curve, 30, MOUTH_Y)
        .stroke({ width: 4, color: ink, cap: 'round' })
    } else {
      const w = 24 + 9 * open
      const h = 4 + 26 * open
      g.moveTo(-w, MOUTH_Y)
        .quadraticCurveTo(0, MOUTH_Y + 7, w, MOUTH_Y)
        .quadraticCurveTo(w * 0.85, MOUTH_Y + h * 1.15, 0, MOUTH_Y + h)
        .quadraticCurveTo(-w * 0.85, MOUTH_Y + h * 1.15, -w, MOUTH_Y)
        .closePath()
        .fill(PALETTE.mouth)
        .stroke({ width: 3.5, color: ink, join: 'round' })
      g.ellipse(0, MOUTH_Y + h * 0.72, w * 0.45, Math.max(2, h * 0.25)).fill(PALETTE.tongue)
    }
  }
}

/**
 * Eyelid covering the top of an eye. `level` 0 = open, 1 = closed. Uses the
 * eye's own radius so the lid line ends inside the eye outline instead of
 * poking out past it.
 */
function drawLid(g: Graphics, cx: number, cy: number, r: number, level: number, color: number) {
  const s = clamp(-1 + 2 * level, -1, 1)
  const t0 = Math.asin(s)
  const edgeY = cy + r * s
  const half = r * Math.cos(t0)
  g.moveTo(cx - half, edgeY)
    .arc(cx, cy, r, Math.PI - t0, TAU + t0)
    .closePath()
    .fill(color)
  g.moveTo(cx - half, edgeY)
    .arc(cx, cy, r, Math.PI - t0, TAU + t0)
    .stroke({ width: 3, color: PALETTE.ink })
  g.moveTo(cx - half, edgeY)
    .lineTo(cx + half, edgeY)
    .stroke({ width: 3, color: PALETTE.ink, cap: 'butt' })
}

/** Builds a hat from its shape data (see draw/hats.ts). */
function drawHat(art: HatArt) {
  const g = new Graphics()
  const ink = PALETTE.ink
  for (const shape of art.shapes) {
    switch (shape.type) {
      case 'path':
        g.path(new GraphicsPath(shape.d))
        if (shape.fill !== undefined) g.fill(shape.fill)
        if (shape.line !== undefined)
          g.stroke({ width: shape.width ?? 2, color: shape.line, cap: 'round', join: 'round' })
        break
      case 'circle':
        g.circle(shape.x, shape.y, shape.r).fill(shape.fill)
        break
      case 'ellipse':
        g.ellipse(shape.x, shape.y, shape.rx, shape.ry).fill(shape.fill)
        break
    }
    if (shape.outline) g.stroke({ width: HAT_OUTLINE, color: ink, join: 'round' })
  }
  g.position.set(art.x, art.y)
  g.rotation = art.rotation
  return g
}

let halo: Texture | null = null

/**
 * Soft round glow for the eyes at night. Rebuilt if a destroyed game took the
 * cached one with it (React StrictMode mounts the game twice in dev).
 */
function haloTexture() {
  if (halo && !halo.destroyed) return halo
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
  g.addColorStop(0.4, 'rgba(255, 255, 255, 0.35)')
  g.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  halo = Texture.from(canvas)
  return halo
}
