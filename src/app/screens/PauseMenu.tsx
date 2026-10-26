import { m } from 'motion/react'
import * as actions from '../actions'
import { useGame } from '../gameContext'
import { popUp, stagger } from '../motion'
import { Button } from '../ui/Button'
import { HomeIcon, PlayIcon, RestartIcon } from '../ui/icons'
import { SettingsToggles } from '../ui/SettingsToggles'

export function PauseMenu() {
  const game = useGame()
  return (
    <m.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="overlay__dim" />
      <m.section
        className="sheet"
        role="dialog"
        aria-label="Paused"
        initial={{ y: '115%' }}
        animate={{ y: 0, transition: { type: 'spring', stiffness: 360, damping: 30 } }}
        exit={{ y: '115%', transition: { duration: 0.22, ease: 'easeIn' } }}
      >
        <m.div
          className="sheet__body"
          variants={stagger(0.05, 0.12)}
          initial="hidden"
          animate="show"
        >
          <m.h2 className="sheet__title" variants={popUp}>
            Paused
          </m.h2>
          <m.div variants={popUp}>
            <Button size="lg" icon={<PlayIcon />} onPress={() => game && actions.resume(game)}>
              Resume
            </Button>
          </m.div>
          <m.div className="sheet__row" variants={popUp}>
            <Button
              variant="secondary"
              icon={<RestartIcon />}
              onPress={() => game && actions.play(game)}
            >
              Restart
            </Button>
            <Button
              variant="secondary"
              sound="back"
              icon={<HomeIcon />}
              onPress={() => game && actions.home(game)}
            >
              Home
            </Button>
          </m.div>
          <m.div variants={popUp}>
            <SettingsToggles />
          </m.div>
        </m.div>
      </m.section>
    </m.div>
  )
}
