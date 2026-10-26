/**
 * Turns variable frame times into small equal sub-steps so springs and
 * collisions behave the same at 60, 90 or 120 Hz, and supports hit-stop
 * (brief simulation freezes that sell impacts) and a debug time scale.
 */
export class StepClock {
  /** Longest frame we simulate; anything longer (tab switch, jank) is dropped. */
  maxFrame = 0.1
  /** Upper bound for a single sub-step. */
  maxStep = 1 / 120
  timeScale = 1
  private hitStop = 0

  hitStopFor(seconds: number) {
    this.hitStop = Math.max(this.hitStop, seconds)
  }

  get frozen() {
    return this.hitStop > 0
  }

  reset() {
    this.hitStop = 0
  }

  /** Runs `step` as many times as needed for this frame. Returns simulated seconds. */
  advance(frameSeconds: number, step: (dt: number) => void) {
    let dt = Math.min(Math.max(frameSeconds, 0), this.maxFrame) * this.timeScale
    if (this.hitStop > 0) {
      const used = Math.min(this.hitStop, dt)
      this.hitStop -= used
      dt -= used
    }
    if (dt <= 1e-6) return 0
    const count = Math.ceil(dt / this.maxStep - 1e-9)
    const h = dt / count
    for (let i = 0; i < count; i++) step(h)
    return dt
  }
}
