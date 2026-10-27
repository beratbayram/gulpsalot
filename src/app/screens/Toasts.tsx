import { AnimatePresence, m } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { sfx } from '../../audio'
import { haptics } from '../../platform/haptics'
import { missionText } from '../missionText'
import { bouncy } from '../motion'
import { useAppStore, type Toast } from '../store'
import { useT } from '../useT'
import { FlagIcon, SparkleIcon, TrophyIcon } from '../ui/icons'
import { DECOR_ART } from '../ui/decorArt'

const SHOW_MS = 2800
/** Guards against StrictMode running the effect twice for the same toast. */
let lastAnnounced = 0

/**
 * Popups for achievements, missions, secret looks and decorations, one at a
 * time. Below the HUD during a run; at the bottom on other screens, where the
 * top is taken by cards.
 */
export function Toasts() {
  const toast = useAppStore((s) => s.toasts[0])
  const dismiss = useAppStore((s) => s.dismissToast)
  const top = useAppStore((s) => s.screen === 'playing' || s.screen === 'paused')
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
          className={`${top ? 'toast' : 'toast toast--bottom'} toast--${toast.type}`}
          role="status"
          initial={{ y: from, scale: 0.7, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1, transition: bouncy }}
          exit={{ y: from * 0.7, opacity: 0, transition: { duration: 0.2 } }}
          onClick={() => dismiss(toast.id)}
        >
          <ToastBody toast={toast} />
        </m.div>
      )}
    </AnimatePresence>
  )
}

function ToastBody({ toast }: { toast: Toast }) {
  const t = useT()
  let icon: ReactNode
  let label: string
  let title: string
  switch (toast.type) {
    case 'achievement':
      icon = <TrophyIcon />
      label = t('achievements.toast')
      title = t(`ach.${toast.achievement}.title`)
      break
    case 'mission':
      icon = <FlagIcon />
      label = t('toast.mission')
      title = missionText(t, toast.mission)
      break
    case 'secret':
      icon = <SparkleIcon />
      label = t('toast.secret')
      title =
        toast.unlock.type === 'skin' ? t(`skin.${toast.unlock.id}`) : t(`hat.${toast.unlock.id}`)
      break
    case 'decor': {
      const Art = DECOR_ART[toast.decor]
      icon = <Art />
      label = t('toast.decor')
      title = t(`decor.${toast.decor}`)
    }
  }
  return (
    <>
      <span className="toast__icon">{icon}</span>
      <span className="toast__text">
        <small>{label}</small>
        <strong>{title}</strong>
      </span>
    </>
  )
}
