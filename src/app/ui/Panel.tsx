import { m } from 'motion/react'
import type { ReactNode } from 'react'
import { bouncy } from '../motion'
import { useT } from '../useT'
import { IconButton } from './Button'
import { CloseIcon } from './icons'

interface PanelProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * Card that drops in from the top, used by the title screen's side screens.
 * The dim fades out towards the bottom so Gulpsalot stays visible underneath.
 */
export function Panel({ title, onClose, children }: PanelProps) {
  const t = useT()
  return (
    <m.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="overlay__dim overlay__dim--soft" onClick={onClose} />
      <m.section
        className="card panel"
        role="dialog"
        aria-label={title}
        initial={{ y: -40, scale: 0.85, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1, transition: bouncy }}
        exit={{ y: -30, scale: 0.92, opacity: 0, transition: { duration: 0.18 } }}
      >
        <header className="panel__head">
          <h2 className="card__title">{title}</h2>
          <IconButton label={t('common.close')} sound="back" onPress={onClose}>
            <CloseIcon />
          </IconButton>
        </header>
        {children}
      </m.section>
    </m.div>
  )
}
