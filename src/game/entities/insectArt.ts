import type { Texture } from 'pixi.js'
import { TAU } from '../../lib/math'
import { Rng } from '../../lib/random'
import { originAnchor, paper, rgba, softBlob, toTexture, type Paper } from '../draw/paint'
import { PALETTE } from '../draw/palette'

/** Insects are small, so their art is painted once at a fixed, generous density. */
const RES = 4

export interface KindArt {
  body: Texture
  bodyAnchor: { x: number; y: number }
  wing: Texture
  blur: Texture
  /** Where the wings attach, in the insect's local space (facing right). */
  wingRoot: { x: number; y: number }
  /** [resting angle, alpha] for the far and the near wing. */
  wingAngles: [number, number][]
}

let cache: { fly: KindArt; bee: KindArt } | null = null

export function getInsectArt() {
  if (!cache) {
    const flyBody = paintFlyBody()
    const beeBody = paintBeeBody()
    cache = {
      fly: {
        body: toTexture(flyBody),
        bodyAnchor: originAnchor(flyBody),
        wing: toTexture(paintWing(12, 3.2, 0)),
        blur: toTexture(paintBlur(10)),
        wingRoot: { x: 2, y: -3.6 },
        wingAngles: [
          [Math.PI + 0.3, 0.6],
          [Math.PI + 0.55, 0.95],
        ],
      },
      bee: {
        body: toTexture(beeBody),
        bodyAnchor: originAnchor(beeBody),
        wing: toTexture(paintWing(14, 3.6, 1)),
        blur: toTexture(paintBlur(12)),
        wingRoot: { x: 3, y: -6 },
        wingAngles: [
          [Math.PI + 0.25, 0.6],
          [Math.PI + 0.5, 0.95],
        ],
      },
    }
  }
  return cache
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU)
  ctx.fill()
}

function legs(ctx: CanvasRenderingContext2D, color: string, width: number, paths: number[][]) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const [x0, y0, kx, ky, x1, y1] of paths) {
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(kx, ky)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }
}

/** Short hairs sprinkled around an ellipse's upper edge. */
function bristles(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  count: number,
  color: string,
  len: [number, number],
  width: number,
) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  for (let i = 0; i < count; i++) {
    const a = rng.range(Math.PI * 1.05, Math.PI * 1.95)
    const x = cx + Math.cos(a) * rx
    const y = cy + Math.sin(a) * ry
    const l = rng.range(len[0], len[1])
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
    ctx.stroke()
  }
}

/** House fly, side view facing right. */
function paintFlyBody(): Paper {
  const p = paper(-14, -9, 28, 19, RES)
  const ctx = p.ctx
  const rng = new Rng(4)

  legs(ctx, 'rgba(18, 18, 16, 0.95)', 0.7, [
    [1, 3, -2, 6, -5, 9],
    [3, 3.5, 3.5, 7, 1.5, 9.5],
    [5, 3, 8.5, 6, 9.5, 9],
  ])

  const ab = ctx.createRadialGradient(-5, -1, 0.5, -4.5, 1.5, 8)
  ab.addColorStop(0, '#70706a')
  ab.addColorStop(0.5, '#3a3a36')
  ab.addColorStop(1, '#141412')
  ctx.fillStyle = ab
  ellipse(ctx, -4.5, 1.5, 7, 5)
  for (const [x, y] of [
    [-3, -1],
    [-7, 0],
    [-5, 3],
    [-9, 2.5],
  ]) {
    softBlob(ctx, x, y, 1.8, 1.3, 0xa8a89e, 0.35, 0.3)
  }
  ctx.strokeStyle = 'rgba(8, 8, 8, 0.45)'
  ctx.lineWidth = 0.4
  for (const x of [-2.5, -6, -9.2]) {
    ctx.beginPath()
    ctx.ellipse(x, 1.5, 1.2, 4.6, 0, -Math.PI / 2, Math.PI / 2)
    ctx.stroke()
  }

  const th = ctx.createRadialGradient(3.8, -2.6, 0.4, 3, -0.5, 5.5)
  th.addColorStop(0, '#93938b')
  th.addColorStop(0.5, rgba(PALETTE.flyThorax))
  th.addColorStop(1, '#1e1e1c')
  ctx.fillStyle = th
  ellipse(ctx, 3, -0.5, 5, 4.4)
  ctx.strokeStyle = 'rgba(12, 12, 12, 0.7)'
  ctx.lineWidth = 0.7
  for (const [y0, y1] of [
    [-3.4, -3.8],
    [-1.9, -2.3],
  ]) {
    ctx.beginPath()
    ctx.moveTo(0, y0)
    ctx.lineTo(6.5, y1)
    ctx.stroke()
  }
  bristles(ctx, rng, 3, -0.5, 5, 4.4, 16, 'rgba(10,10,10,0.9)', [0.7, 1.6], 0.28)
  bristles(ctx, rng, -4.5, 1.5, 7, 5, 12, 'rgba(10,10,10,0.7)', [0.5, 1.1], 0.22)

  ctx.fillStyle = '#26241f'
  ellipse(ctx, 8.6, 0.2, 3.3, 3.7)
  const eye = ctx.createRadialGradient(10, -1.6, 0.3, 9.3, -0.4, 3.4)
  eye.addColorStop(0, '#e2643c')
  eye.addColorStop(0.5, '#a3301c')
  eye.addColorStop(1, '#4a120a')
  ctx.fillStyle = eye
  ellipse(ctx, 9.3, -0.4, 3, 3.3)
  ctx.fillStyle = 'rgba(40, 8, 4, 0.35)'
  for (let x = 6.5; x < 12.5; x += 0.55) {
    for (let y = -3.8; y < 3; y += 0.55) {
      if (((x - 9.3) / 3) ** 2 + ((y + 0.4) / 3.3) ** 2 < 0.9) ctx.fillRect(x, y, 0.22, 0.22)
    }
  }
  softBlob(ctx, 10.2, -2, 0.9, 0.6, 0xffffff, 0.85, 0.4)
  ctx.strokeStyle = '#1a1a18'
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(9.4, 3)
  ctx.lineTo(10.4, 5.2)
  ctx.stroke()
  return p
}

/** Honeybee, side view facing right. */
function paintBeeBody(): Paper {
  const p = paper(-21, -14, 42, 28, RES)
  const ctx = p.ctx
  const rng = new Rng(9)

  legs(ctx, 'rgba(26, 16, 8, 0.95)', 0.9, [
    [2, 4, -1, 8, -4, 11],
    [4, 4.5, 4.5, 9, 3, 12],
    [6, 4, 9.5, 7.5, 11, 11],
  ])
  softBlob(ctx, -2.4, 9, 1.8, 1.4, 0xf2b630, 1, 0.6)

  ctx.save()
  ctx.beginPath()
  ctx.ellipse(-7, 2, 9.5, 7, 0, 0, TAU)
  ctx.clip()
  const ab = ctx.createRadialGradient(-6, -2, 1, -7, 2, 10)
  ab.addColorStop(0, '#f6cf72')
  ab.addColorStop(0.55, rgba(PALETTE.beeAmber))
  ab.addColorStop(1, '#7a4c14')
  ctx.fillStyle = ab
  ctx.fillRect(-17, -6, 20, 16)
  ctx.strokeStyle = rgba(PALETTE.beeBand, 0.92)
  ctx.lineWidth = 2.3
  for (const x of [-12.5, -8.2, -3.8]) {
    ctx.beginPath()
    ctx.ellipse(x, 2, 1.4, 7.4, 0, -Math.PI / 2, Math.PI / 2)
    ctx.stroke()
  }
  softBlob(ctx, -5, -2.5, 4, 1.4, 0xffffff, 0.25, 0)
  ctx.restore()
  bristles(ctx, rng, -7, 2, 9.5, 7, 40, rgba(PALETTE.beeFuzz, 0.7), [0.5, 1.3], 0.3)
  ctx.fillStyle = '#2a1a0e'
  ctx.beginPath()
  ctx.moveTo(-16, 1.6)
  ctx.lineTo(-19.6, 3.2)
  ctx.lineTo(-16, 4.2)
  ctx.fill()

  ctx.fillStyle = '#5a3a1a'
  ellipse(ctx, 4, -1, 6, 5.8)
  for (let i = 0; i < 220; i++) {
    const a = rng.range(0, TAU)
    const d = Math.sqrt(rng.float()) * 6
    const x = 4 + Math.cos(a) * d
    const y = -1 + Math.sin(a) * d * 0.95
    const l = rng.range(0.8, 1.9)
    ctx.strokeStyle = rng.chance(0.7) ? rgba(PALETTE.beeFuzz, 0.75) : 'rgba(60, 35, 12, 0.7)'
    ctx.lineWidth = 0.32
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
    ctx.stroke()
  }

  ctx.fillStyle = '#24170c'
  ellipse(ctx, 11.2, 0.6, 4, 4.4)
  const eye = ctx.createRadialGradient(12.2, -1.4, 0.2, 11.8, -0.2, 3.6)
  eye.addColorStop(0, '#5a4430')
  eye.addColorStop(1, '#100804')
  ctx.fillStyle = eye
  ellipse(ctx, 11.8, -0.2, 2.5, 3.6)
  softBlob(ctx, 12.4, -2, 0.8, 0.6, 0xffffff, 0.75, 0.4)
  ctx.strokeStyle = '#1a120a'
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(12.5, -3.5)
  ctx.lineTo(13.6, -7.6)
  ctx.lineTo(17.2, -9)
  ctx.stroke()
  return p
}

/** Translucent wing with veins and a faint iridescent sheen. Base at x = 0. */
function paintWing(len: number, width: number, amber: number): Paper {
  const p = paper(0, -width - 0.5, len + 0.5, width * 2 + 1, RES)
  const ctx = p.ctx
  const path = new Path2D()
  path.moveTo(0, 0)
  path.bezierCurveTo(len * 0.3, -width, len * 0.85, -width * 0.95, len, -width * 0.2)
  path.quadraticCurveTo(len * 0.97, width * 0.55, len * 0.6, width * 0.5)
  path.quadraticCurveTo(len * 0.25, width * 0.45, 0, 0)
  ctx.fillStyle = amber ? 'rgba(236, 226, 205, 0.42)' : 'rgba(222, 232, 240, 0.4)'
  ctx.fill(path)
  ctx.save()
  ctx.clip(path)
  const sheen = ctx.createLinearGradient(0, -width, len, width)
  sheen.addColorStop(0, 'rgba(190, 150, 255, 0.14)')
  sheen.addColorStop(0.5, 'rgba(140, 255, 210, 0.12)')
  sheen.addColorStop(1, 'rgba(255, 220, 150, 0.12)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, -width, len, width * 2)
  ctx.strokeStyle = 'rgba(30, 30, 30, 0.5)'
  ctx.lineWidth = 0.22
  for (const [ex, ey] of [
    [len * 0.98, -width * 0.25],
    [len * 0.9, -width * 0.7],
    [len * 0.75, width * 0.45],
    [len * 0.45, width * 0.45],
  ]) {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(ex * 0.5, ey * 0.7, ex, ey)
    ctx.stroke()
  }
  for (const x of [len * 0.45, len * 0.7]) {
    ctx.beginPath()
    ctx.moveTo(x, -width * 0.75)
    ctx.lineTo(x + 1, width * 0.35)
    ctx.stroke()
  }
  ctx.restore()
  ctx.strokeStyle = 'rgba(40, 40, 40, 0.45)'
  ctx.lineWidth = 0.3
  ctx.stroke(path)
  return p
}

/** The smear a fast wing beat leaves. */
function paintBlur(len: number): Paper {
  const p = paper(-len, -len, len * 2, len * 2, RES)
  const ctx = p.ctx
  ctx.rotate(-0.4)
  softBlob(ctx, -len * 0.25, 0, len * 0.85, len * 0.4, 0xdde6ee, 0.4, 0)
  return p
}
