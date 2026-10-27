import type { AudioEngine } from './AudioEngine'

type Weather = 'clear' | 'rain' | 'wind' | 'fog'

interface Loop {
  gain: GainNode
  filter: BiquadFilterNode
}

/**
 * Rain and wind as looping filtered noise. Rain is a steady hiss; wind is a
 * low rush whose volume and brightness follow the gusts.
 */
export class WeatherLayer {
  private rain: Loop | null = null
  private wind: Loop | null = null
  private readonly engine: AudioEngine

  constructor(engine: AudioEngine) {
    this.engine = engine
    engine.onReady((ctx) => {
      this.rain = this.loop(ctx, 'bandpass', 3200, 0.6)
      this.wind = this.loop(ctx, 'lowpass', 420, 1.2)
    })
  }

  update(weather: Weather, level: number) {
    const ctx = this.engine.ctx
    if (!ctx || ctx.state !== 'running' || !this.rain || !this.wind) return
    const now = ctx.currentTime
    this.rain.gain.gain.setTargetAtTime(weather === 'rain' ? 0.05 * level : 0, now, 0.6)
    const windy = weather === 'wind'
    this.wind.gain.gain.setTargetAtTime(windy ? 0.03 + 0.09 * level : 0, now, 0.3)
    this.wind.filter.frequency.setTargetAtTime(260 + 900 * (windy ? level : 0), now, 0.3)
  }

  silence() {
    const ctx = this.engine.ctx
    if (!ctx || !this.rain || !this.wind) return
    this.rain.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
    this.wind.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
  }

  private loop(ctx: AudioContext, type: BiquadFilterType, freq: number, q: number): Loop {
    const src = ctx.createBufferSource()
    src.buffer = this.engine.noise
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    filter.Q.value = q
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(filter).connect(gain).connect(this.engine.ambience)
    src.start()
    return { gain, filter }
  }
}
