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
