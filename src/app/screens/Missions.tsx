import type { CSSProperties } from 'react'
import { DECOR } from '../../game/cosmetics'
import { missionTarget } from '../../game/missions'
import { missionText } from '../missionText'
import { useAppStore } from '../store'
import { useT } from '../useT'
import { FlagIcon } from '../ui/icons'
import { Panel } from '../ui/Panel'

/** The three active missions, how far along each is, and the next decoration. */
export function Missions() {
  const t = useT()
  const missions = useAppStore((s) => s.missions)
  const done = useAppStore((s) => s.stats.missions)
  const close = () => useAppStore.getState().setScreen('title')
  const nextDecor = DECOR.find((d) => d.missions > done)

  return (
    <Panel title={t('missions.title')} onClose={close}>
      <p className="panel__sub">{t('missions.done', { n: done })}</p>
      <ul className="panel__scroll missions">
        {missions.active.map((slot) => {
          const target = missionTarget(slot.index)
          const progress = Math.min(slot.progress, target)
          return (
            <li key={slot.index} className="mission">
              <span className="mission__icon">
                <FlagIcon />
              </span>
              <span className="mission__text">
                <strong>{missionText(t, slot.index)}</strong>
                <span
                  className="mission__bar"
                  style={{ '--p': progress / target } as CSSProperties}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={target}
                  aria-valuenow={progress}
                />
                <small>
                  {progress} / {target}
                </small>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="panel__foot">
        {nextDecor && <span>{t('missions.next', { n: nextDecor.missions - done })}</span>}
        <span>{t('missions.zen')}</span>
      </p>
    </Panel>
  )
}
