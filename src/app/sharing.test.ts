import { describe, expect, it } from 'vitest'
import { challengeUrl, parseChallenge, resultLine, withoutChallenge } from './sharing'

describe('challenge links', () => {
  it('round-trips a seed and score through a link', () => {
    const url = challengeUrl('https://www.beratbayram.com/pofik?debug#x', { seed: 123, score: 42 })
    expect(url).toBe('https://www.beratbayram.com/pofik?challenge=123.42')
    expect(parseChallenge(new URL(url).search)).toEqual({ seed: 123, score: 42 })
  })

  it('ignores malformed or out of range challenges', () => {
    expect(parseChallenge('?challenge=abc')).toBeNull()
    expect(parseChallenge('?challenge=0.5')).toBeNull()
    expect(parseChallenge('?challenge=99999999999.5')).toBeNull()
    expect(parseChallenge('?seed=4')).toBeNull()
  })

  it('removes only the challenge parameter', () => {
    expect(withoutChallenge('http://localhost/pofik/?challenge=5.1&debug')).toBe(
      'http://localhost/pofik/?debug=',
    )
  })
})

describe('result line', () => {
  it('shows score, stings and combo, and the streak once it is going', () => {
    expect(resultLine({ score: 31, stings: 0, bestCombo: 5, streak: 1 })).toBe('🪰 31 · 🐝 0 · x5')
    expect(resultLine({ score: 9, stings: 2, bestCombo: 0, streak: 4 })).toBe(
      '🪰 9 · 🐝 2 · x1 · 🔥 4',
    )
  })
})
