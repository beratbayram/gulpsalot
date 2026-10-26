import { storage } from '../storage'
import { createFrequencyCap } from './frequencyCap'
import type { Monetization } from './types'

export type MockAdKind = 'rewarded' | 'interstitial'
/** Resolves true when the fake ad was watched to the end. */
export type MockAdPresenter = (kind: MockAdKind) => Promise<boolean>

let presenter: MockAdPresenter | null = null

/** The React overlay registers itself here so the mock can show fake ads. */
export function setMockAdPresenter(p: MockAdPresenter) {
  presenter = p
  return () => {
    if (presenter === p) presenter = null
  }
}

/** Development provider: fake ads with the real flow, for testing hook points. */
export function createMockProvider(): Monetization {
  const cap = createFrequencyCap({ everyRuns: 3, minGapMs: 45_000 })
  return {
    name: 'mock',
    init: async () => {},
    gameplayStart: () => {},
    gameplayStop: () => {},
    canShowRewarded: () => presenter !== null,
    async showRewarded() {
      if (!presenter) return 'unavailable'
      return (await presenter('rewarded')) ? 'rewarded' : 'skipped'
    },
    async maybeInterstitial() {
      cap.recordRun()
      if (storage.get('removeAds', false) || !presenter || !cap.shouldShow()) return
      cap.markShown()
      await presenter('interstitial')
    },
    hasRemoveAds: () => storage.get('removeAds', false),
    async purchaseRemoveAds() {
      storage.set('removeAds', true)
      return true
    },
  }
}
