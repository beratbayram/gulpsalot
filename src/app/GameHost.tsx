import { useEffect, useRef, useState, type ReactNode } from 'react'
import { audio, buzz, music, sfx, weather } from '../audio'
import { Game } from '../game/Game'
import { setLang } from '../i18n'
import { dailyKey, nextReminder } from '../game/daily'
import { setDailyBadge } from '../platform/badge'
import { haptics } from '../platform/haptics'
import { landscapePhoneQuery, prefersReducedMotion, watchVisibility } from '../platform/lifecycle'
import { notifications } from '../platform/notifications'
import { wakeLock } from '../platform/wakeLock'
import * as actions from './actions'
import { GameContext } from './gameContext'
import { setHud } from './hudStore'
import { dailyBestFor, useAppStore } from './store'

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
  const decor = useAppStore((s) => s.decor)
  const best = useAppStore((s) => s.best)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let instance: Game | null = null
    const options = readOptions()

    void Game.create(host, {
      sound: sfx,
      buzz,
      ambience: weather,
      music,
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
      progress: { record: (event) => useAppStore.getState().record(event) },
      reducedMotion: prefersReducedMotion(),
      ...options,
    }).then((g) => {
      if (cancelled) {
        g.destroy()
        return
      }
      instance = g
      setGame(g)
      if (import.meta.env.DEV || options.debug) window.__gulpsalot = g
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
    audio.setMusic(settings.music)
    haptics.setEnabled(settings.haptics)
    setLang(settings.lang)
  }, [settings])

  useEffect(() => {
    game?.setLook(look)
  }, [game, look])

  useEffect(() => {
    game?.setContrast(settings.contrast)
  }, [game, settings.contrast])

  useEffect(() => {
    game?.setDecor(decor, best)
  }, [game, decor, best])

  useEffect(() => {
    if (!game) return
    const offOver = game.events.on('runOver', (result) => {
      const store = useAppStore.getState()
      store.recordRun(result)
      actions.gameplayStop()
      if (store.run.mode === 'daily') {
        updateBadge()
        void notifications.scheduleDailyReminder(nextReminder(new Date()))
      }
      store.setScreen('over')
    })

    const pauseIfPlaying = () => {
      if (useAppStore.getState().screen === 'playing') actions.pause(game)
    }
    const offVisibility = watchVisibility(
      () => {
        pauseIfPlaying()
        buzz.silence()
        weather.silence()
        audio.suspend()
        updateBadge()
      },
      () => {
        audio.resume()
        wakeLock.restore()
        updateBadge()
      },
    )
    updateBadge()
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

/** Badge on the installed app's icon while today's daily hasn't been played. */
function updateBadge() {
  setDailyBadge(dailyBestFor(useAppStore.getState().daily, dailyKey()) === 0)
}
