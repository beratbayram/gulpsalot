import { Container, Graphics, Text } from 'pixi.js'
import { clamp, damp } from '../../lib/math'
import { Spring } from '../../lib/spring'
import { PALETTE } from '../draw/palette'
import type { Insect } from '../entities/Insect'
import { GAME_FONT } from '../fonts'

export type HintKind = 'tapFly' | 'avoidBee'

const LABELS: Record<HintKind, string> = {
  tapFly: 'Tap the fly!',
  avoidBee: "Don't lick bees!",
}

/** First-run coaching: a tapping hand and a speech bubble that follow an insect. */
export class Hints {
  readonly view = new Container()
  private readonly hand = new Graphics()
  private readonly bubble = new Container()
  private readonly bubbleBg = new Graphics()
  private readonly label: Text
  private readonly fade = new Spring(0, { freq: 3.5, damping: 0.9 })
  private readonly pop = new Spring(1, { freq: 4, damping: 0.4 })
  private kind: HintKind | null = null
  private target: Insect | null = null
  private x = 0
  private y = 0
  private time = 0

  constructor() {
    drawHand(this.hand)
    this.label = new Text({
      text: '',
      style: { fontFamily: GAME_FONT, fontSize: 19, fontWeight: '700', fill: PALETTE.ink },
      resolution: 2,
    })
    this.label.anchor.set(0.5)
    this.bubble.addChild(this.bubbleBg, this.label)
    this.view.addChild(this.hand, this.bubble)
    this.view.visible = false
  }

  get current() {
    return this.kind
  }

  show(kind: HintKind, target: Insect) {
    if (this.kind !== kind) {
      this.kind = kind
      this.label.text = LABELS[kind]
      this.drawBubble(kind)
      this.x = target.x
      this.y = target.y
      this.pop.snap(0.6)
      this.pop.target = 1
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
    this.pop.step(dt)
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

    const tap = Math.max(0, Math.sin(this.time * 6.5))
    this.hand.visible = this.kind === 'tapFly'
    this.hand.position.set(this.x + 27 - tap * 7, this.y + 35 - tap * 9)
    this.hand.scale.set(1 - tap * 0.08)

    const above = this.y - 58 > top
    const bx = clamp(this.x, 86, worldW - 86)
    const by = above ? this.y - 52 : this.y + 74
    this.bubble.position.set(bx, by)
    this.bubble.scale.set(this.pop.value)
    this.bubbleBg.scale.y = above ? 1 : -1
    this.label.scale.y = 1
  }

  private drawBubble(kind: HintKind) {
    const g = this.bubbleBg
    const w = this.label.width + 30
    const h = 38
    const border = kind === 'avoidBee' ? PALETTE.sting : PALETTE.ink
    g.clear()
    g.roundRect(-w / 2, -h / 2, w, h, h / 2)
      .fill(0xfff6e0)
      .stroke({ width: 3, color: border })
    g.poly([-8, h / 2 - 1.5, 8, h / 2 - 1.5, 0, h / 2 + 10]).fill(0xfff6e0)
    g.moveTo(-8, h / 2)
      .lineTo(0, h / 2 + 10)
      .lineTo(8, h / 2)
      .stroke({
        width: 3,
        color: border,
        join: 'round',
        cap: 'round',
      })
  }
}

function drawHand(g: Graphics) {
  const ink = PALETTE.ink
  const o = 3
  const shapes = (expand: number, color: number) => {
    g.roundRect(-10 - expand, -30 - expand, 9 + expand * 2, 30 + expand * 2, 4.5 + expand).fill(
      color,
    )
    g.roundRect(-12 - expand, -6 - expand, 25 + expand * 2, 22 + expand * 2, 8 + expand).fill(color)
    g.ellipse(14, 4, 5 + expand, 8 + expand).fill(color)
  }
  shapes(o, ink)
  shapes(0, PALETTE.white)
  g.moveTo(-1, -4).lineTo(-1, 6).moveTo(5, -4).lineTo(5, 6).stroke({
    width: 2,
    color: ink,
    alpha: 0.35,
    cap: 'round',
  })
  g.rotation = -0.42
}
