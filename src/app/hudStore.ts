import { create } from 'zustand'
import type { HudFrame } from '../game/Game'

/**
 * Written by the game as values change (up to once per frame). The hunger bar
 * subscribes outside React so it animates without re-rendering.
 */
export const useHudStore = create<HudFrame>()(() => ({
  hunger: 1,
  score: 0,
  critical: false,
  combo: 1,
  burp: 0,
  power: null,
  powerLeft: 0,
  hearts: 0,
  timeLeft: 0,
}))

export const setHud = (frame: HudFrame) => useHudStore.setState(frame)
