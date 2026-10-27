/**
 * The daily challenge is a seeded run. Like most daily puzzles it follows the
 * player's local calendar day, so everyone gets the same run on the same date.
 */

/** `YYYY-MM-DD` for the local date. */
export function dailyKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Stable 32-bit seed for a day (FNV-1a). */
export function dailySeed(key: string) {
  let h = 0x811c9dc5
  for (const ch of `pofik:${key}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** The day as a `Date` at local midnight, for display. */
export function dailyDate(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Days in a row with a finished daily challenge. */
export interface Streak {
  /** The last day a daily was finished (`YYYY-MM-DD`). */
  last: string | null
  count: number
  best: number
}

export const NO_STREAK: Streak = { last: null, count: 0, best: 0 }

/** The day before a day key. */
export function previousDay(key: string) {
  const d = dailyDate(key)
  d.setDate(d.getDate() - 1)
  return dailyKey(d)
}

/** The streak after finishing the daily on `day`. Finishing twice the same day changes nothing. */
export function nextStreak(streak: Streak, day: string): Streak {
  if (streak.last === day) return streak
  const count = streak.last === previousDay(day) ? streak.count + 1 : 1
  return { last: day, count, best: Math.max(streak.best, count) }
}

/** The streak still alive today: finished today or yesterday, otherwise broken (0). */
export function currentStreak(streak: Streak, today: string) {
  return streak.last === today || streak.last === previousDay(today) ? streak.count : 0
}

export function sanitizeStreak(value: unknown): Streak {
  const raw = (value ?? {}) as Partial<Record<keyof Streak, unknown>>
  const n = (v: unknown) => (typeof v === 'number' && v > 0 ? Math.floor(v) : 0)
  const last = typeof raw.last === 'string' && /^\d{4}-\d\d-\d\d$/.test(raw.last) ? raw.last : null
  return last ? { last, count: n(raw.count), best: n(raw.best) } : NO_STREAK
}

/** Hour of the day (local) the daily reminder goes off. */
export const REMINDER_HOUR = 18

/** When to remind about tomorrow's daily: tomorrow at the reminder hour. */
export function nextReminder(now: Date, hour = REMINDER_HOUR) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour)
}
