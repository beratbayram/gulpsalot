import { useHudStore } from '../hudStore'
import { useT } from '../useT'
import { TimerIcon } from './icons'

/** Rush countdown. Re-renders once per second, not per frame. */
export function RushTimer() {
  const seconds = useHudStore((s) => Math.ceil(s.timeLeft))
  const t = useT()
  return (
    <div
      className={seconds <= 10 ? 'timer is-low' : 'timer'}
      role="timer"
      aria-label={t('hud.time', { n: seconds })}
    >
      <TimerIcon className="timer__icon" />
      <span key={seconds <= 10 ? seconds : 'steady'} className="timer__value">
        {seconds}
      </span>
    </div>
  )
}
