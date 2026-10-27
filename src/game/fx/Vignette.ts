import { Sprite, Texture } from 'pixi.js'
import { clamp } from '../../lib/math'

/**
 * Red screen-edge glow. Pulses while Gulpsalot is starving and flashes on stings.
 * Lives in screen space so shake doesn't move it.
 */
export class Vignette {
  readonly sprite: Sprite
  private pulse = 0
  private flashAmount = 0
  private time = 0

  constructor() {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const ctx = canvas.getContext('2d')!
    const g = ctx.createRadialGradient(128, 128, 60, 128, 128, 182)
    g.addColorStop(0, 'rgba(255, 70, 70, 0)')
    g.addColorStop(0.55, 'rgba(255, 60, 60, 0.18)')
    g.addColorStop(1, 'rgba(225, 30, 40, 0.85)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
    this.sprite = new Sprite(Texture.from(canvas))
    this.sprite.alpha = 0
  }

  resize(width: number, height: number) {
    this.sprite.width = width
    this.sprite.height = height
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
    const speed = 3 + this.pulse * 5
    const beat = 0.5 + 0.5 * Math.sin(this.time * speed)
    const danger = this.pulse > 0 ? this.pulse * (0.35 + 0.4 * beat) : 0
    this.sprite.alpha = Math.max(danger, this.flashAmount * 0.75)
    this.sprite.visible = this.sprite.alpha > 0.005
  }
}
