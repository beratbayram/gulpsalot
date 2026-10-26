import { Graphics } from 'pixi.js'
import { clamp } from '../../lib/math'
import { CONFIG } from '../config'
import { PALETTE } from '../draw/palette'
import { catmullRom, polyline, ribbonEdges } from '../draw/shapes'
import type { Insect } from './Insect'

export type TongueState = 'idle' | 'out' | 'back'

const T = CONFIG.tongue
const N = T.segments
const ROPE_GRAVITY = 420
const ROPE_DAMPING = 0.94
/** Pulls each rope point towards its neighbours' midpoint, so the rope can curve but never kink. */
const ROPE_BEND = 0.22
/** The rope is resampled at this spacing before drawing, so bunched points never make knots. */
const SAMPLE_SPACING = 14
const MAX_SAMPLES = 40
const SUBDIV = 2
const BASE_HALF_WIDTH = 10.5
const TIP_HALF_WIDTH = 5.5

/** The resting tongue inside the open mouth, where the tongue grows from. World space. */
export interface TongueRoot {
  x: number
  y: number
  rx: number
  ry: number
  rot: number
}

/**
 * The tongue tip rides a spring: towards the tap on the way out (slightly
 * underdamped, so it overshoots and wobbles at full reach), then back to the
 * mouth. The body is a short Verlet rope pinned at both ends so fast shots
 * whip and curve instead of drawing a stiff line.
 */
export class Tongue {
  readonly view = new Graphics()
  state: TongueState = 'idle'
  tipX = 0
  tipY = 0
  prevTipX = 0
  prevTipY = 0
  /** Whether prey caught on this shot counts towards the run. */
  scored = false
  /** Already stung on this shot, so it can't be stung twice. */
  stung = false
  readonly attached: Insect[] = []

  private vx = 0
  private vy = 0
  private targetX = 0
  private targetY = 0
  private freq: number = T.launch.freq
  private damping: number = T.launch.damping
  private outTime = 0
  private dwell = 0
  private reached = false
  private dirX = 0
  private dirY = -1

  private readonly px = new Float32Array(N)
  private readonly py = new Float32Array(N)
  private readonly ox = new Float32Array(N)
  private readonly oy = new Float32Array(N)
  private readonly lens = new Float32Array(N)
  private readonly kx = new Float32Array(N)
  private readonly ky = new Float32Array(N)
  private readonly rx = new Float32Array(MAX_SAMPLES)
  private readonly ry = new Float32Array(MAX_SAMPLES)
  private readonly sx = new Float32Array((MAX_SAMPLES - 1) * SUBDIV + 1)
  private readonly sy = new Float32Array((MAX_SAMPLES - 1) * SUBDIV + 1)
  private readonly left: number[] = []
  private readonly right: number[] = []

  get busy() {
    return this.state !== 'idle'
  }

  /** Clamps a tap into a reachable target above the mouth. */
  static aim(mouthX: number, mouthY: number, tapX: number, tapY: number, top: number) {
    let tx = tapX
    let ty = Math.min(tapY, mouthY - T.minRise)
    ty = Math.max(ty, top)
    const dx = tx - mouthX
    const dy = ty - mouthY
    const d = Math.hypot(dx, dy)
    if (d < T.minLength) {
      const k = T.minLength / (d || 1)
      tx = mouthX + dx * k
      ty = mouthY + (d ? dy * k : -T.minLength)
    }
    return { x: tx, y: ty }
  }

  fire(mouthX: number, mouthY: number, targetX: number, targetY: number, scored: boolean) {
    this.state = 'out'
    this.scored = scored
    this.stung = false
    this.attached.length = 0
    this.tipX = this.prevTipX = mouthX
    this.tipY = this.prevTipY = mouthY
    this.targetX = targetX
    this.targetY = targetY
    this.vx = 0
    this.vy = 0
    this.freq = T.launch.freq
    this.damping = T.launch.damping
    this.outTime = 0
    this.dwell = 0
    this.reached = false
    const len = Math.hypot(targetX - mouthX, targetY - mouthY) || 1
    this.dirX = (targetX - mouthX) / len
    this.dirY = (targetY - mouthY) / len
    for (let i = 0; i < N; i++) {
      this.px[i] = this.ox[i] = mouthX
      this.py[i] = this.oy[i] = mouthY
    }
  }

  /** Snaps back fast after touching a bee. */
  yank() {
    if (this.state === 'idle') return
    this.stung = true
    this.startBack(T.yank.freq, T.yank.damping)
  }

  /**
   * Advances the tip and the rope. Returns true on the step the tongue gets
   * back into the mouth.
   */
  update(dt: number, mouthX: number, mouthY: number) {
    this.prevTipX = this.tipX
    this.prevTipY = this.tipY
    if (this.state === 'idle') {
      this.tipX = mouthX
      this.tipY = mouthY
      return false
    }

    if (this.state === 'out') {
      this.outTime += dt
      // The dwell starts the moment the tip reaches (or flies past) the target,
      // so the overshoot wobble plays during the pause instead of delaying it.
      const dx = this.tipX - this.targetX
      const dy = this.tipY - this.targetY
      if (!this.reached && (Math.hypot(dx, dy) < 14 || dx * this.dirX + dy * this.dirY > 0)) {
        this.reached = true
      }
      if (this.reached || this.outTime > T.maxOut) this.dwell += dt
      if (this.dwell >= T.dwell) {
        if (this.attached.length) this.startBack(T.retractLoaded.freq, T.retractLoaded.damping)
        else this.startBack(T.retract.freq, T.retract.damping)
      }
    } else {
      this.targetX = mouthX
      this.targetY = mouthY
    }

    const w = 2 * Math.PI * this.freq
    const k = w * w
    const c = 2 * this.damping * w
    this.vx += (-k * (this.tipX - this.targetX) - c * this.vx) * dt
    this.vy += (-k * (this.tipY - this.targetY) - c * this.vy) * dt
    this.tipX += this.vx * dt
    this.tipY += this.vy * dt

    this.stepRope(dt, mouthX, mouthY)

    if (this.state === 'back' && Math.hypot(this.tipX - mouthX, this.tipY - mouthY) < 12) {
      this.state = 'idle'
      this.tipX = mouthX
      this.tipY = mouthY
      return true
    }
    return false
  }

  /** Angle of the last rope segment, used to orient caught insects. */
  tipAngle() {
    return Math.atan2(this.py[N - 1] - this.py[N - 2], this.px[N - 1] - this.px[N - 2])
  }

  render(root: TongueRoot) {
    const g = this.view
    g.clear()
    if (this.state === 'idle') return

    // Pin the base to where the mouth is drawn this frame (it can move between steps).
    this.px[0] = root.x
    this.py[0] = root.y
    const samples = this.resample()
    const count = catmullRom(this.rx, this.ry, samples, SUBDIV, this.sx, this.sy)
    const length = Math.hypot(this.tipX - root.x, this.tipY - root.y)
    // Thinner as it stretches, like real elastic. The base stays wide so it reads as a tongue.
    const thin = clamp(1.15 - length / 900, 0.72, 1.1)
    const tipW = TIP_HALF_WIDTH * thin
    const baseW = Math.max(tipW, Math.min(BASE_HALF_WIDTH, root.rx * 0.85))
    ribbonEdges(
      this.sx,
      this.sy,
      count,
      (t) => tipW + (baseW - tipW) * (1 - t) ** 2,
      this.left,
      this.right,
    )

    const shape: number[] = this.left.slice()
    for (let i = this.right.length - 2; i >= 0; i -= 2) shape.push(this.right[i], this.right[i + 1])
    g.poly(shape).fill(PALETTE.tongue)

    // Outline only where the tongue has left the mouth; inside it blends into the root.
    const first = this.firstOutside(root, count)
    if (first < count - 1) {
      polyline(g, this.left.slice(first * 2))
      g.stroke({ width: 1.6, color: PALETTE.tongueDark, alpha: 0.9, join: 'round', cap: 'round' })
      polyline(g, this.right.slice(first * 2))
      g.stroke({ width: 1.6, color: PALETTE.tongueDark, alpha: 0.9, join: 'round', cap: 'round' })
    }

    // The resting tongue in the mouth, drawn over the ribbon's base so it grows out of it.
    drawEllipse(g, root.x, root.y, root.rx, root.ry, root.rot)
    g.fill(PALETTE.tongue)

    // Wet highlight along one side, starting just outside the mouth.
    const hl: number[] = []
    const from = Math.max(first + 1, Math.floor(count * 0.12))
    const to = Math.floor(count * 0.86)
    for (let i = from; i < to; i++) {
      hl.push(
        this.sx[i] + (this.left[i * 2] - this.sx[i]) * 0.45,
        this.sy[i] + (this.left[i * 2 + 1] - this.sy[i]) * 0.45,
      )
    }
    if (hl.length >= 4) {
      polyline(g, hl)
      g.stroke({ width: 2.6, color: PALETTE.tongueLight, alpha: 0.85, cap: 'round', join: 'round' })
    }

    // Sticky, bulbous tip: darker underside, wet highlight on top.
    const tr = 10.5 * clamp(thin, 0.85, 1.05)
    g.circle(this.tipX, this.tipY, tr)
      .fill(PALETTE.tongue)
      .stroke({ width: 1.4, color: PALETTE.tongueDark, alpha: 0.9 })
    g.circle(this.tipX + tr * 0.12, this.tipY + tr * 0.22, tr * 0.72).fill({
      color: PALETTE.tongueDark,
      alpha: 0.35,
    })
    g.ellipse(this.tipX - tr * 0.28, this.tipY - tr * 0.38, tr * 0.42, tr * 0.26).fill({
      color: PALETTE.white,
      alpha: 0.7,
    })
    g.circle(this.tipX + tr * 0.35, this.tipY - tr * 0.1, tr * 0.1).fill({
      color: PALETTE.white,
      alpha: 0.6,
    })
  }

  /**
   * Evenly spaced points along the rope. Returns how many were written.
   * Points where the rope folds back on itself are skipped first; drawn as-is
   * they flip the ribbon edges and show up as rungs across the tongue.
   */
  private resample() {
    const { px, py, kx, ky, lens, rx, ry } = this
    let kept = 1
    kx[0] = px[0]
    ky[0] = py[0]
    let dirX = this.tipX - px[0]
    let dirY = this.tipY - py[0]
    for (let i = 1; i < N; i++) {
      const dx = px[i] - kx[kept - 1]
      const dy = py[i] - ky[kept - 1]
      const last = i === N - 1
      if (!last && (dx * dirX + dy * dirY <= 0 || dx * dx + dy * dy < 1)) continue
      if (last && kept > 1 && dx * dirX + dy * dirY <= 0) kept--
      kx[kept] = px[i]
      ky[kept] = py[i]
      dirX = dx
      dirY = dy
      kept++
    }

    lens[0] = 0
    for (let i = 1; i < kept; i++)
      lens[i] = lens[i - 1] + Math.hypot(kx[i] - kx[i - 1], ky[i] - ky[i - 1])
    const total = lens[kept - 1]
    const count = clamp(Math.round(total / SAMPLE_SPACING) + 1, 2, MAX_SAMPLES)
    let seg = 1
    for (let k = 0; k < count; k++) {
      const at = (total * k) / (count - 1)
      while (seg < kept - 1 && lens[seg] < at) seg++
      const span = lens[seg] - lens[seg - 1]
      const t = span > 1e-6 ? (at - lens[seg - 1]) / span : 0
      rx[k] = kx[seg - 1] + (kx[seg] - kx[seg - 1]) * t
      ry[k] = ky[seg - 1] + (ky[seg] - ky[seg - 1]) * t
    }
    return count
  }

  /** Index of the first smoothed point outside the root ellipse. */
  private firstOutside(root: TongueRoot, count: number) {
    const cos = Math.cos(-root.rot)
    const sin = Math.sin(-root.rot)
    for (let i = 0; i < count; i++) {
      const dx = this.sx[i] - root.x
      const dy = this.sy[i] - root.y
      const lx = (dx * cos - dy * sin) / root.rx
      const ly = (dx * sin + dy * cos) / root.ry
      if (lx * lx + ly * ly > 0.8) return Math.max(0, i - 1)
    }
    return count - 1
  }

  private startBack(freq: number, damping: number) {
    this.state = 'back'
    this.freq = freq
    this.damping = damping
  }

  private stepRope(dt: number, mouthX: number, mouthY: number) {
    const { px, py, ox, oy } = this
    px[0] = ox[0] = mouthX
    py[0] = oy[0] = mouthY
    px[N - 1] = ox[N - 1] = this.tipX
    py[N - 1] = oy[N - 1] = this.tipY

    const g = ROPE_GRAVITY * dt * dt
    for (let i = 1; i < N - 1; i++) {
      const vx = (px[i] - ox[i]) * ROPE_DAMPING
      const vy = (py[i] - oy[i]) * ROPE_DAMPING
      ox[i] = px[i]
      oy[i] = py[i]
      px[i] += vx
      py[i] += vy + g
    }

    const speed = Math.hypot(this.vx, this.vy)
    const slack = 1 + Math.min(0.06, speed / 30000)
    const rest = (Math.hypot(this.tipX - mouthX, this.tipY - mouthY) * slack) / (N - 1)

    for (let iter = 0; iter < 6; iter++) {
      for (let i = 0; i < N - 1; i++) {
        const j = i + 1
        const dx = px[j] - px[i]
        const dy = py[j] - py[i]
        const d = Math.hypot(dx, dy) || 1e-6
        const diff = (d - rest) / d
        const wi = i === 0 ? 0 : 1
        const wj = j === N - 1 ? 0 : 1
        const sum = wi + wj
        if (sum === 0) continue
        const cx = dx * diff
        const cy = dy * diff
        px[i] += (cx * wi) / sum
        py[i] += (cy * wi) / sum
        px[j] -= (cx * wj) / sum
        py[j] -= (cy * wj) / sum
      }
      for (let i = 1; i < N - 1; i++) {
        px[i] += ((px[i - 1] + px[i + 1]) * 0.5 - px[i]) * ROPE_BEND
        py[i] += ((py[i - 1] + py[i + 1]) * 0.5 - py[i]) * ROPE_BEND
      }
    }
  }
}

function drawEllipse(g: Graphics, x: number, y: number, rx: number, ry: number, rot: number) {
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  const steps = 20
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const ex = Math.cos(a) * rx
    const ey = Math.sin(a) * ry
    const px = x + ex * cos - ey * sin
    const py = y + ex * sin + ey * cos
    if (i === 0) g.moveTo(px, py)
    else g.lineTo(px, py)
  }
  g.closePath()
}
