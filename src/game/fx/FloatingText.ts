import { Container, Text } from 'pixi.js'
import { Spring } from '../../lib/spring'
import { PALETTE } from '../draw/palette'
import { GAME_FONT } from '../fonts'

interface Floater {
  text: Text
  active: boolean
  age: number
  x: number
  y: number
  scale: Spring
}

const LIFE = 0.9

/** Pooled "+1" / "Ouch!" popups that spring in, float up and fade. */
export class FloatingText {
  readonly layer = new Container()
  private readonly pool: Floater[] = []

  constructor(size = 6) {
    for (let i = 0; i < size; i++) {
      const text = new Text({
        text: '',
        style: {
          fontFamily: GAME_FONT,
          fontSize: 28,
          fontWeight: '700',
          fill: PALETTE.white,
          align: 'center',
          dropShadow: { color: 0x000000, alpha: 0.5, blur: 4, distance: 1.5, angle: Math.PI / 2 },
        },
        resolution: 2,
      })
      text.anchor.set(0.5)
      text.visible = false
      this.layer.addChild(text)
      this.pool.push({
        text,
        active: false,
        age: 0,
        x: 0,
        y: 0,
        scale: new Spring(0, { freq: 4.5, damping: 0.45 }),
      })
    }
  }

  show(label: string, x: number, y: number, color: number = PALETTE.white, size = 34) {
    const f = this.pool.find((it) => !it.active) ?? this.pool[0]
    f.active = true
    f.age = 0
    f.x = x
    f.y = y
    f.scale.snap(0)
    f.scale.target = 1
    f.scale.kick(14)
    f.text.text = label
    f.text.style.fill = color
    f.text.style.fontSize = size
    f.text.visible = true
  }

  update(dt: number) {
    for (const f of this.pool) {
      if (!f.active) continue
      f.age += dt
      if (f.age >= LIFE) {
        f.active = false
        f.text.visible = false
        continue
      }
      f.scale.step(dt)
      const t = f.age / LIFE
      f.text.position.set(f.x, f.y - 46 * (1 - (1 - t) ** 2))
      f.text.scale.set(Math.max(0, f.scale.value))
      f.text.alpha = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35
    }
  }
}
