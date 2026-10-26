import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js'
import { TAU, lerp } from '../../lib/math'
import type { Rng } from '../../lib/random'
import { PALETTE } from '../draw/palette'

type Shape = 'dot' | 'star' | 'ring'

interface Particle {
  sprite: Sprite
  shape: Shape
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  life: number
  age: number
  size0: number
  size1: number
  gravity: number
  drag: number
  spin: number
  alpha0: number
}

export interface BurstOptions {
  x: number
  y: number
  count: number
  shape?: Shape
  colors: readonly number[]
  speed: readonly [number, number]
  /** Direction range in radians. Defaults to a full circle. */
  angle?: readonly [number, number]
  life: readonly [number, number]
  size: readonly [number, number]
  /** Final size as a multiple of the starting size. */
  endScale?: number
  gravity?: number
  drag?: number
  spin?: number
  alpha?: number
}

const TEX_SIZE = 32

/** Pooled sprite particles. Nothing is allocated after construction. */
export class Particles {
  readonly layer = new Container()
  private readonly pool: Particle[] = []
  private readonly textures: Record<Shape, Texture>
  private readonly rng: Rng

  constructor(renderer: Renderer, rng: Rng, size = 180) {
    this.rng = rng
    this.textures = {
      dot: renderer.generateTexture(new Graphics().circle(0, 0, TEX_SIZE / 2).fill(PALETTE.white)),
      star: renderer.generateTexture(
        new Graphics().star(0, 0, 5, TEX_SIZE / 2, TEX_SIZE / 4.4).fill(PALETTE.white),
      ),
      ring: renderer.generateTexture(
        new Graphics().circle(0, 0, TEX_SIZE - 3).stroke({ width: 4, color: PALETTE.white }),
      ),
    }
    for (let i = 0; i < size; i++) {
      const sprite = new Sprite(this.textures.dot)
      sprite.anchor.set(0.5)
      sprite.visible = false
      this.layer.addChild(sprite)
      this.pool.push({
        sprite,
        shape: 'dot',
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 1,
        age: 0,
        size0: 1,
        size1: 0,
        gravity: 0,
        drag: 0,
        spin: 0,
        alpha0: 1,
      })
    }
  }

  burst(o: BurstOptions) {
    const shape = o.shape ?? 'dot'
    const [a0, a1] = o.angle ?? [0, TAU]
    for (let i = 0; i < o.count; i++) {
      const p = this.pool.find((it) => !it.active)
      if (!p) return
      const a = this.rng.range(a0, a1)
      const sp = this.rng.range(o.speed[0], o.speed[1])
      p.active = true
      p.shape = shape
      p.x = o.x
      p.y = o.y
      p.vx = Math.cos(a) * sp
      p.vy = Math.sin(a) * sp
      p.life = this.rng.range(o.life[0], o.life[1])
      p.age = 0
      p.size0 = this.rng.range(o.size[0], o.size[1])
      p.size1 = p.size0 * (o.endScale ?? 0)
      p.gravity = o.gravity ?? 0
      p.drag = o.drag ?? 3
      p.spin = (o.spin ?? 0) * this.rng.sign()
      p.alpha0 = o.alpha ?? 1
      const s = p.sprite
      s.texture = this.textures[shape]
      s.tint = this.rng.pick(o.colors)
      s.rotation = this.rng.range(0, TAU)
      s.visible = true
    }
  }

  /** Expanding ring, e.g. a shockwave. */
  ring(x: number, y: number, color: number, from: number, to: number, life = 0.35, alpha = 0.9) {
    this.burst({
      x,
      y,
      count: 1,
      shape: 'ring',
      colors: [color],
      speed: [0, 0],
      life: [life, life],
      size: [from, from],
      endScale: to / from,
      drag: 0,
      alpha,
    })
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.active) continue
      p.age += dt
      const t = p.age / p.life
      if (t >= 1) {
        p.active = false
        p.sprite.visible = false
        continue
      }
      const drag = Math.exp(-p.drag * dt)
      p.vx *= drag
      p.vy = p.vy * drag + p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      const s = p.sprite
      s.position.set(p.x, p.y)
      const k = p.shape === 'ring' ? 1 - (1 - t) ** 3 : t
      s.scale.set(lerp(p.size0, p.size1, k) / TEX_SIZE)
      s.rotation += p.spin * dt
      s.alpha = p.alpha0 * (p.shape === 'ring' ? 1 - t : t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4)
    }
  }
}
