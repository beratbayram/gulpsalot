import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, isAchievementId } from './achievements'
import { DEFAULT_LOOK, HATS, SKINS, isUnlocked, newUnlocks, sanitizeLook } from './cosmetics'
import { dailyDate, dailyKey, dailySeed } from './daily'

describe('cosmetics', () => {
  it('the defaults are free', () => {
    expect(SKINS.find((s) => s.id === DEFAULT_LOOK.skin)?.unlockAt).toBe(0)
    expect(HATS.find((h) => h.id === DEFAULT_LOOK.hat)?.unlockAt).toBe(0)
  })

  it('lists exactly the items a new best crosses', () => {
    expect(newUnlocks(0, 0)).toEqual([])
    expect(newUnlocks(10, 20)).toEqual([{ type: 'hat', id: 'sprout' }])
    expect(newUnlocks(14, 75)).toEqual([
      { type: 'skin', id: 'sunny' },
      { type: 'skin', id: 'berry' },
      { type: 'hat', id: 'sprout' },
      { type: 'hat', id: 'bow' },
    ])
    // Matching an old best unlocks nothing new.
    expect(newUnlocks(75, 75)).toEqual([])
  })

  it('unlocks at the threshold, not before', () => {
    const sunny = SKINS.find((s) => s.id === 'sunny')!
    expect(isUnlocked(sunny, sunny.unlockAt - 1)).toBe(false)
    expect(isUnlocked(sunny, sunny.unlockAt)).toBe(true)
  })

  it('falls back to defaults for unknown or locked parts of a stored look', () => {
    expect(sanitizeLook(null, 0)).toEqual(DEFAULT_LOOK)
    expect(sanitizeLook({ skin: 'nope', hat: 42 }, 999)).toEqual(DEFAULT_LOOK)
    expect(sanitizeLook({ skin: 'midnight', hat: 'crown' }, 10)).toEqual(DEFAULT_LOOK)
    expect(sanitizeLook({ skin: 'midnight', hat: 'crown' }, 999)).toEqual({
      skin: 'midnight',
      hat: 'crown',
    })
  })
})

describe('daily challenge', () => {
  it('keys days by local date', () => {
    expect(dailyKey(new Date(2026, 9, 26, 23, 59))).toBe('2026-10-26')
    expect(dailyKey(new Date(2026, 0, 3, 0, 1))).toBe('2026-01-03')
  })

  it('round-trips a key to a date', () => {
    expect(dailyKey(dailyDate('2026-10-26'))).toBe('2026-10-26')
  })

  it('gives everyone the same seed on a day and a new one the next', () => {
    expect(dailySeed('2026-10-26')).toBe(dailySeed('2026-10-26'))
    expect(dailySeed('2026-10-26')).not.toBe(dailySeed('2026-10-27'))
    expect(Number.isInteger(dailySeed('2026-10-26'))).toBe(true)
    expect(dailySeed('2026-10-26')).toBeGreaterThanOrEqual(0)
  })
})

describe('achievements', () => {
  it('ids are unique and validated', () => {
    expect(new Set(ACHIEVEMENTS).size).toBe(ACHIEVEMENTS.length)
    expect(isAchievementId('golden')).toBe(true)
    expect(isAchievementId('nope')).toBe(false)
  })
})
