import type { AudioEngine } from './AudioEngine'

export interface FilterSpec {
  type: BiquadFilterType
  f0: number
  /** End frequency for a sweep over the sound's duration. */
  f1?: number
  q?: number
}

export interface ToneSpec {
  type?: OscillatorType
  f0: number
  /** End frequency (pitch slide). */
  f1?: number
  slide?: 'exp' | 'lin'
  dur: number
  /** Delay before the sound starts, in seconds. */
  at?: number
  gain: number
  attack?: number
  /** Fraction of the duration held at full volume before decaying. */
  hold?: number
  vibrato?: { rate: number; depth: number }
  filter?: FilterSpec
  pan?: number
}

export interface NoiseSpec {
  dur: number
  at?: number
  gain: number
  attack?: number
  filter: FilterSpec
  pan?: number
}

const MIN = 0.0001

function envelope(
  param: AudioParam,
  t0: number,
  attack: number,
  dur: number,
  peak: number,
  hold = 0,
) {
  param.setValueAtTime(MIN, t0)
  param.exponentialRampToValueAtTime(Math.max(peak, MIN), t0 + attack)
  if (hold > 0) param.setValueAtTime(Math.max(peak, MIN), t0 + Math.max(attack, dur * hold))
  param.exponentialRampToValueAtTime(MIN, t0 + dur)
}

function filterNode(ctx: AudioContext, spec: FilterSpec, t0: number, dur: number) {
  const f = ctx.createBiquadFilter()
  f.type = spec.type
  f.Q.value = spec.q ?? 1
  f.frequency.setValueAtTime(spec.f0, t0)
  if (spec.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(spec.f1, t0 + dur)
  return f
}

function output(e: AudioEngine, node: AudioNode, pan: number | undefined) {
  if (pan === undefined || !e.ctx!.createStereoPanner) {
    node.connect(e.sfx)
    return [] as AudioNode[]
  }
  const p = e.ctx!.createStereoPanner()
  p.pan.value = pan
  node.connect(p).connect(e.sfx)
  return [p]
}

/** One oscillator voice with pitch, filter and volume envelopes. */
export function tone(e: AudioEngine, s: ToneSpec, pitch = 1) {
  const ctx = e.ctx
  if (!ctx || ctx.state !== 'running') return
  const t0 = ctx.currentTime + (s.at ?? 0)
  const osc = ctx.createOscillator()
  osc.type = s.type ?? 'sine'
  osc.frequency.setValueAtTime(s.f0 * pitch, t0)
  if (s.f1 !== undefined) {
    if (s.slide === 'lin') osc.frequency.linearRampToValueAtTime(s.f1 * pitch, t0 + s.dur)
    else osc.frequency.exponentialRampToValueAtTime(s.f1 * pitch, t0 + s.dur)
  }
  const nodes: AudioNode[] = [osc]
  let last: AudioNode = osc
  if (s.filter) {
    const f = filterNode(ctx, s.filter, t0, s.dur)
    last.connect(f)
    last = f
    nodes.push(f)
  }
  const g = ctx.createGain()
  envelope(g.gain, t0, s.attack ?? 0.004, s.dur, s.gain, s.hold)
  last.connect(g)
  nodes.push(g, ...output(e, g, s.pan))

  let lfo: OscillatorNode | null = null
  if (s.vibrato) {
    lfo = ctx.createOscillator()
    lfo.frequency.value = s.vibrato.rate
    const depth = ctx.createGain()
    depth.gain.value = s.vibrato.depth * pitch
    lfo.connect(depth).connect(osc.frequency)
    nodes.push(lfo, depth)
    lfo.start(t0)
    lfo.stop(t0 + s.dur + 0.05)
  }
  osc.start(t0)
  osc.stop(t0 + s.dur + 0.05)
  osc.onended = () => nodes.forEach((n) => n.disconnect())
}

/** Filtered white noise burst, for whooshes, slurps and crackles. */
export function noise(e: AudioEngine, s: NoiseSpec) {
  const ctx = e.ctx
  if (!ctx || ctx.state !== 'running') return
  const t0 = ctx.currentTime + (s.at ?? 0)
  const src = ctx.createBufferSource()
  src.buffer = e.noise
  src.loop = true
  const f = filterNode(ctx, s.filter, t0, s.dur)
  const g = ctx.createGain()
  envelope(g.gain, t0, s.attack ?? 0.004, s.dur, s.gain)
  src.connect(f).connect(g)
  const nodes: AudioNode[] = [src, f, g, ...output(e, g, s.pan)]
  src.start(t0, Math.random() * 0.8)
  src.stop(t0 + s.dur + 0.05)
  src.onended = () => nodes.forEach((n) => n.disconnect())
}
