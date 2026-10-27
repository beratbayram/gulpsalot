import { useEffect, useRef } from 'react'
import { useHudStore } from '../hudStore'
import { useT } from '../useT'
import { FlyIcon } from './icons'

export function ScoreCounter() {
  const score = useHudStore((s) => s.score)
  const ref = useRef<HTMLDivElement>(null)
  const t = useT()

  useEffect(() => {
    if (score === 0) return
    ref.current?.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.28) rotate(-4deg)' },
        { transform: 'scale(0.94)' },
        { transform: 'scale(1)' },
      ],
      { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.2)' },
    )
  }, [score])

  return (
    <div ref={ref} className="score" aria-label={t('hud.score', { n: score })}>
      <FlyIcon className="score__icon" />
      <span>{score}</span>
    </div>
  )
}
