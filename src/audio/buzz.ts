import type { AudioEngine } from './AudioEngine'

interface Voice {
  gain: GainNode
  pan: StereoPannerNode | null
  oscs: OscillatorNode[]
  baseFreq: number
  maxGain: number
}

export interface BuzzInput {
  pan: number
  proximity: number
  speed: number
}

/**
 * Two persistent voices, one for the nearest fly and one for the nearest bee.
 * Volume follows distance to Gulpsalot and stereo pan follows the insect, so you
 * can hear where they are.
 */
export class BuzzLayer {
  private fly: Voice | null = null
  private bee: Voice | null = null
  private readonly engine: AudioEngine

  constructor(engine: AudioEngine) {
    this.engine = engine
    engine.onReady((ctx) => {
      this.fly = this.voice(ctx, 210, 0.035, 1500, 31)
      this.bee = this.voice(ctx, 118, 0.06, 700, 24)
    })
  }

  update(fly: BuzzInput | null, bee: BuzzInput | null) {
    const ctx = this.engine.ctx
    if (!ctx || ctx.state !== 'running') return
    this.apply(ctx, this.fly, fly)
    this.apply(ctx, this.bee, bee)
  }

  silence() {
    const ctx = this.engine.ctx
    if (!ctx) return
    this.apply(ctx, this.fly, null)
    this.apply(ctx, this.bee, null)
  }

  private apply(ctx: AudioContext, v: Voice | null, input: BuzzInput | null) {
    if (!v) return
    const now = ctx.currentTime
    const level = input ? input.proximity * input.proximity * v.maxGain : 0
    v.gain.gain.setTargetAtTime(level, now, 0.08)
    if (!input) return
    v.pan?.pan.setTargetAtTime(input.pan * 0.8, now, 0.08)
    const f = v.baseFreq * (1 + Math.min(input.speed, 400) / 1600)
    v.oscs[0].frequency.setTargetAtTime(f, now, 0.1)
    v.oscs[1].frequency.setTargetAtTime(f * 1.012, now, 0.1)
  }

  private voice(
    ctx: AudioContext,
    freq: number,
    maxGain: number,
    cutoff: number,
    flutter: number,
  ): Voice {
    const a = ctx.createOscillator()
    const b = ctx.createOscillator()
    a.type = b.type = 'sawtooth'
    a.frequency.value = freq
    b.frequency.value = freq * 1.012
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoff
    filter.Q.value = 1.4

    // Wing flutter: fast amplitude wobble.
    const am = ctx.createGain()
    am.gain.value = 0.7
    const lfo = ctx.createOscillator()
    lfo.frequency.value = flutter
    const lfoDepth = ctx.createGain()
    lfoDepth.gain.value = 0.3
    lfo.connect(lfoDepth).connect(am.gain)

    const gain = ctx.createGain()
    gain.gain.value = 0
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    a.connect(filter)
    b.connect(filter)
    filter.connect(am).connect(gain)
    if (pan) gain.connect(pan).connect(this.engine.ambience)
    else gain.connect(this.engine.ambience)
    a.start()
    b.start()
    lfo.start()
    return { gain, pan, oscs: [a, b], baseFreq: freq, maxGain }
  }
}
