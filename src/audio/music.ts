import type { AudioEngine } from './AudioEngine'
import { noise, tone } from './synth'

export type MusicMood = 'title' | 'run' | 'zen' | 'over' | 'paused'

type Layer = 'pad' | 'bass' | 'beat' | 'melody' | 'arp' | 'sparkle'

const LAYERS: Layer[] = ['pad', 'bass', 'beat', 'melody', 'arp', 'sparkle']

/** Combo level each layer joins at during a run. */
const JOIN_AT: Record<Layer, number> = { pad: 1, bass: 1, beat: 2, melody: 3, arp: 4, sparkle: 5 }

/** Layer volumes, before the mood and the combo decide which ones play. */
const LEVEL: Record<Layer, number> = {
  pad: 0.5,
  bass: 0.7,
  beat: 0.55,
  melody: 0.6,
  arp: 0.4,
  sparkle: 0.35,
}

const A3 = 220
const semis = (base: number, n: number) => base * 2 ** (n / 12)

/** I, vi, IV, V in C: a warm loop with chord tones as semitones above A3. */
const DAY_CHORDS = [
  { root: -9, tones: [3, 7, 10, 14] }, // C maj7
  { root: -12, tones: [0, 3, 7, 10] }, // A min7
  { root: -16, tones: [-4, 0, 3, 7] }, // F maj7
  { root: -14, tones: [-2, 2, 5, 9] }, // G6
]

/** vi, IV, I, V at night: the same notes, a sleepier order. */
const NIGHT_CHORDS = [DAY_CHORDS[1], DAY_CHORDS[2], DAY_CHORDS[0], DAY_CHORDS[3]]

/** C major pentatonic over two octaves, as semitones above A3. */
const PENTA = [3, 5, 7, 10, 12, 15, 17, 19, 22, 24]

const LOOKAHEAD = 0.25
const TICK_MS = 60

/**
 * Generative background music, all synthesized. A soft pad and bass always
 * play; percussion, a melody, an arpeggio and sparkles join as the combo
 * climbs and drop out when it breaks. The Zen pond and the title screen get
 * a slower, calmer take; night swaps the chord order and darkens the tone.
 */
export class Music {
  private readonly engine: AudioEngine
  private readonly gains = new Map<Layer, GainNode>()
  private filter: BiquadFilterNode | null = null
  private bus: GainNode | null = null
  /** Layers currently playing; silent ones aren't scheduled at all. */
  private readonly active = new Set<Layer>()
  private nextTime = 0
  private step = 0
  private mood: MusicMood = 'title'
  private intensity = 1
  private night = 0

  constructor(engine: AudioEngine) {
    this.engine = engine
    engine.onReady((ctx) => this.build(ctx))
  }

  setMood(mood: MusicMood) {
    if (mood === this.mood) return
    this.mood = mood
    this.applyLayers()
  }

  /** Combo multiplier, 1 to 5. */
  setIntensity(level: number) {
    const next = Math.max(1, Math.min(5, Math.round(level)))
    if (next === this.intensity) return
    this.intensity = next
    this.applyLayers()
  }

  /** 0 = day, 1 = full night. */
  setNight(amount: number) {
    if (Math.abs(amount - this.night) < 0.05) return
    this.night = amount
    const ctx = this.engine.ctx
    if (ctx && this.filter)
      this.filter.frequency.setTargetAtTime(5200 - 3200 * amount, ctx.currentTime, 1.5)
  }

  private build(ctx: AudioContext) {
    this.bus = ctx.createGain()
    this.bus.gain.value = 0.55
    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 5200
    this.bus.connect(this.filter).connect(this.engine.music)
    for (const layer of LAYERS) {
      const g = ctx.createGain()
      g.gain.value = 0
      g.connect(this.bus)
      this.gains.set(layer, g)
    }
    this.applyLayers()
    setInterval(() => this.schedule(), TICK_MS)
  }

  private get tempo() {
    return this.mood === 'run' || this.mood === 'paused' ? 96 : 72
  }

  /** Fades layers in or out for the current mood and combo. */
  private applyLayers() {
    const ctx = this.engine.ctx
    if (!ctx || !this.bus) return
    const now = ctx.currentTime
    for (const layer of LAYERS) {
      let on: boolean
      switch (this.mood) {
        case 'run':
        case 'paused':
          on = this.intensity >= JOIN_AT[layer]
          break
        case 'zen':
        case 'title':
          on = layer === 'pad' || layer === 'bass' || layer === 'melody'
          break
        default:
          on = layer === 'pad'
      }
      this.gains.get(layer)!.gain.setTargetAtTime(on ? LEVEL[layer] : 0, now, on ? 0.6 : 0.35)
      if (on) this.active.add(layer)
      else this.active.delete(layer)
    }
    const volume = this.mood === 'paused' ? 0.2 : this.mood === 'over' ? 0.35 : 0.55
    this.bus.gain.setTargetAtTime(volume, now, 0.4)
  }

  /** Queues every eighth note that starts within the lookahead window. */
  private schedule() {
    const ctx = this.engine.ctx
    if (!ctx || ctx.state !== 'running') return
    const now = ctx.currentTime
    // After a pause in the audio clock (hidden tab), start fresh instead of catching up.
    if (this.nextTime < now - 0.1) this.nextTime = now + 0.05
    const eighth = 30 / this.tempo
    while (this.nextTime < now + LOOKAHEAD) {
      this.playStep(this.step, this.nextTime, eighth)
      this.nextTime += eighth
      this.step = (this.step + 1) % 64
    }
  }

  /** One eighth note: 8 per bar, 2 bars per chord, 4 chords per loop. */
  private playStep(step: number, when: number, eighth: number) {
    const chords = this.night > 0.5 ? NIGHT_CHORDS : DAY_CHORDS
    const chord = chords[Math.floor(step / 16) % 4]
    const inBar = step % 8
    const out = (layer: Layer) => this.gains.get(layer)!
    const on = (layer: Layer) => this.active.has(layer)

    if (step % 16 === 0 && on('pad')) {
      for (const n of chord.tones) {
        tone(this.engine, {
          type: 'triangle',
          f0: semis(A3, n),
          dur: eighth * 16,
          when,
          gain: 0.035,
          attack: 0.6,
          hold: 0.55,
          vibrato: { rate: 4.5, depth: 1.5 },
          out: out('pad'),
        })
      }
    }

    if ((inBar === 0 || inBar === 5) && on('bass')) {
      tone(this.engine, {
        type: 'triangle',
        f0: semis(A3, chord.root),
        dur: eighth * 2.5,
        when,
        gain: 0.16,
        attack: 0.01,
        filter: { type: 'lowpass', f0: 600 },
        out: out('bass'),
      })
    }

    if ((inBar === 0 || inBar === 4) && on('beat')) {
      tone(this.engine, {
        type: 'sine',
        f0: 130,
        f1: 48,
        dur: 0.16,
        when,
        gain: 0.22,
        out: out('beat'),
      })
    }
    if (on('beat'))
      noise(this.engine, {
        dur: inBar % 2 ? 0.05 : 0.03,
        when,
        gain: inBar % 2 ? 0.05 : 0.025,
        filter: { type: 'highpass', f0: 7000 },
        out: out('beat'),
      })

    // A loose marimba melody: more notes the busier the music gets.
    const busy = this.mood === 'run' ? 0.35 + this.intensity * 0.06 : 0.22
    if (inBar % 2 === 0 && on('melody') && Math.random() < busy) {
      const n = PENTA[Math.floor(Math.random() * PENTA.length)]
      tone(this.engine, {
        type: 'sine',
        f0: semis(A3 * 2, n),
        dur: 0.35,
        when,
        gain: 0.07,
        attack: 0.004,
        out: out('melody'),
      })
      tone(this.engine, {
        type: 'sine',
        f0: semis(A3 * 2, n) * 4,
        dur: 0.08,
        when,
        gain: 0.012,
        out: out('melody'),
      })
    }

    // Arpeggio on chord tones, two notes per eighth.
    for (let k = 0; k < (on('arp') ? 2 : 0); k++) {
      const n = chord.tones[(step * 2 + k) % chord.tones.length] + 12
      tone(this.engine, {
        type: 'square',
        f0: semis(A3, n),
        dur: eighth * 0.45,
        when: when + (k * eighth) / 2,
        gain: 0.018,
        filter: { type: 'lowpass', f0: 2200 },
        out: out('arp'),
      })
    }

    if (inBar === 3 && on('sparkle') && Math.random() < 0.6) {
      const n = PENTA[5 + Math.floor(Math.random() * 5)] + 12
      tone(this.engine, {
        type: 'sine',
        f0: semis(A3 * 2, n),
        dur: 0.6,
        when,
        gain: 0.03,
        vibrato: { rate: 8, depth: 6 },
        out: out('sparkle'),
      })
    }
  }
}
