const TWO_PI = Math.PI * 2

export interface SpringConfig {
  /** Natural frequency in Hz. Higher = snappier. */
  freq: number
  /** Damping ratio. 1 = critically damped, below 1 overshoots. */
  damping: number
}

/**
 * Damped spring integrated with semi-implicit Euler.
 * Stable for the small steps the game uses (<= 1/120 s) up to roughly 30 Hz.
 */
export class Spring {
  value: number
  target: number
  velocity = 0
  freq: number
  damping: number

  constructor(value = 0, config: SpringConfig = { freq: 3, damping: 1 }) {
    this.value = value
    this.target = value
    this.freq = config.freq
    this.damping = config.damping
  }

  configure(config: SpringConfig) {
    this.freq = config.freq
    this.damping = config.damping
    return this
  }

  step(dt: number) {
    const w = TWO_PI * this.freq
    const accel = -w * w * (this.value - this.target) - 2 * this.damping * w * this.velocity
    this.velocity += accel * dt
    this.value += this.velocity * dt
    return this.value
  }

  /** Adds velocity, the usual way to "pluck" a spring for a reaction. */
  kick(velocity: number) {
    this.velocity += velocity
  }

  snap(value: number) {
    this.value = value
    this.target = value
    this.velocity = 0
  }

  isSettled(epsilon = 1e-3) {
    return Math.abs(this.value - this.target) < epsilon && Math.abs(this.velocity) < epsilon
  }
}

/** Two-dimensional version of {@link Spring}. */
export class Spring2 {
  x: number
  y: number
  vx = 0
  vy = 0
  tx: number
  ty: number
  freq: number
  damping: number

  constructor(x = 0, y = 0, config: SpringConfig = { freq: 3, damping: 1 }) {
    this.x = this.tx = x
    this.y = this.ty = y
    this.freq = config.freq
    this.damping = config.damping
  }

  configure(config: SpringConfig) {
    this.freq = config.freq
    this.damping = config.damping
    return this
  }

  setTarget(x: number, y: number) {
    this.tx = x
    this.ty = y
  }

  step(dt: number) {
    const w = TWO_PI * this.freq
    const k = w * w
    const c = 2 * this.damping * w
    this.vx += (-k * (this.x - this.tx) - c * this.vx) * dt
    this.vy += (-k * (this.y - this.ty) - c * this.vy) * dt
    this.x += this.vx * dt
    this.y += this.vy * dt
  }

  snap(x: number, y: number) {
    this.x = this.tx = x
    this.y = this.ty = y
    this.vx = this.vy = 0
  }
}
