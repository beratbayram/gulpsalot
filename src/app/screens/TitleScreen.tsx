import { m } from 'motion/react'
import * as actions from '../actions'
import { useGame } from '../gameContext'
import { popUp, stagger } from '../motion'
import { useAppStore } from '../store'
import { Button } from '../ui/Button'
import { FlyIcon, PlayIcon } from '../ui/icons'
import { Logo } from '../ui/Logo'
import { SettingsToggles } from '../ui/SettingsToggles'

export function TitleScreen() {
  const game = useGame()
  const best = useAppStore((s) => s.best)
  const updateReady = useAppStore((s) => s.updateReady)
  const applyUpdate = useAppStore((s) => s.applyUpdate)

  return (
    <m.section
      className="screen title-screen"
      variants={stagger()}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <m.div className="corner corner--right" variants={popUp}>
        <SettingsToggles />
      </m.div>

      <Logo />
      <m.p className="tagline" variants={popUp}>
        Catch flies. Never lick a bee.
      </m.p>

      <m.div className="title-actions" variants={popUp}>
        <div className="breathe">
          <Button size="lg" icon={<PlayIcon />} onPress={() => game && actions.play(game)}>
            Play
          </Button>
        </div>
        {best > 0 && (
          <div className="chip">
            <FlyIcon className="chip__icon" />
            Best <strong>{best}</strong>
          </div>
        )}
      </m.div>

      {updateReady && applyUpdate && (
        <m.button type="button" className="update-pill" variants={popUp} onClick={applyUpdate}>
          New version ready. Tap to update
        </m.button>
      )}
    </m.section>
  )
}
