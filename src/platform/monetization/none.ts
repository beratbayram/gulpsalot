import type { Monetization } from './types'

/** Web default: no ads, no store. Every hook is a no-op. */
export const noneProvider: Monetization = {
  name: 'none',
  init: async () => {},
  gameplayStart: () => {},
  gameplayStop: () => {},
  canShowRewarded: () => false,
  showRewarded: async () => 'unavailable',
  maybeInterstitial: async () => {},
  hasRemoveAds: () => false,
  purchaseRemoveAds: async () => false,
}
