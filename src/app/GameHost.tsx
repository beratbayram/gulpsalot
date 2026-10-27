import { useEffect, useRef, useState, type ReactNode } from 'react'
import { audio, buzz, sfx } from '../audio'
import { Game } from '../game/Game'
import { setLang } from '../i18n'
import { haptics } from '../platform/haptics'
import { landscapePhoneQuery, prefersReducedMotion, watchVisibility } from '../platform/lifecycle'
import { monetization } from '../platform/monetization'
import * as actions from './actions'
import { GameContext } from './gameContext'
import { setHud } from './hudStore'
import { useAppStore } from './store'

function readOptions() {
  const params = new URLSearchParams(window.location.search)
  return {
    debug: params.has('debug'),
    timeScale: Number(params.get('slow')) || 1,
    seed: params.has('seed') ? Number(params.get('seed')) || 0 : null,
    startTime: Math.max(0, Number(params.get('time')) || 0),
  }
}

/** Mounts the Pixi game once and wires it to the stores, audio and lifecycle. */
export function GameHost({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [game, setGame] = useState<Game | null>(null)
  const settings = useAppStore((s) => s.settings)
  const look = useAppStore((s) => s.look)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let instance: Game | null = null
    const options = readOptions()

    void Game.create(host, {
      sound: sfx,
      buzz,
      haptics,
      hud: setHud,
      hints: {
        isDone: (kind) => useAppStore.getState().hints[kind],
        markDone: (kind) => useAppStore.getState().markHint(kind),
      },
      achievements: {
        has: (id) => useAppStore.getState().achievements.includes(id),
        unlock: (id) => useAppStore.getState().unlockAchievement(id),
      },
      reducedMotion: prefersReducedMotion(),
      ...options,
    }).then((g) => {
      if (cancelled) {
        g.destroy()
        return
      }
      instance = g
      setGame(g)
      if (import.meta.env.DEV || options.debug) window.__pofik = g
      useAppStore.getState().setScreen('title')
    })

    return () => {
      cancelled = true
      instance?.destroy()
      setGame(null)
    }
  }, [])

  useEffect(() => {
    audio.setMuted(!settings.sound)
    haptics.setEnabled(settings.haptics)
    setLang(settings.lang)
  }, [settings])

  useEffect(() => {
    game?.setLook(look)
  }, [game, look])

  useEffect(() => {
    if (!game) return
    const offOver = game.events.on('runOver', ({ score, cause, canContinue }) => {
      const store = useAppStore.getState()
      store.recordRun(score, cause, canContinue)
      monetization.gameplayStop()
      store.setScreen('over')
    })

    const pauseIfPlaying = () => {
      if (useAppStore.getState().screen === 'playing') actions.pause(game)
    }
    const offVisibility = watchVisibility(
      () => {
        pauseIfPlaying()
        buzz.silence()
        audio.suspend()
      },
      () => audio.resume(),
    )
    const landscape = window.matchMedia(landscapePhoneQuery)
    const onRotate = () => landscape.matches && pauseIfPlaying()
    landscape.addEventListener('change', onRotate)

    return () => {
      offOver()
      offVisibility()
      landscape.removeEventListener('change', onRotate)
    }
  }, [game])

  return (
    <GameContext.Provider value={game}>
      <div ref={hostRef} className="game-host" />
      {children}
    </GameContext.Provider>
  )
}
