import { m } from 'motion/react'
import { MODES } from '../../game/modes'
import * as actions from '../actions'
import { useGame } from '../gameContext'
import { springy } from '../motion'
import { playModeOf, useAppStore } from '../store'
import { useT } from '../useT'
import { IconButton } from '../ui/Button'
import { ComboBadge } from '../ui/ComboBadge'
import { Hearts } from '../ui/Hearts'
import { HungerBar } from '../ui/HungerBar'
import { LotusIcon, PauseIcon } from '../ui/icons'
import { PowerBadge } from '../ui/PowerBadge'
import { RushTimer } from '../ui/RushTimer'
import { ScoreCounter } from '../ui/ScoreCounter'

/** Top bar during a run. What it shows depends on the mode's rules. */
export function Hud() {
  const game = useGame()
  const t = useT()
  const mode = useAppStore((s) => playModeOf(s.run.mode))
  const rules = MODES[mode]
  return (
    <m.header
      className="hud"
      initial={{ y: -90, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { ...springy, delay: 0.15 } }}
      exit={{ y: -90, opacity: 0, transition: { duration: 0.2 } }}
    >
      <div className="hud__left">
        {rules.hunger && <HungerBar />}
        {rules.timeLimit !== null && <RushTimer />}
        {mode === 'zen' && (
          <div className="chip chip--zen">
            <LotusIcon className="chip__icon" />
            {t('mode.zen.name')}
          </div>
        )}
        <div className="hud__sub">
          {rules.hearts !== null && <Hearts />}
          {rules.powerUps && <PowerBadge />}
        </div>
      </div>
      <div className="hud__right">
        {rules.score && (
          <div className="hud__score">
            <ScoreCounter />
            <ComboBadge />
          </div>
        )}
        <IconButton label={t('hud.pause')} onPress={() => game && actions.pause(game)}>
          <PauseIcon />
        </IconButton>
      </div>
    </m.header>
  )
}
