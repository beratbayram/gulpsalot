import { AnimatePresence, m } from 'motion/react'
import { useEffect, useRef } from 'react'
import { useHudStore } from '../hudStore'
import { bouncy } from '../motion'
import { useT } from '../useT'
import { SnowflakeIcon, StarIcon } from './icons'

/**
 * The active power-up under the hunger bar, with a ring that runs down as it
 * wears off. The ring is written to a CSS variable outside React.
 */
export function PowerBadge() {
  const power = useHudStore((s) => s.power)
  const ref = useRef<HTMLDivElement>(null)
  const t = useT()

  useEffect(() => {
    if (!power) return
    const apply = (left: number) => ref.current?.style.setProperty('--left', left.toFixed(3))
    apply(useHudStore.getState().powerLeft)
    return useHudStore.subscribe((s) => apply(s.powerLeft))
  }, [power])

  return (
    <AnimatePresence>
      {power && (
        <m.div
          key={power}
          ref={ref}
          className={`power power--${power}`}
          role="status"
          aria-label={t(`game.${power}`)}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, transition: bouncy }}
          exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.18 } }}
        >
          <span className="power__icon">
            {power === 'freeze' ? <SnowflakeIcon /> : power === 'double' ? 'x2' : <StarIcon />}
          </span>
        </m.div>
      )}
    </AnimatePresence>
  )
}
