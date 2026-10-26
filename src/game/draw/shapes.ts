import type { Graphics } from 'pixi.js'

/**
 * Smooths a polyline with Catmull-Rom interpolation.
 * Writes `subdivisions` points per input segment (plus the last point) into the out arrays.
 * Returns the number of points written.
 */
export function catmullRom(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  count: number,
  subdivisions: number,
  outX: Float32Array,
  outY: Float32Array,
) {
  let k = 0
  for (let i = 0; i < count - 1; i++) {
    const i0 = Math.max(i - 1, 0)
    const i2 = i + 1
    const i3 = Math.min(i + 2, count - 1)
    for (let s = 0; s < subdivisions; s++) {
      const t = s / subdivisions
      const t2 = t * t
      const t3 = t2 * t
      outX[k] =
        0.5 *
        (2 * xs[i] +
          (-xs[i0] + xs[i2]) * t +
          (2 * xs[i0] - 5 * xs[i] + 4 * xs[i2] - xs[i3]) * t2 +
          (-xs[i0] + 3 * xs[i] - 3 * xs[i2] + xs[i3]) * t3)
      outY[k] =
        0.5 *
        (2 * ys[i] +
          (-ys[i0] + ys[i2]) * t +
          (2 * ys[i0] - 5 * ys[i] + 4 * ys[i2] - ys[i3]) * t2 +
          (-ys[i0] + 3 * ys[i] - 3 * ys[i2] + ys[i3]) * t3)
      k++
    }
  }
  outX[k] = xs[count - 1]
  outY[k] = ys[count - 1]
  return k + 1
}

/** Computes left/right edges of a ribbon. `halfWidth(t)` gets 0 at the start and 1 at the end. */
export function ribbonEdges(
  xs: Float32Array,
  ys: Float32Array,
  count: number,
  halfWidth: (t: number) => number,
  left: number[],
  right: number[],
) {
  left.length = 0
  right.length = 0
  for (let i = 0; i < count; i++) {
    const a = Math.max(i - 1, 0)
    const b = Math.min(i + 1, count - 1)
    let nx = -(ys[b] - ys[a])
    let ny = xs[b] - xs[a]
    const len = Math.hypot(nx, ny) || 1
    nx /= len
    ny /= len
    const w = halfWidth(i / (count - 1))
    left.push(xs[i] + nx * w, ys[i] + ny * w)
    right.push(xs[i] - nx * w, ys[i] - ny * w)
  }
}

export function polyline(g: Graphics, pts: number[]) {
  g.moveTo(pts[0], pts[1])
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
}

/** Five-point star path centered on (x, y). */
export function star(g: Graphics, x: number, y: number, outer: number, inner: number, rot = 0) {
  return g.star(x, y, 5, outer, inner, rot)
}
