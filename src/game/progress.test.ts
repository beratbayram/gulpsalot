import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, isAchievementId } from './achievements'
import {
  DEFAULT_LOOK,
  HATS,
  SKINS,
  isUnlocked,
  newUnlocks,
  sanitizeDecor,
  sanitizeLook,
  secretUnlock,
} from './cosmetics'
import {
  NO_STREAK,
  currentStreak,
  dailyDate,
  dailyKey,
  dailySeed,
  nextReminder,
  nextStreak,
  previousDay,
  sanitizeStreak,
} from './daily'
import {
  MISSIONS,
  advanceMissions,
  initialMissions,
  missionTarget,
  sanitizeMissions,
} from './missions'
import { emptyStats, recordStats, sanitizeStats } from './progress'

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

describe('secret looks', () => {
  it('stay locked whatever the best score, until their secret is found', () => {
    const golden = SKINS.find((s) => s.id === 'golden')!
    expect(isUnlocked(golden, 99_999)).toBe(false)
    expect(isUnlocked(golden, 0, ['flawless'])).toBe(true)
    expect(newUnlocks(0, 99_999).some((u) => u.id === 'golden' || u.id === 'nightcap')).toBe(false)
  })

  it('each secret unlocks exactly one look', () => {
    expect(secretUnlock('flawless')).toEqual({ type: 'skin', id: 'golden' })
    expect(secretUnlock('nightOwl')).toEqual({ type: 'hat', id: 'nightcap' })
    expect(secretUnlock('ticklish')).toEqual({ type: 'hat', id: 'feather' })
  })

  it('a stored secret look needs its secret', () => {
    expect(sanitizeLook({ skin: 'golden', hat: 'feather' }, 999).skin).toBe('classic')
    expect(sanitizeLook({ skin: 'golden', hat: 'feather' }, 0, ['flawless', 'ticklish'])).toEqual({
      skin: 'golden',
      hat: 'feather',
    })
  })
})

describe('decorations', () => {
  it('keeps only known decorations that are unlocked', () => {
    expect(sanitizeDecor(['reeds', 'lantern', 'nope'], 3)).toEqual(['reeds'])
    expect(sanitizeDecor('broken', 100)).toEqual([])
  })
})

describe('missions', () => {
  it('starts with the first three and replaces a finished one with the next', () => {
    const start = initialMissions()
    expect(start.active.map((m) => m.index)).toEqual([0, 1, 2])
    const flies = missionTarget(0)
    const { state, completed } = advanceMissions(
      start,
      { type: 'catch', kinds: Array(flies).fill('fly'), combo: 1, night: false, score: 5 },
      'classic',
    )
    expect(completed.map((m) => m.index)).toEqual([0])
    expect(state.active.map((m) => m.index)).toEqual([3, 1, 2])
    expect(state.next).toBe(4)
  })

  it('reach goals keep the best value, counting goals add up', () => {
    const start = initialMissions()
    const catchEvent = (score: number) =>
      ({ type: 'catch', kinds: ['fly'], combo: 1, night: false, score }) as const
    let state = advanceMissions(start, catchEvent(12), 'classic').state
    state = advanceMissions(state, catchEvent(4), 'classic').state
    expect(state.active[1].progress).toBe(12)
    expect(state.active[0].progress).toBe(2)
  })

  it('nothing counts in the zen pond, and score goals skip Rush', () => {
    const e = { type: 'catch', kinds: ['fly'], combo: 1, night: false, score: 99 } as const
    expect(advanceMissions(initialMissions(), e, 'zen').state).toEqual(initialMissions())
    expect(advanceMissions(initialMissions(), e, 'rush').state.active[1].progress).toBe(0)
  })

  it('repeats with bigger targets, except combos', () => {
    expect(missionTarget(MISSIONS.length)).toBe(missionTarget(0) * 2)
    const combo = MISSIONS.findIndex((m) => m.goal.type === 'combo')
    expect(missionTarget(combo + MISSIONS.length)).toBe(missionTarget(combo))
  })

  it('falls back to a fresh start for broken stored data', () => {
    expect(sanitizeMissions({ next: 'x' })).toEqual(initialMissions())
    expect(sanitizeMissions(null)).toEqual(initialMissions())
  })
})

describe('stats', () => {
  it('counts catches by kind and remembers the best combo', () => {
    let stats = emptyStats()
    stats = recordStats(stats, {
      type: 'catch',
      kinds: ['fly', 'fly', 'moth'],
      combo: 3,
      night: true,
      score: 4,
    })
    stats = recordStats(stats, { type: 'catch', kinds: ['fly'], combo: 2, night: true, score: 5 })
    expect(stats.caught.fly).toBe(3)
    expect(stats.caught.moth).toBe(1)
    expect(stats.bestCombo).toBe(3)
  })

  it('tracks stings, play time and runs', () => {
    let stats = emptyStats()
    stats = recordStats(stats, { type: 'start' })
    stats = recordStats(stats, { type: 'tick', runTime: 1 })
    stats = recordStats(stats, { type: 'sting', by: 'wasp' })
    expect(stats).toMatchObject({ runs: 1, playSeconds: 1 })
    expect(stats.stings.wasp).toBe(1)
  })

  it('cleans up stored stats', () => {
    const stats = sanitizeStats({ runs: -3, caught: { fly: 4.7, nope: 2 }, burps: 'x' })
    expect(stats.runs).toBe(0)
    expect(stats.caught.fly).toBe(4)
    expect(stats.burps).toBe(0)
    expect('nope' in stats.caught).toBe(false)
  })
})

describe('daily streak', () => {
  it('counts days in a row and starts over after a gap', () => {
    let s = nextStreak(NO_STREAK, '2026-10-25')
    s = nextStreak(s, '2026-10-26')
    s = nextStreak(s, '2026-10-26')
    expect(s).toEqual({ last: '2026-10-26', count: 2, best: 2 })
    s = nextStreak(s, '2026-10-29')
    expect(s).toEqual({ last: '2026-10-29', count: 1, best: 2 })
  })

  it('crosses month and year boundaries', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28')
    expect(previousDay('2027-01-01')).toBe('2026-12-31')
  })

  it('is still alive the day after, and broken after that', () => {
    const s = { last: '2026-10-26', count: 5, best: 5 }
    expect(currentStreak(s, '2026-10-26')).toBe(5)
    expect(currentStreak(s, '2026-10-27')).toBe(5)
    expect(currentStreak(s, '2026-10-28')).toBe(0)
  })

  it('cleans up stored streaks', () => {
    expect(sanitizeStreak({ last: 'nope', count: 3 })).toEqual(NO_STREAK)
    expect(sanitizeStreak({ last: '2026-10-26', count: 2.5, best: -1 })).toEqual({
      last: '2026-10-26',
      count: 2,
      best: 0,
    })
  })
})

describe('daily reminder', () => {
  it('goes off tomorrow at the reminder hour, across month ends', () => {
    expect(nextReminder(new Date(2026, 9, 27, 9, 30), 18)).toEqual(new Date(2026, 9, 28, 18))
    expect(nextReminder(new Date(2026, 11, 31, 23), 18)).toEqual(new Date(2027, 0, 1, 18))
  })
})
