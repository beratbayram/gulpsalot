/**
 * Gulpsalot's skins and hats, and the best score each one unlocks at. Secret looks
 * unlock by doing something odd instead (see `SecretId`). Also the pond
 * decorations, unlocked by finishing missions.
 */

/** Odd things that unlock secret looks. */
export type SecretId = 'nightOwl' | 'ticklish' | 'flawless'

export const SECRETS: readonly SecretId[] = ['nightOwl', 'ticklish', 'flawless']

export const isSecretId = (value: unknown): value is SecretId =>
  (SECRETS as readonly unknown[]).includes(value)

/** Boops (tickles) over all runs for the ticklish secret. */
export const TICKLES_FOR_SECRET = 50
/** Catches in one run, all without a miss, for the flawless secret. */
export const FLAWLESS_CATCHES = 20

export interface SkinColors {
  body: number
  bodyLight: number
  bodyShade: number
  bodySpot: number
  belly: number
}

export const SKINS = [
  {
    id: 'classic',
    unlockAt: 0,
    colors: {
      body: 0x8bd65a,
      bodyLight: 0xb4ec8a,
      bodyShade: 0x6cbd45,
      bodySpot: 0x76c04c,
      belly: 0xe6f7b8,
    },
  },
  {
    id: 'sunny',
    unlockAt: 30,
    colors: {
      body: 0xffcd4a,
      bodyLight: 0xffe58f,
      bodyShade: 0xf0a52c,
      bodySpot: 0xf3b437,
      belly: 0xfff4c8,
    },
  },
  {
    id: 'berry',
    unlockAt: 75,
    colors: {
      body: 0xf28bbb,
      bodyLight: 0xffb8d8,
      bodyShade: 0xd9669d,
      bodySpot: 0xe377ab,
      belly: 0xffe3ef,
    },
  },
  {
    id: 'ocean',
    unlockAt: 150,
    colors: {
      body: 0x62b6ee,
      bodyLight: 0x97d4fb,
      bodyShade: 0x4093d0,
      bodySpot: 0x4fa3df,
      belly: 0xdff2ff,
    },
  },
  {
    id: 'midnight',
    unlockAt: 300,
    colors: {
      body: 0x8d75da,
      bodyLight: 0xb7a5f2,
      bodyShade: 0x6b53bd,
      bodySpot: 0x7b63cc,
      belly: 0xe9e2ff,
    },
  },
  {
    id: 'golden',
    unlockAt: 0,
    secret: 'flawless',
    colors: {
      body: 0xf5c542,
      bodyLight: 0xffe58a,
      bodyShade: 0xd99a1e,
      bodySpot: 0xe8ad2c,
      belly: 0xfff3c4,
    },
  },
] as const satisfies readonly {
  id: string
  unlockAt: number
  secret?: SecretId
  colors: SkinColors
}[]

export const HATS = [
  { id: 'none', unlockAt: 0 },
  { id: 'sprout', unlockAt: 15 },
  { id: 'bow', unlockAt: 50 },
  { id: 'party', unlockAt: 100 },
  { id: 'crown', unlockAt: 200 },
  { id: 'nightcap', unlockAt: 0, secret: 'nightOwl' },
  { id: 'feather', unlockAt: 0, secret: 'ticklish' },
] as const satisfies readonly { id: string; unlockAt: number; secret?: SecretId }[]

export type SkinId = (typeof SKINS)[number]['id']
export type HatId = (typeof HATS)[number]['id']

export interface Look {
  skin: SkinId
  hat: HatId
}

export const DEFAULT_LOOK: Look = { skin: 'classic', hat: 'none' }

export type Unlock = { type: 'skin'; id: SkinId } | { type: 'hat'; id: HatId }

interface Unlockable {
  unlockAt: number
  secret?: SecretId
}

export const isUnlocked = (item: Unlockable, best: number, secrets: readonly SecretId[] = []) =>
  item.secret ? secrets.includes(item.secret) : best >= item.unlockAt

/** The secret behind a look, if it has one. */
export const secretOf = (item: Unlockable) => item.secret ?? null

export function skinColors(id: SkinId): SkinColors {
  return (SKINS.find((s) => s.id === id) ?? SKINS[0]).colors
}

/** Items whose threshold was crossed when the best score went from `before` to `after`. */
export function newUnlocks(before: number, after: number): Unlock[] {
  const crossed = (item: Unlockable) =>
    !item.secret && item.unlockAt > before && item.unlockAt <= after
  return [
    ...SKINS.filter(crossed).map((s) => ({ type: 'skin', id: s.id }) as const),
    ...HATS.filter(crossed).map((h) => ({ type: 'hat', id: h.id }) as const),
  ]
}

/** The look a secret unlocks. */
export function secretUnlock(secret: SecretId): Unlock {
  const skin = SKINS.find((s) => secretOf(s) === secret)
  if (skin) return { type: 'skin', id: skin.id }
  const hat = HATS.find((h) => secretOf(h) === secret)!
  return { type: 'hat', id: hat.id }
}

/** A stored look, with unknown or still-locked parts replaced by the defaults. */
export function sanitizeLook(
  value: unknown,
  best: number,
  secrets: readonly SecretId[] = [],
): Look {
  const raw = (value ?? {}) as Partial<Record<keyof Look, unknown>>
  const skin = SKINS.find((s) => s.id === raw.skin && isUnlocked(s, best, secrets))
  const hat = HATS.find((h) => h.id === raw.hat && isUnlocked(h, best, secrets))
  return { skin: skin?.id ?? DEFAULT_LOOK.skin, hat: hat?.id ?? DEFAULT_LOOK.hat }
}

/** Pond decorations and how many finished missions each one needs. */
export const DECOR = [
  { id: 'reeds', missions: 3 },
  { id: 'lantern', missions: 6 },
  { id: 'sign', missions: 10 },
] as const

export type DecorId = (typeof DECOR)[number]['id']

export const isDecorUnlocked = (item: { missions: number }, missionsDone: number) =>
  missionsDone >= item.missions

/** Stored decorations, keeping only known and unlocked ones. */
export function sanitizeDecor(value: unknown, missionsDone: number): DecorId[] {
  const list = Array.isArray(value) ? value : []
  return DECOR.filter((d) => list.includes(d.id) && isDecorUnlocked(d, missionsDone)).map(
    (d) => d.id,
  )
}
