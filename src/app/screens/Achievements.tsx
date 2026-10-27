import { ACHIEVEMENTS } from '../../game/achievements'
import { useAppStore } from '../store'
import { useT } from '../useT'
import { LockIcon, TrophyIcon } from '../ui/icons'
import { Panel } from '../ui/Panel'

export function Achievements() {
  const t = useT()
  const unlocked = useAppStore((s) => s.achievements)
  const close = () => useAppStore.getState().setScreen('title')

  return (
    <Panel title={t('achievements.title')} onClose={close}>
      <p className="panel__sub">
        {t('achievements.progress', { n: unlocked.length, total: ACHIEVEMENTS.length })}
      </p>
      <ul className="panel__scroll achievements">
        {ACHIEVEMENTS.map((id) => {
          const done = unlocked.includes(id)
          return (
            <li key={id} className={done ? 'achievement is-done' : 'achievement'}>
              <span className="achievement__icon">{done ? <TrophyIcon /> : <LockIcon />}</span>
              <span className="achievement__text">
                <strong>{t(`ach.${id}.title`)}</strong>
                <small>{t(`ach.${id}.desc`)}</small>
              </span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
