import { AnimatePresence, m } from 'motion/react'
import { useEffect } from 'react'
import { sfx } from '../../audio'
import { haptics } from '../../platform/haptics'
import { bouncy } from '../motion'
import { useAppStore } from '../store'
import { useT } from '../useT'
import { TrophyIcon } from '../ui/icons'

const SHOW_MS = 2800
/** Guards against StrictMode running the effect twice for the same toast. */
let lastAnnounced = 0

/**
 * Achievement popups, one at a time. Below the HUD during a run; at the
 * bottom on other screens, where the top is taken by cards.
 */
export function Toasts() {
  const toast = useAppStore((s) => s.toasts[0])
  const dismiss = useAppStore((s) => s.dismissToast)
  const top = useAppStore((s) => s.screen === 'playing' || s.screen === 'paused')
  const t = useT()
  const from = top ? -36 : 36

  useEffect(() => {
    if (!toast) return
    if (lastAnnounced !== toast.id) {
      lastAnnounced = toast.id
      sfx.achievement()
      haptics.light()
    }
    const timer = setTimeout(() => dismiss(toast.id), SHOW_MS)
    return () => clearTimeout(timer)
  }, [toast, dismiss])

  return (
    <AnimatePresence>
      {toast && (
        <m.div
          key={toast.id}
          className={top ? 'toast' : 'toast toast--bottom'}
          role="status"
          initial={{ y: from, scale: 0.7, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1, transition: bouncy }}
          exit={{ y: from * 0.7, opacity: 0, transition: { duration: 0.2 } }}
          onClick={() => dismiss(toast.id)}
        >
          <span className="toast__icon">
            <TrophyIcon />
          </span>
          <span className="toast__text">
            <small>{t('achievements.toast')}</small>
            <strong>{t(`ach.${toast.achievement}.title`)}</strong>
          </span>
        </m.div>
      )}
    </AnimatePresence>
  )
}
