import { Container, Graphics, Text } from 'pixi.js'
import { TAU, clamp, damp } from '../../lib/math'
import { Spring } from '../../lib/spring'
import { PALETTE } from '../draw/palette'
import type { Insect } from '../entities/Insect'
import { GAME_FONT } from '../fonts'

export type HintKind = 'tapFly' | 'avoidBee'

const LABELS: Record<HintKind, string> = {
  tapFly: 'Tap the fly',
  avoidBee: "Don't touch the bees",
}

/** First-run coaching: a pulsing target ring and a frosted label that follow an insect. */
export class Hints {
  readonly view = new Container()
  private readonly rings = new Graphics()
  private readonly bubble = new Container()
  private readonly bubbleBg = new Graphics()
  private readonly label: Text
  private readonly fade = new Spring(0, { freq: 3, damping: 0.9 })
  private kind: HintKind | null = null
  private target: Insect | null = null
  private x = 0
  private y = 0
  private time = 0

  constructor() {
    this.label = new Text({
      text: '',
      style: {
        fontFamily: GAME_FONT,
        fontSize: 15,
        fontWeight: '600',
        fill: PALETTE.white,
        letterSpacing: 0.3,
      },
      resolution: 2,
    })
    this.label.anchor.set(0.5)
    this.bubble.addChild(this.bubbleBg, this.label)
    this.view.addChild(this.rings, this.bubble)
    this.view.visible = false
  }

  get current() {
    return this.kind
  }

  show(kind: HintKind, target: Insect) {
    if (this.kind !== kind) {
      this.kind = kind
      this.label.text = LABELS[kind]
      this.drawBubble()
      this.x = target.x
      this.y = target.y
    }
    this.target = target
    this.fade.target = 1
  }

  hide() {
    this.fade.target = 0
    this.target = null
  }

  update(dt: number, worldW: number, top: number) {
    this.time += dt
    this.fade.step(dt)
    const a = clamp(this.fade.value, 0, 1)
    this.view.alpha = a
    this.view.visible = a > 0.01
    if (!this.view.visible) {
      if (this.fade.target === 0) this.kind = null
      return
    }
    if (this.target && this.target.free) {
      this.x = damp(this.x, this.target.x, 14, dt)
      this.y = damp(this.y, this.target.y, 14, dt)
    }

    const warn = this.kind === 'avoidBee'
    const color = warn ? 0xffb4a2 : PALETTE.white
    const g = this.rings
    g.clear()
    // Two rings expanding outward, offset in phase, like a soft sonar ping.
    for (let i = 0; i < 2; i++) {
      const t = (this.time * 0.9 + i * 0.5) % 1
      const r = 16 + t * 26
      g.circle(this.x, this.y, r).stroke({ width: 1.6, color, alpha: (1 - t) * 0.8 })
    }
    g.circle(this.x, this.y, 15 + Math.sin(this.time * TAU * 0.9) * 1.2).stroke({
      width: 1.2,
      color,
      alpha: 0.6,
    })

    const above = this.y - 62 > top
    this.bubble.position.set(clamp(this.x, 90, worldW - 90), above ? this.y - 56 : this.y + 60)
  }

  private drawBubble() {
    const g = this.bubbleBg
    const w = this.label.width + 28
    const h = 30
    g.clear()
    g.roundRect(-w / 2, -h / 2, w, h, h / 2)
      .fill({ color: 0x0e1a12, alpha: 0.55 })
      .stroke({ width: 1, color: PALETTE.white, alpha: 0.3 })
  }
}
