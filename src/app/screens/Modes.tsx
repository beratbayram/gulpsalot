import type { ReactNode } from 'react'
import type { PlayMode } from '../../game/modes'
import * as actions from '../actions'
import { useGame } from '../gameContext'
import { useAppStore } from '../store'
import { useT } from '../useT'
import { Button } from '../ui/Button'
import { LotusIcon, PlayIcon, TargetIcon, TimerIcon } from '../ui/icons'
import { Panel } from '../ui/Panel'

const EXTRA_MODES: { mode: Exclude<PlayMode, 'classic'>; icon: ReactNode }[] = [
  { mode: 'zen', icon: <LotusIcon /> },
  { mode: 'rush', icon: <TimerIcon /> },
  { mode: 'sharp', icon: <TargetIcon /> },
]

/** Zen pond, Rush and Sharpshooter, each with its best score. */
export function Modes() {
  const game = useGame()
  const t = useT()
  const modeBest = useAppStore((s) => s.modeBest)
  const close = () => useAppStore.getState().setScreen('title')

  return (
    <Panel title={t('modes.title')} onClose={close}>
      <ul className="panel__scroll modes">
        {EXTRA_MODES.map(({ mode, icon }) => {
          const best = mode === 'zen' ? 0 : modeBest[mode]
          return (
            <li key={mode} className={`mode-card mode-card--${mode}`}>
              <span className="mode-card__icon">{icon}</span>
              <span className="mode-card__text">
                <strong>{t(`mode.${mode}.name`)}</strong>
                <small>{t(`mode.${mode}.desc`)}</small>
                {best > 0 && <em>{t('over.best', { n: best })}</em>}
              </span>
              <Button
                icon={<PlayIcon />}
                onPress={() => game && actions.play(game, mode)}
                variant={mode === 'zen' ? 'green' : 'primary'}
              >
                {t('title.play')}
              </Button>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
