import { Container, Graphics } from 'pixi.js'
import { clamp } from '../../lib/math'
import { CONFIG } from '../config'
import { PALETTE } from '../draw/palette'
import type { Insect } from './Insect'

export type FishState = 'idle' | 'lurk' | 'leap'
export type FishEvent = 'jump' | 'apex' | 'splash' | null

const F = CONFIG.fish

/**
 * A pond fish that sometimes leaps out and snatches a low-flying insect.
 * Bubbles and a dark shape under the water give a moment of warning, so the
 * player can race it to the catch.
 */
export class Fish {
  /** The leaping fish, drawn among the insects. */
  readonly view = new Container()
  /** Its shape under the water while it lurks, drawn behind Gulpsalot. */
  readonly shadow = new Graphics()
  state: FishState = 'idle'
  target: Insect | null = null
  /** The insect in its mouth, carried back into the water. */
  prey: Insect | null = null

  private readonly body = new Graphics()
  private t = 0
  private dir = 1
  private x = 0
  private y = 0
  private waterY = 0
  private lurkX = 0
  private x0 = 0
  private y0 = 0
  private cx = 0
  private cy = 0
  private x2 = 0
  private apexDone = false

  constructor() {
    drawFish(this.body)
    this.view.addChild(this.body)
    this.view.visible = false
    this.shadow.ellipse(0, 0, 30, 9).fill({ color: 0x1e4f63, alpha: 0.45 })
    this.shadow.visible = false
  }

  get busy() {
    return this.state !== 'idle'
  }

  /** Mouth position, where a snatched insect is held. */
  get mouthX() {
    return this.x + Math.cos(this.view.rotation) * 22 * this.dir
  }

  get mouthY() {
    return this.y + Math.sin(this.view.rotation) * 22 * this.dir
  }

  lurk(target: Insect, waterY: number, dir: number) {
    this.state = 'lurk'
    this.target = target
    this.prey = null
    this.t = 0
    this.dir = dir
    this.waterY = waterY
    this.lurkX = target.x
    this.shadow.visible = true
    this.shadow.position.set(this.lurkX, waterY + 26)
  }

  cancel() {
    this.state = 'idle'
    this.target = null
    this.prey = null
    this.view.visible = false
    this.shadow.visible = false
  }

  /** Where bubbles rise from while it lurks. */
  get bubbleX() {
    return this.lurkX
  }

  update(dt: number): FishEvent {
    if (this.state === 'idle') return null
    this.t += dt
    if (this.state === 'lurk') {
      const target = this.target
      if (target?.free) this.lurkX += (target.x - this.lurkX) * Math.min(1, dt * 4)
      const k = clamp(this.t / F.lurk, 0, 1)
      this.shadow.position.set(this.lurkX, this.waterY + 26 - k * 8)
      this.shadow.scale.set(0.6 + 0.5 * k)
      this.shadow.alpha = 0.4 + 0.6 * k
      if (this.t < F.lurk) return null
      this.startLeap()
      return 'jump'
    }

    const u = clamp(this.t / F.leap, 0, 1)
    const a = (1 - u) * (1 - u)
    const b = 2 * (1 - u) * u
    const c = u * u
    const nx = a * this.x0 + b * this.cx + c * this.x2
    const ny = a * this.y0 + b * this.cy + c * this.y0
    const angle = Math.atan2(ny - this.y, (nx - this.x) * this.dir)
    this.x = nx
    this.y = ny
    this.view.position.set(nx, ny)
    this.view.scale.set(this.dir, 1)
    this.view.rotation = this.dir * angle
    this.prey?.followTip(this.mouthX, this.mouthY)

    if (!this.apexDone && u >= 0.5) {
      this.apexDone = true
      return 'apex'
    }
    if (u >= 1) {
      this.prey?.swallow()
      this.cancel()
      return 'splash'
    }
    return null
  }

  /** Grabs the target if it is still in reach at the top of the leap. */
  trySnatch() {
    const it = this.target
    if (!it || !it.free) return null
    if (Math.hypot(it.x - this.mouthX, it.y - this.mouthY) > F.reach) return null
    it.catchOn(this.mouthX, this.mouthY)
    this.prey = it
    return it
  }

  private startLeap() {
    this.state = 'leap'
    this.t = 0
    this.apexDone = false
    this.shadow.visible = false
    const target = this.target
    const tx = target?.free ? target.x : this.lurkX
    const ty = target?.free ? target.y : this.waterY - 140
    const half = 46
    this.x0 = tx - half * this.dir
    this.x2 = tx + half * this.dir
    this.y0 = this.waterY + 10
    // Quadratic curve whose midpoint passes through the target.
    this.cx = tx
    this.cy = 2 * ty - this.y0
    this.x = this.x0
    this.y = this.y0
    this.view.visible = true
    this.view.position.set(this.x, this.y)
  }
}

/** A round orange pond fish, facing right. */
function drawFish(g: Graphics) {
  const ink = PALETTE.ink
  g.poly([-20, 0, -34, -11, -31, 0, -34, 11]).fill(PALETTE.fishFin).stroke({
    width: 2.4,
    color: ink,
    join: 'round',
  })
  g.ellipse(0, 0, 24, 13).fill(PALETTE.fish).stroke({ width: 2.6, color: ink })
  g.ellipse(-4, 4, 15, 6).fill({ color: PALETTE.white, alpha: 0.55 })
  g.ellipse(-8, -6, 7, 4).fill(PALETTE.fishFin)
  g.poly([-4, -12, 6, -19, 8, -11]).fill(PALETTE.fishFin).stroke({
    width: 2,
    color: ink,
    join: 'round',
  })
  g.circle(13, -3, 4.2).fill(PALETTE.white).stroke({ width: 2, color: ink })
  g.circle(14.2, -3, 2).fill(ink)
  g.moveTo(19, 4).quadraticCurveTo(22, 6, 24, 3).stroke({ width: 2, color: ink, cap: 'round' })
}
