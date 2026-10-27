/** Pofik's skins and hats, and the best score each one unlocks at. */

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
] as const satisfies readonly { id: string; unlockAt: number; colors: SkinColors }[]

export const HATS = [
  { id: 'none', unlockAt: 0 },
  { id: 'sprout', unlockAt: 15 },
  { id: 'bow', unlockAt: 50 },
  { id: 'party', unlockAt: 100 },
  { id: 'crown', unlockAt: 200 },
] as const

export type SkinId = (typeof SKINS)[number]['id']
export type HatId = (typeof HATS)[number]['id']

export interface Look {
  skin: SkinId
  hat: HatId
}

export const DEFAULT_LOOK: Look = { skin: 'classic', hat: 'none' }

export type Unlock = { type: 'skin'; id: SkinId } | { type: 'hat'; id: HatId }

export const isUnlocked = (item: { unlockAt: number }, best: number) => best >= item.unlockAt

export function skinColors(id: SkinId): SkinColors {
  return (SKINS.find((s) => s.id === id) ?? SKINS[0]).colors
}

/** Items whose threshold was crossed when the best score went from `before` to `after`. */
export function newUnlocks(before: number, after: number): Unlock[] {
  const crossed = (unlockAt: number) => unlockAt > before && unlockAt <= after
  return [
    ...SKINS.filter((s) => crossed(s.unlockAt)).map((s) => ({ type: 'skin', id: s.id }) as const),
    ...HATS.filter((h) => crossed(h.unlockAt)).map((h) => ({ type: 'hat', id: h.id }) as const),
  ]
}

/** A stored look, with unknown or still-locked parts replaced by the defaults. */
export function sanitizeLook(value: unknown, best: number): Look {
  const raw = (value ?? {}) as Partial<Record<keyof Look, unknown>>
  const skin = SKINS.find((s) => s.id === raw.skin && isUnlocked(s, best))
  const hat = HATS.find((h) => h.id === raw.hat && isUnlocked(h, best))
  return { skin: skin?.id ?? DEFAULT_LOOK.skin, hat: hat?.id ?? DEFAULT_LOOK.hat }
}
