import type { AudioEngine } from './AudioEngine'
import { noise, tone } from './synth'

/** Small random detune so repeated sounds never feel copy-pasted. */
const vary = (amount = 0.04) => 1 + (Math.random() * 2 - 1) * amount

const NOTE = {
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880,
  C6: 1046.5,
  E6: 1318.5,
  G6: 1568,
  C7: 2093,
  D7: 2349.3,
  E7: 2637,
  G7: 3136,
}

/** Pentatonic, so random sparkles always sound nice together. */
const SPARKLE = [NOTE.C7, NOTE.D7, NOTE.E7, NOTE.G7]
const COMBO = [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5]

/**
 * Every sound in the game, synthesized at play time. No audio files.
 * Each recipe is a few oscillators and noise bursts with envelopes.
 */
export function createSfx(e: AudioEngine) {
  const lastPlayed = new Map<string, number>()
  /** Drops a sound if the same one played less than `gap` seconds ago. */
  const gate = (id: string, gap: number) => {
    const now = e.ctx?.currentTime ?? 0
    const last = lastPlayed.get(id)
    if (last !== undefined && now - last < gap) return false
    lastPlayed.set(id, now)
    return true
  }

  return {
    /** Tongue launch: a wet "thwip". */
    shoot() {
      const p = vary()
      noise(e, {
        dur: 0.11,
        gain: 0.32,
        filter: { type: 'bandpass', f0: 900 * p, f1: 3800 * p, q: 2.2 },
      })
      tone(e, { type: 'sine', f0: 320, f1: 980, dur: 0.08, gain: 0.14 }, p)
    },

    /** Empty tongue snapping back. */
    retract() {
      const p = vary()
      noise(e, {
        dur: 0.09,
        gain: 0.12,
        filter: { type: 'bandpass', f0: 2600 * p, f1: 800 * p, q: 2 },
      })
      tone(e, { type: 'sine', f0: 700, f1: 260, dur: 0.07, gain: 0.08 }, p)
    },

    /** A fly sticks to the tongue. Pitch climbs for multi-catches. */
    stick(index: number) {
      const p = vary(0.02) * (1 + Math.min(index - 1, 5) * 0.12)
      tone(e, { type: 'triangle', f0: 1250, f1: 1700, dur: 0.055, gain: 0.16 }, p)
      noise(e, { dur: 0.035, gain: 0.08, filter: { type: 'highpass', f0: 3000 } })
    },

    /** Swallow: a low, round "gulp" with a little pop. */
    gulp(count: number) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const at = i * 0.09
        const p = vary() * (1 + i * 0.1)
        tone(e, { type: 'sine', f0: 430, f1: 115, dur: 0.17, gain: 0.5, at }, p)
        tone(e, { type: 'triangle', f0: 230, f1: 95, dur: 0.12, gain: 0.18, at: at + 0.02 }, p)
        noise(e, { dur: 0.05, gain: 0.08, at, filter: { type: 'lowpass', f0: 700 } })
      }
      if (count > 1) tone(e, { type: 'sine', f0: NOTE.E6, dur: 0.12, gain: 0.07, at: 0.12 })
    },

    /** Tapping Pofik: a squeaky giggle. */
    boop() {
      const p = vary(0.06)
      tone(e, { type: 'triangle', f0: 540, f1: 1050, dur: 0.1, gain: 0.22 }, p)
      tone(
        e,
        {
          type: 'sine',
          f0: 980,
          f1: 720,
          dur: 0.12,
          gain: 0.16,
          at: 0.08,
          vibrato: { rate: 22, depth: 40 },
        },
        p,
      )
    },

    /** Bee sting: an electric zap, a crack, and a cartoon boing. */
    sting() {
      tone(e, {
        type: 'sawtooth',
        f0: 190,
        f1: 55,
        dur: 0.28,
        gain: 0.3,
        filter: { type: 'lowpass', f0: 2400, f1: 380, q: 3 },
        vibrato: { rate: 38, depth: 40 },
      })
      noise(e, { dur: 0.09, gain: 0.28, filter: { type: 'highpass', f0: 1800 } })
      tone(e, {
        type: 'sine',
        f0: 330,
        f1: 150,
        dur: 0.42,
        gain: 0.24,
        at: 0.05,
        vibrato: { rate: 17, depth: 28 },
      })
      tone(e, { type: 'sine', f0: 1900, dur: 0.06, gain: 0.05, at: 0.2 })
      tone(e, { type: 'sine', f0: 2400, dur: 0.06, gain: 0.05, at: 0.3 })
    },

    /** Empty tummy rumble. */
    growl() {
      if (!gate('growl', 1.5)) return
      tone(e, {
        type: 'sawtooth',
        f0: 70,
        f1: 52,
        dur: 0.6,
        gain: 0.22,
        attack: 0.08,
        filter: { type: 'lowpass', f0: 260, q: 4 },
        vibrato: { rate: 9, depth: 14 },
      })
      noise(e, { dur: 0.5, gain: 0.06, attack: 0.1, filter: { type: 'lowpass', f0: 220, q: 6 } })
    },

    /** Sad "wah wah wah wahhh". */
    gameOver() {
      const notes = [392, 370, 349, 330]
      notes.forEach((f, i) => {
        const last = i === notes.length - 1
        const dur = last ? 0.75 : 0.24
        tone(e, {
          type: 'triangle',
          f0: f,
          f1: last ? f * 0.94 : undefined,
          dur,
          at: i * 0.26,
          gain: 0.22,
          attack: 0.02,
          hold: 0.5,
          filter: { type: 'lowpass', f0: 500, f1: 1500, q: 5 },
          vibrato: last ? { rate: 6, depth: 9 } : undefined,
        })
      })
    },

    /** A golden fly shows up: a quick shimmer from its side of the screen. */
    goldenAppear(pan: number) {
      ;[NOTE.E6, NOTE.G6, NOTE.C7, NOTE.E7].forEach((f, i) =>
        tone(e, { type: 'sine', f0: f, dur: 0.2, at: i * 0.045, gain: 0.06, pan }),
      )
    },

    /** Soft sparkle while a golden fly is around. */
    twinkle(pan: number) {
      if (!gate('twinkle', 0.18)) return
      const f = SPARKLE[Math.floor(Math.random() * SPARKLE.length)]
      tone(e, { type: 'sine', f0: f, dur: 0.1, gain: 0.028, pan })
    },

    /** Golden fly swallowed: a bright run up and a shimmering tail. */
    goldenCatch() {
      ;[NOTE.C6, NOTE.E6, NOTE.G6, NOTE.C7].forEach((f, i) =>
        tone(e, { type: 'triangle', f0: f, dur: 0.16, at: i * 0.055, gain: 0.14 }),
      )
      tone(e, {
        type: 'sine',
        f0: NOTE.E7,
        dur: 0.55,
        at: 0.22,
        gain: 0.06,
        vibrato: { rate: 9, depth: 24 },
      })
      noise(e, { dur: 0.45, at: 0.08, gain: 0.05, filter: { type: 'highpass', f0: 6500 } })
    },

    /** Dragonflies zip, fireflies chime. */
    catchSpecial(kind: 'dragonfly' | 'firefly') {
      if (kind === 'dragonfly') {
        tone(e, {
          type: 'square',
          f0: 520,
          f1: 1900,
          dur: 0.09,
          gain: 0.06,
          filter: { type: 'lowpass', f0: 3200 },
        })
        tone(e, { type: 'triangle', f0: NOTE.G6, dur: 0.1, at: 0.08, gain: 0.08 })
        return
      }
      tone(e, { type: 'sine', f0: NOTE.G6, dur: 0.6, gain: 0.08, attack: 0.01 })
      tone(e, { type: 'sine', f0: NOTE.C7, dur: 0.5, at: 0.09, gain: 0.05, attack: 0.01 })
    },

    /** Combo multiplier went up. Each level is a step higher. */
    combo(level: number) {
      const f = COMBO[Math.max(0, Math.min(level - 1, COMBO.length - 1))]
      const filter = { type: 'lowpass', f0: 3000 } as const
      tone(e, { type: 'square', f0: f, dur: 0.08, gain: 0.07, filter })
      tone(e, { type: 'square', f0: f * 1.5, dur: 0.12, at: 0.07, gain: 0.07, filter })
      tone(e, { type: 'sine', f0: f * 2, dur: 0.24, at: 0.13, gain: 0.07 })
    },

    /** The tongue brushed past a bee: a whoosh and a relieved "phew". */
    closeCall() {
      noise(e, { dur: 0.22, gain: 0.12, filter: { type: 'bandpass', f0: 500, f1: 2600, q: 1.4 } })
      tone(e, { type: 'sine', f0: 900, f1: 500, dur: 0.2, at: 0.12, gain: 0.08 })
    },

    /** Achievement unlocked: a short fanfare. */
    achievement() {
      const notes = [NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6]
      notes.forEach((f, i) => {
        const last = i === notes.length - 1
        tone(e, {
          type: 'triangle',
          f0: f,
          dur: last ? 0.5 : 0.11,
          at: i * 0.085,
          gain: 0.14,
          hold: last ? 0.3 : 0,
          vibrato: last ? { rate: 7, depth: 10 } : undefined,
        })
      })
      tone(e, { type: 'sine', f0: NOTE.C7, dur: 0.4, at: 0.3, gain: 0.05 })
    },

    /** Bright arpeggio for a new best score. */
    newBest() {
      const notes = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6]
      notes.forEach((f, i) =>
        tone(e, {
          type: 'square',
          f0: f,
          dur: 0.12,
          at: i * 0.08,
          gain: 0.13,
          filter: { type: 'lowpass', f0: 3200 },
        }),
      )
      tone(e, {
        type: 'sine',
        f0: NOTE.C6 * 2,
        dur: 0.35,
        at: 0.34,
        gain: 0.08,
        vibrato: { rate: 8, depth: 12 },
      })
    },

    /** Run start: a rising "whoop". */
    start() {
      tone(e, { type: 'sine', f0: 280, f1: 920, dur: 0.2, gain: 0.22 })
      tone(e, { type: 'triangle', f0: 560, f1: 1840, dur: 0.16, gain: 0.06, at: 0.04 })
    },

    /** Continue after an ad: quick hopeful arpeggio. */
    revive() {
      ;[NOTE.G5 / 2, NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) =>
        tone(e, { type: 'triangle', f0: f, dur: 0.14, at: i * 0.06, gain: 0.18 }),
      )
    },

    uiTap() {
      tone(e, { type: 'sine', f0: 520, f1: 880, dur: 0.06, gain: 0.16 }, vary(0.03))
    },

    uiBack() {
      tone(e, { type: 'sine', f0: 760, f1: 420, dur: 0.07, gain: 0.14 }, vary(0.03))
    },

    toggle(on: boolean) {
      tone(e, { type: 'triangle', f0: on ? 660 : 520, dur: 0.05, gain: 0.13 })
      tone(e, { type: 'triangle', f0: on ? 990 : 390, dur: 0.06, gain: 0.13, at: 0.05 })
    },

    countTick(step: number) {
      if (!gate('tick', 0.035)) return
      tone(e, { type: 'sine', f0: 900 + Math.min(step, 40) * 18, dur: 0.03, gain: 0.05 })
    },
  }
}

export type Sfx = ReturnType<typeof createSfx>
