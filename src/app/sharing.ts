/** A friend's challenge from a shared link: the same insects, and a score to beat. */
export interface Challenge {
  seed: number
  score: number
}

const PARAM = 'challenge'
const MAX_SEED = 0x7fffffff

/** Reads `?challenge=<seed>.<score>`. Anything malformed is ignored. */
export function parseChallenge(search: string): Challenge | null {
  const raw = new URLSearchParams(search).get(PARAM)
  const match = raw?.match(/^(\d{1,10})\.(\d{1,6})$/)
  if (!match) return null
  const seed = Number(match[1])
  const score = Number(match[2])
  return seed >= 1 && seed <= MAX_SEED ? { seed, score } : null
}

/** The address with the challenge parameter taken out, other parameters kept. */
export function withoutChallenge(href: string) {
  const url = new URL(href)
  url.searchParams.delete(PARAM)
  return url.toString()
}

/** A link to the game at `base` that starts a challenge on the same seed. */
export function challengeUrl(base: string, challenge: Challenge) {
  const url = new URL(base)
  url.search = ''
  url.hash = ''
  url.searchParams.set(PARAM, `${challenge.seed}.${challenge.score}`)
  return url.toString()
}

export interface RunSummary {
  score: number
  stings: number
  bestCombo: number
  streak: number
}

/**
 * A spoiler-free result line, Wordle style: the score, the ouches, the best
 * combo and the daily streak, as emoji.
 */
export function resultLine({ score, stings, bestCombo, streak }: RunSummary) {
  const parts = [`🪰 ${score}`, `🐝 ${stings}`, `x${Math.max(1, bestCombo)}`]
  if (streak > 1) parts.push(`🔥 ${streak}`)
  return parts.join(' · ')
}
