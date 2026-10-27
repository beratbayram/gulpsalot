import { m } from 'motion/react'
import * as actions from '../actions'
import { useGame } from '../gameContext'
import { springy } from '../motion'
import { useT } from '../useT'
import { IconButton } from '../ui/Button'
import { ComboBadge } from '../ui/ComboBadge'
import { HungerBar } from '../ui/HungerBar'
import { PauseIcon } from '../ui/icons'
import { ScoreCounter } from '../ui/ScoreCounter'

export function Hud() {
  const game = useGame()
  const t = useT()
  return (
    <m.header
      className="hud"
      initial={{ y: -90, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { ...springy, delay: 0.15 } }}
      exit={{ y: -90, opacity: 0, transition: { duration: 0.2 } }}
    >
      <HungerBar />
      <div className="hud__right">
        <div className="hud__score">
          <ScoreCounter />
          <ComboBadge />
        </div>
        <IconButton label={t('hud.pause')} onPress={() => game && actions.pause(game)}>
          <PauseIcon />
        </IconButton>
      </div>
    </m.header>
  )
}
