import { Container, Sprite, Texture } from 'pixi.js'
import { clamp } from '../../lib/math'

function radialTexture(stops: [number, string][]) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(128, 128, 40, 128, 128, 182)
  for (const [offset, color] of stops) g.addColorStop(offset, color)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  return Texture.from(canvas)
}

/**
 * Screen-space overlays: a constant lens vignette that darkens the corners like
 * a camera, plus a deep red edge glow that pulses while Pofik is starving and
 * flashes on stings. Lives outside the camera so shake doesn't move it.
 */
export class Vignette {
  readonly view = new Container()
  private readonly lens: Sprite
  private readonly danger: Sprite
  private pulse = 0
  private flashAmount = 0
  private time = 0

  constructor() {
    this.lens = new Sprite(
      radialTexture([
        [0, 'rgba(0, 0, 0, 0)'],
        [0.6, 'rgba(0, 0, 0, 0.06)'],
        [1, 'rgba(5, 12, 8, 0.45)'],
      ]),
    )
    this.danger = new Sprite(
      radialTexture([
        [0, 'rgba(150, 20, 20, 0)'],
        [0.55, 'rgba(150, 20, 20, 0.15)'],
        [1, 'rgba(120, 10, 15, 0.8)'],
      ]),
    )
    this.danger.alpha = 0
    this.view.addChild(this.lens, this.danger)
  }

  resize(width: number, height: number) {
    for (const s of [this.lens, this.danger]) {
      s.width = width
      s.height = height
    }
  }

  /** 0 = calm, 1 = about to starve. */
  setDanger(level: number) {
    this.pulse = clamp(level, 0, 1)
  }

  flash() {
    this.flashAmount = 1
  }

  update(dt: number) {
    this.time += dt
    this.flashAmount = Math.max(0, this.flashAmount - dt * 2.4)
    const speed = 2.5 + this.pulse * 4
    const beat = 0.5 + 0.5 * Math.sin(this.time * speed)
    const danger = this.pulse > 0 ? this.pulse * (0.3 + 0.35 * beat) : 0
    this.danger.alpha = Math.max(danger, this.flashAmount * 0.6)
    this.danger.visible = this.danger.alpha > 0.005
  }
}
