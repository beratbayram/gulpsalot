import type { Game } from '../game/Game'
import { dailyKey, dailySeed } from '../game/daily'
import { monetization } from '../platform/monetization'
import { useAppStore, type RunMode, type Screen } from './store'

const setScreen = (screen: Screen) => useAppStore.getState().setScreen(screen)

export function play(game: Game, mode: RunMode = 'normal') {
  const day = mode === 'daily' ? dailyKey() : null
  useAppStore.getState().startRun({ mode, day })
  // Daily runs are the same for everyone, so no ad-powered second chance.
  game.startRun(day ? { seed: dailySeed(day), canContinue: false } : {})
  monetization.gameplayStart()
  setScreen('playing')
}

/** Starts a new run in the same mode as the last one. */
export function restart(game: Game) {
  play(game, useAppStore.getState().run.mode)
}

export function pause(game: Game) {
  game.pause()
  monetization.gameplayStop()
  setScreen('paused')
}

export function resume(game: Game) {
  game.resume()
  monetization.gameplayStart()
  setScreen('playing')
}

export function home(game: Game) {
  game.toTitle()
  monetization.gameplayStop()
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
  monetization.gameplayStart()
  setScreen('playing')
  return true
}
