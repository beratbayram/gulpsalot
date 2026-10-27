export const TAU = Math.PI * 2

export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v)

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const invLerp = (a: number, b: number, v: number) => (a === b ? 0 : (v - a) / (b - a))

/** Maps `v` from [a0, a1] to [b0, b1], clamped to the output range. */
export const remap = (v: number, a0: number, a1: number, b0: number, b1: number) =>
  lerp(b0, b1, clamp(invLerp(a0, a1, v), 0, 1))

/** Frame-rate independent exponential smoothing towards `b`. */
export const damp = (a: number, b: number, lambda: number, dt: number) =>
  lerp(a, b, 1 - Math.exp(-lambda * dt))

export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay)

/** Squared distance from point P to segment AB. */
export function distSqPointSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const abx = bx - ax
  const aby = by - ay
  const lenSq = abx * abx + aby * aby
  const t = lenSq > 0 ? clamp(((px - ax) * abx + (py - ay) * aby) / lenSq, 0, 1) : 0
  const dx = ax + abx * t - px
  const dy = ay + aby * t - py
  return dx * dx + dy * dy
}

/** True when a circle moving from A to B touches the circle at C (radii already summed in `r`). */
export const sweptHit = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  r: number,
) => distSqPointSegment(cx, cy, ax, ay, bx, by) <= r * r

/** True when segment AB crosses segment CD. */
export function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
) {
  const cross = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    (qx - px) * (ry - py) - (qy - py) * (rx - px)
  const d1 = cross(cx, cy, dx, dy, ax, ay)
  const d2 = cross(cx, cy, dx, dy, bx, by)
  const d3 = cross(ax, ay, bx, by, cx, cy)
  const d4 = cross(ax, ay, bx, by, dx, dy)
  return d1 * d2 < 0 && d3 * d4 < 0
}

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2

export const easeOutBack = (t: number, s = 1.70158) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2

/** 0 -> 1 -> 0 bump over t in [0, 1]. */
export const bump = (t: number) => Math.sin(clamp(t, 0, 1) * Math.PI)

export function mixColor(a: number, b: number, t: number) {
  const k = clamp(t, 0, 1)
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, k))
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, k))
  const bl = Math.round(lerp(a & 255, b & 255, k))
  return (r << 16) | (g << 8) | bl
}
