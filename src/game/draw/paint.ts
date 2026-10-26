import { CanvasSource, Texture } from 'pixi.js'
import { clamp } from '../../lib/math'
import { mulberry32 } from '../../lib/random'

/**
 * Offscreen 2D canvas measured in world units. Painting happens once (at load
 * or resize) with the full Canvas 2D toolbox: gradients, blur, compositing and
 * per-pixel noise. The result becomes a Pixi texture that sprites animate.
 */
export interface Paper {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  /** Pixels per world unit. */
  res: number
  w: number
  h: number
  /** World-unit position of the canvas origin, so shapes can use the entity's own coordinates. */
  ox: number
  oy: number
}

/** A canvas covering the world-unit rect (x, y, w, h). */
export function paper(x: number, y: number, w: number, h: number, res: number): Paper {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(w * res))
  canvas.height = Math.max(1, Math.ceil(h * res))
  const ctx = canvas.getContext('2d', { willReadFrequently: false })!
  ctx.setTransform(res, 0, 0, res, -x * res, -y * res)
  return { canvas, ctx, res, w, h, ox: x, oy: y }
}

/** Texture whose size is in world units, with the anchor matching the paper origin. */
export function toTexture(p: Paper) {
  // Created at resolution 1 first: Pixi derives the pixel size as (width / res) * res,
  // and float error there (842.9999 instead of 843) "resizes" the canvas, wiping it.
  // The resolution setter only rescales the logical size and leaves the canvas alone.
  const source = new CanvasSource({ resource: p.canvas, resolution: 1 })
  source.resolution = p.res
  return new Texture({ source })
}

/** Anchor that puts world point (0, 0) of the paper's coordinate space at the sprite position. */
export const originAnchor = (p: Paper) => ({ x: -p.ox / p.w, y: -p.oy / p.h })

export const rgba = (hex: number, a = 1) =>
  `rgba(${(hex >> 16) & 255}, ${(hex >> 8) & 255}, ${hex & 255}, ${a})`

/** Soft-edged blob: a radial gradient from `inner` alpha to fully transparent. */
export function softBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: number,
  alpha: number,
  hardness = 0.2,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  g.addColorStop(0, rgba(color, alpha))
  g.addColorStop(clamp(hardness, 0, 0.99), rgba(color, alpha))
  g.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, rx, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function ellipsePath(path: Path2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  path.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot))
  path.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)
}

/** Seeded, smooth 2D value noise in [0, 1], optionally tileable with period `period`. */
export function createNoise2D(seed: number, period = 256) {
  const rand = mulberry32(seed)
  const size = period
  const values = new Float32Array(size * size)
  for (let i = 0; i < values.length; i++) values[i] = rand()
  const at = (x: number, y: number) =>
    values[(((y % size) + size) % size) * size + (((x % size) + size) % size)]
  return (x: number, y: number) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const tx = x - x0
    const ty = y - y0
    const sx = tx * tx * (3 - 2 * tx)
    const sy = ty * ty * (3 - 2 * ty)
    const a = at(x0, y0)
    const b = at(x0 + 1, y0)
    const c = at(x0, y0 + 1)
    const d = at(x0 + 1, y0 + 1)
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
}

export type Noise2D = ReturnType<typeof createNoise2D>

/** Fractal noise: several octaves of value noise, roughly in [0, 1]. */
export function fbm(noise: Noise2D, x: number, y: number, octaves = 4) {
  let sum = 0
  let amp = 0.5
  let freq = 1
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * freq, y * freq) * amp
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}

/**
 * Runs `shade` for every pixel of the paper and writes the returned RGBA.
 * `shade` gets world-unit coordinates and the current pixel; returning null keeps it.
 */
export function shadePixels(
  p: Paper,
  shade: (x: number, y: number, px: Uint8ClampedArray, i: number) => void,
) {
  const { canvas, ctx, res, ox, oy } = p
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = img.data
  for (let py = 0; py < canvas.height; py++) {
    for (let px = 0; px < canvas.width; px++) {
      const i = (py * canvas.width + px) * 4
      if (data[i + 3] === 0) continue
      shade(ox + px / res, oy + py / res, data, i)
    }
  }
  ctx.putImageData(img, 0, 0)
}

/** Adds fine film-like grain to painted (non-transparent) pixels. */
export function grain(p: Paper, amount: number, seed = 1) {
  const rand = mulberry32(seed)
  shadePixels(p, (_x, _y, d, i) => {
    const n = (rand() - 0.5) * amount
    d[i] = clamp(d[i] + n, 0, 255)
    d[i + 1] = clamp(d[i + 1] + n, 0, 255)
    d[i + 2] = clamp(d[i + 2] + n, 0, 255)
  })
}
