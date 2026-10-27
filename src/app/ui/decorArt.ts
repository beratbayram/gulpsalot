import type { DecorId } from '../../game/cosmetics'
import { LanternArt, ReedsArt, SignArt } from './icons'

export const DECOR_ART: Record<DecorId, typeof ReedsArt> = {
  reeds: ReedsArt,
  lantern: LanternArt,
  sign: SignArt,
}
