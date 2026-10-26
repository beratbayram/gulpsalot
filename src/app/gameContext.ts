import { createContext, useContext } from 'react'
import type { Game } from '../game/Game'

export const GameContext = createContext<Game | null>(null)

/** The running game, or null while it boots. */
export const useGame = () => useContext(GameContext)
