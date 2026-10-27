import type { HazardKind, PreyKind } from './rules'

/** What stung, bit or pecked Pofik. */
export type StingSource = HazardKind | 'heron'

/**
 * Things that happen in a run that lifetime stats, missions and secret looks
 * care about. The game reports them; the app keeps the records.
 */
export type ProgressEvent =
  | { type: 'start' }
  | { type: 'catch'; kinds: PreyKind[]; combo: number; night: boolean; score: number }
  | { type: 'bullseye' | 'set' | 'burp' | 'power' | 'boop' | 'miss' }
  | { type: 'sting'; by: StingSource }
  | { type: 'tick'; runTime: number }
  | { type: 'end'; score: number; catches: number; misses: number }

const PREY: readonly PreyKind[] = [
  'fly',
  'golden',
  'dragonfly',
  'firefly',
  'moth',
  'ladybug',
  'beetle',
]
const STINGS: readonly StingSource[] = ['bee', 'wasp', 'spider', 'heron']

export interface Stats {
  runs: number
  playSeconds: number
  caught: Record<PreyKind, number>
  stings: Record<StingSource, number>
  bestCombo: number
  bullseyes: number
  sets: number
  burps: number
  powers: number
  boops: number
  missions: number
}

const counts = <K extends string>(keys: readonly K[], from?: Partial<Record<K, unknown>>) =>
  Object.fromEntries(keys.map((k) => [k, count(from?.[k])])) as Record<K, number>

const count = (v: unknown) => (typeof v === 'number' && v > 0 ? Math.floor(v) : 0)

export const emptyStats = (): Stats => sanitizeStats(null)

/** Stored stats with anything missing or broken reset to zero. */
export function sanitizeStats(value: unknown): Stats {
  const raw = (value ?? {}) as Partial<Record<keyof Stats, unknown>>
  return {
    runs: count(raw.runs),
    playSeconds: count(raw.playSeconds),
    caught: counts(PREY, raw.caught as Partial<Record<PreyKind, unknown>>),
    stings: counts(STINGS, raw.stings as Partial<Record<StingSource, unknown>>),
    bestCombo: count(raw.bestCombo),
    bullseyes: count(raw.bullseyes),
    sets: count(raw.sets),
    burps: count(raw.burps),
    powers: count(raw.powers),
    boops: count(raw.boops),
    missions: count(raw.missions),
  }
}

/** Stats after an event, or the same object when nothing changed. */
export function recordStats(stats: Stats, e: ProgressEvent): Stats {
  switch (e.type) {
    case 'start':
      return { ...stats, runs: stats.runs + 1 }
    case 'tick':
      return { ...stats, playSeconds: stats.playSeconds + 1 }
    case 'catch': {
      const caught = { ...stats.caught }
      for (const k of e.kinds) caught[k]++
      return { ...stats, caught, bestCombo: Math.max(stats.bestCombo, e.combo) }
    }
    case 'sting':
      return { ...stats, stings: { ...stats.stings, [e.by]: stats.stings[e.by] + 1 } }
    case 'bullseye':
      return { ...stats, bullseyes: stats.bullseyes + 1 }
    case 'set':
      return { ...stats, sets: stats.sets + 1 }
    case 'burp':
      return { ...stats, burps: stats.burps + 1 }
    case 'power':
      return { ...stats, powers: stats.powers + 1 }
    case 'boop':
      return { ...stats, boops: stats.boops + 1 }
    default:
      return stats
  }
}

/** Insects caught over all runs, ladybugs included. */
export const totalCaught = (stats: Stats) =>
  Object.values(stats.caught).reduce((sum, n) => sum + n, 0)
