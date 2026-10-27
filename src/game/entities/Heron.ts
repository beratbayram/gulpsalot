import { Container, Graphics } from 'pixi.js'
import { clamp, easeInOutSine } from '../../lib/math'
import { CONFIG } from '../config'
import { PALETTE } from '../draw/palette'

export type HeronState = 'idle' | 'warn' | 'pass'
export type HeronEvent = 'pass' | 'done' | null

const H = CONFIG.heron
const BLEED = 400

/**
 * A heron flying over the pond, seen only as its shadow. A call warns first;
 * while the shadow passes, Gulpsalot has to hold still.
 */
export class Heron {
  readonly view = new Container()
  state: HeronState = 'idle'
  /** The pass where Gulpsalot was already pecked, so it only happens once. */
  spotted = false

  private readonly dim = new Graphics()
  private readonly bird = new Graphics()
  private t = 0
  private dir = 1
  private width = 400
  private y = 300

  constructor() {
    drawHeron(this.bird)
    this.view.addChild(this.dim, this.bird)
    this.view.visible = false
  }

  get busy() {
    return this.state !== 'idle'
  }

  get watching() {
    return this.state === 'pass'
  }

  get x() {
    return this.bird.x
  }

  get birdY() {
    return this.bird.y
  }

  start(dir: number, worldW: number, worldH: number, y: number) {
    this.state = 'warn'
    this.spotted = false
    this.t = 0
    this.dir = dir
    this.width = worldW
    this.y = y
    this.dim
      .clear()
      .rect(-BLEED, -BLEED, worldW + BLEED * 2, worldH + BLEED * 2)
      .fill(PALETTE.ink)
    this.dim.alpha = 0
    this.bird.position.set(dir > 0 ? -260 : worldW + 260, y)
    this.bird.scale.set(dir * 1.7, 1.7)
    this.view.visible = true
  }

  cancel() {
    this.state = 'idle'
    this.view.visible = false
  }

  update(dt: number): HeronEvent {
    if (this.state === 'idle') return null
    this.t += dt
    if (this.state === 'warn') {
      this.dim.alpha = 0.1 * clamp(this.t / H.warn, 0, 1)
      if (this.t < H.warn) return null
      this.state = 'pass'
      this.t = 0
      return 'pass'
    }
    const u = clamp(this.t / H.pass, 0, 1)
    const from = this.dir > 0 ? -260 : this.width + 260
    const to = this.dir > 0 ? this.width + 260 : -260
    this.bird.x = from + (to - from) * easeInOutSine(u)
    this.bird.y = this.y + Math.sin(u * Math.PI) * 30
    // Slow wing beats, drawn as a gentle squash.
    this.bird.scale.y = 1.7 * (0.85 + 0.15 * Math.cos(this.t * 4.2))
    this.dim.alpha = 0.1 + 0.08 * Math.sin(u * Math.PI)
    if (u < 1) return null
    this.cancel()
    return 'done'
  }
}

/** Big soft silhouette: spread wings, a folded neck and trailing legs. Faces right. */
function drawHeron(g: Graphics) {
  const shadow = { color: PALETTE.ink, alpha: 0.32 }
  // Wings.
  g.moveTo(-20, 0)
    .quadraticCurveTo(-30, -70, -10, -96)
    .quadraticCurveTo(10, -50, 26, -6)
    .closePath()
    .fill(shadow)
  g.moveTo(-14, 4)
    .quadraticCurveTo(-34, 60, -6, 92)
    .quadraticCurveTo(12, 46, 26, 8)
    .closePath()
    .fill(shadow)
  // Body, folded neck, head and long beak.
  g.ellipse(4, 2, 44, 14).fill(shadow)
  g.moveTo(40, -4)
    .quadraticCurveTo(58, -16, 52, 2)
    .quadraticCurveTo(60, 8, 70, 2)
    .lineTo(104, 6)
    .lineTo(70, 10)
    .quadraticCurveTo(52, 16, 40, 8)
    .closePath()
    .fill(shadow)
  // Legs trailing behind.
  g.moveTo(-38, 0).lineTo(-96, -4).lineTo(-96, 4).lineTo(-38, 6).closePath().fill(shadow)
}
