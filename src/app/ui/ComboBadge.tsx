import { AnimatePresence, m } from 'motion/react'
import { useHudStore } from '../hudStore'
import { bouncy } from '../motion'
import { useT } from '../useT'

/** "x3" sticker under the score while a combo is running. Pops on every level up. */
export function ComboBadge() {
  const combo = useHudStore((s) => s.combo)
  const t = useT()
  return (
    <AnimatePresence>
      {combo > 1 && (
        <m.div
          className={`combo combo--${combo}`}
          role="status"
          aria-label={t('hud.combo', { n: combo })}
          initial={{ scale: 0.3, rotate: -24, opacity: 0 }}
          animate={{ scale: 1, rotate: -7, opacity: 1, transition: bouncy }}
          exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.18 } }}
        >
          <span key={combo} className="combo__value">
            x{combo}
          </span>
        </m.div>
      )}
    </AnimatePresence>
  )
}
