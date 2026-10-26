export type RewardedPlacement = 'continue'
export type InterstitialPlacement = 'run-end'
export type RewardResult = 'rewarded' | 'skipped' | 'unavailable'

/**
 * Everything the game needs from an ads / in-app purchase provider.
 * The web build ships with a no-op provider; native builds can implement
 * this with an ad SDK and the store's billing API.
 */
export interface Monetization {
  readonly name: string
  init(): Promise<void>
  /** Gameplay lifecycle, used by ad SDKs to avoid interrupting play. */
  gameplayStart(): void
  gameplayStop(): void
  canShowRewarded(placement: RewardedPlacement): boolean
  showRewarded(placement: RewardedPlacement): Promise<RewardResult>
  /** Shows an interstitial only when the frequency cap allows it. */
  maybeInterstitial(placement: InterstitialPlacement): Promise<void>
  hasRemoveAds(): boolean
  purchaseRemoveAds(): Promise<boolean>
}
