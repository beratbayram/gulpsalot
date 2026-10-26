import type { Game } from '../game/Game'
import { monetization } from '../platform/monetization'
import { useAppStore, type Screen } from './store'

const setScreen = (screen: Screen) => useAppStore.getState().setScreen(screen)

export function play(game: Game) {
  game.startRun()
  monetization.gameplayStart()
  setScreen('playing')
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

export async function playAgain(game: Game) {
  await monetization.maybeInterstitial('run-end')
  play(game)
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
