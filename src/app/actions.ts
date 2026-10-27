import type { Game } from '../game/Game'
import { dailyKey, dailySeed } from '../game/daily'
import { monetization } from '../platform/monetization'
import { wakeLock } from '../platform/wakeLock'
import { playModeOf, useAppStore, type RunMode, type Screen } from './store'

const setScreen = (screen: Screen) => useAppStore.getState().setScreen(screen)

/** A run is on screen: tell the ad provider and keep the screen awake. */
function gameplayStart() {
  monetization.gameplayStart()
  wakeLock.acquire()
}

export function gameplayStop() {
  monetization.gameplayStop()
  wakeLock.release()
}

export function play(game: Game, mode: RunMode = 'classic') {
  const day = mode === 'daily' ? dailyKey() : null
  // Playing in the small hours unlocks a secret look.
  if (new Date().getHours() < 4) useAppStore.getState().unlockSecret('nightOwl')
  useAppStore.getState().startRun({ mode, day })
  // Daily and challenge runs are the same for everyone, so no ad-powered second chance.
  const challenge = mode === 'challenge' ? useAppStore.getState().challenge : null
  const seed = day ? dailySeed(day) : challenge?.seed
  game.startRun({
    mode: playModeOf(mode),
    ...(seed !== undefined ? { seed, canContinue: false } : {}),
  })
  gameplayStart()
  setScreen('playing')
}

/** Starts a new run in the same mode as the last one. */
export function restart(game: Game) {
  play(game, useAppStore.getState().run.mode)
}

export function pause(game: Game) {
  game.pause()
  gameplayStop()
  setScreen('paused')
}

export function resume(game: Game) {
  game.resume()
  gameplayStart()
  setScreen('playing')
}

export function home(game: Game) {
  game.toTitle()
  gameplayStop()
  setScreen('title')
}

/** Back to the title screen with the wardrobe open, so a new unlock can be tried on. */
export function openWardrobe(game: Game) {
  home(game)
  setScreen('wardrobe')
}

export async function playAgain(game: Game) {
  await monetization.maybeInterstitial('run-end')
  restart(game)
}

/** Shows a rewarded ad; continues the run only if it was watched to the end. */
export async function continueWithAd(game: Game) {
  const result = await monetization.showRewarded('continue')
  if (result !== 'rewarded') return false
  game.continueRun()
  gameplayStart()
  setScreen('playing')
  return true
}
