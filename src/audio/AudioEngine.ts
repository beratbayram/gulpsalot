type Listener = (ctx: AudioContext) => void

/**
 * Owns the AudioContext. Browsers (iOS Safari especially) only allow audio
 * after a user gesture, so the context is created and resumed lazily from
 * the first gesture and every later one until it is running.
 */
export class AudioEngine {
  ctx: AudioContext | null = null
  master!: GainNode
  sfx!: GainNode
  ambience!: GainNode
  noise!: AudioBuffer
  private muted = false
  private readyListeners = new Set<Listener>()
  private installed = false

  get running() {
    return this.ctx?.state === 'running'
  }

  /** Listens for gestures to unlock audio. Safe to call more than once. */
  install(target: Window = window) {
    if (this.installed) return
    this.installed = true
    const unlock = () => this.unlock()
    // iOS only counts some events as user activation (pointerup/touchend for touch, not pointerdown).
    for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
      target.addEventListener(type, unlock, { capture: true, passive: true })
    }
  }

  onReady(listener: Listener) {
    if (this.ctx) listener(this.ctx)
    else this.readyListeners.add(listener)
  }

  unlock() {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      const ctx = new Ctor({ latencyHint: 'interactive' })
      this.ctx = ctx
      this.build(ctx)
      this.readyListeners.forEach((l) => l(ctx))
      this.readyListeners.clear()
    }
    const ctx = this.ctx
    if (ctx.state !== 'running') {
      void ctx.resume().catch(() => {})
      // A silent one-sample buffer completes the unlock on older iOS.
      const src = ctx.createBufferSource()
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
      src.connect(ctx.destination)
      src.start(0)
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (!this.ctx) return
    const now = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(now)
    this.master.gain.setTargetAtTime(muted ? 0 : 1, now, 0.04)
  }

  get isMuted() {
    return this.muted
  }

  suspend() {
    if (this.ctx?.state === 'running') void this.ctx.suspend().catch(() => {})
  }

  resume() {
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume().catch(() => {})
  }

  private build(ctx: AudioContext) {
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 1
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -10
    limiter.knee.value = 8
    limiter.ratio.value = 6
    limiter.attack.value = 0.003
    limiter.release.value = 0.15
    this.master.connect(limiter).connect(ctx.destination)

    this.sfx = ctx.createGain()
    this.sfx.gain.value = 0.9
    this.sfx.connect(this.master)
    this.ambience = ctx.createGain()
    this.ambience.gain.value = 1
    this.ambience.connect(this.master)

    const length = ctx.sampleRate
    this.noise = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  }
}
