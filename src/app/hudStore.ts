import { create } from 'zustand'

interface HudState {
  /** 0..1 */
  hunger: number
  score: number
  critical: boolean
}

/**
 * Written by the game as values change (up to once per frame). The hunger bar
 * subscribes outside React so it animates without re-rendering.
 */
export const useHudStore = create<HudState>()(() => ({ hunger: 1, score: 0, critical: false }))

export const setHud = (hunger: number, score: number, critical: boolean) =>
  useHudStore.setState({ hunger, score, critical })
