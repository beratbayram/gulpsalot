import { Container, Graphics, Text } from 'pixi.js'

export interface DebugInfo {
  fps: number
  mode: string
  hunger: number
  score: number
  insects: { x: number; y: number; r: number; bee: boolean; free: boolean }[]
  tip: { x: number; y: number; r: number } | null
  zone: { left: number; right: number; top: number; bottom: number }
  boop: { x: number; y: number; rx: number; ry: number }
}

/** `?debug`: hitboxes, the insect zone and a stats line. */
export class DebugOverlay {
  readonly world = new Graphics()
  readonly screen = new Container()
  private readonly text = new Text({
    text: '',
    style: {
      fontFamily: 'monospace',
      fontSize: 12,
      fill: 0xffffff,
      stroke: { color: 0, width: 3 },
    },
  })
  private fps = 60

  constructor() {
    this.text.position.set(8, 8)
    this.screen.addChild(this.text)
  }

  update(info: DebugInfo, dt: number) {
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.08
    this.text.text = `${this.fps.toFixed(0)} fps  ${info.mode}  hunger ${info.hunger.toFixed(0)}  score ${info.score}  insects ${info.insects.length}`
    const g = this.world
    g.clear()
    const z = info.zone
    g.rect(z.left, z.top, z.right - z.left, z.bottom - z.top).stroke({
      width: 1,
      color: 0xffffff,
      alpha: 0.5,
    })
    for (const it of info.insects) {
      g.circle(it.x, it.y, it.r).stroke({
        width: 1.5,
        color: it.bee ? 0xff3b3b : 0x3bff6a,
        alpha: it.free ? 1 : 0.3,
      })
    }
    if (info.tip)
      g.circle(info.tip.x, info.tip.y, info.tip.r).stroke({ width: 1.5, color: 0xffe14d })
    const b = info.boop
    g.ellipse(b.x, b.y, b.rx, b.ry).stroke({ width: 1, color: 0x9ad0ff, alpha: 0.7 })
  }
}
