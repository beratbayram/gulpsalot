/** Every achievement, in display order. Titles and descriptions live in the i18n files. */
export const ACHIEVEMENTS = [
  'dodge',
  'streak10',
  'survive2m',
  'golden',
  'dragonfly',
  'firefly',
  'multi3',
  'combo5',
  'score100',
  'daily',
  'boop',
] as const

export type AchievementId = (typeof ACHIEVEMENTS)[number]

export const isAchievementId = (value: unknown): value is AchievementId =>
  (ACHIEVEMENTS as readonly unknown[]).includes(value)
