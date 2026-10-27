import { MODES } from '../../game/modes'
import { useHudStore } from '../hudStore'
import { useT } from '../useT'
import { HeartIcon } from './icons'

/** Sharpshooter hearts. A lost heart turns grey with a little crack. */
export function Hearts() {
  const hearts = useHudStore((s) => s.hearts)
  const t = useT()
  const total = MODES.sharp.hearts ?? 0
  return (
    <div className="hearts" role="status" aria-label={t('hud.hearts', { n: hearts })}>
      {Array.from({ length: total }, (_, i) => (
        <HeartIcon key={i} className={i < hearts ? 'heart' : 'heart is-lost'} />
      ))}
    </div>
  )
}
