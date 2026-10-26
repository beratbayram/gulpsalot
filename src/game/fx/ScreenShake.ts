import { createNoise1D } from '../../lib/noise'
import { CONFIG } from '../config'

/**
 * Trauma-based shake: impacts add trauma, which decays over time. The visible
 * shake is trauma squared, so small hits stay subtle and big ones pop.
 */
export class ScreenShake {
  x = 0
  y = 0
  angle = 0
  /** Multiplier for reduced-motion users. */
  intensity = 1
  private trauma = 0
  private time = 0
  private readonly nx = createNoise1D(31)
  private readonly ny = createNoise1D(37)
  private readonly na = createNoise1D(41)

  add(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  update(dt: number) {
    this.time += dt
    this.trauma = Math.max(0, this.trauma - CONFIG.fx.shakeDecay * dt)
    const s = this.trauma * this.trauma * this.intensity
    const f = this.time * 28
    this.x = CONFIG.fx.shakeMaxOffset * s * this.nx(f)
    this.y = CONFIG.fx.shakeMaxOffset * s * this.ny(f + 100)
    this.angle = CONFIG.fx.shakeMaxAngle * s * this.na(f + 200)
  }
}
