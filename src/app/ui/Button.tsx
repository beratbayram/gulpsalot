import { m } from 'motion/react'
import type { ReactNode } from 'react'
import { sfx } from '../../audio'
import { haptics } from '../../platform/haptics'

const press = { type: 'spring', stiffness: 700, damping: 18 } as const

interface ButtonProps {
  children: ReactNode
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'green'
  size?: 'md' | 'lg'
  icon?: ReactNode
  badge?: ReactNode
  disabled?: boolean
  /** Sound on press. 'back' is lower, for leaving a screen. */
  sound?: 'tap' | 'back'
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  badge,
  disabled,
  sound = 'tap',
}: ButtonProps) {
  return (
    <m.button
      type="button"
      className={`btn btn--${variant} btn--${size}`}
      disabled={disabled}
      whileTap={{ scale: 0.94, y: 4 }}
      transition={press}
      onPointerDown={() => {
        if (disabled) return
        if (sound === 'back') sfx.uiBack()
        else sfx.uiTap()
        haptics.tap()
      }}
      onClick={onPress}
    >
      {icon && <span className="btn__icon">{icon}</span>}
      <span>{children}</span>
      {badge && <span className="btn__badge">{badge}</span>}
    </m.button>
  )
}

interface IconButtonProps {
  label: string
  onPress: () => void
  children: ReactNode
  pressed?: boolean
  sound?: 'tap' | 'back' | 'none'
}

export function IconButton({ label, onPress, children, pressed, sound = 'tap' }: IconButtonProps) {
  return (
    <m.button
      type="button"
      className="icon-btn"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      whileTap={{ scale: 0.88, y: 3 }}
      transition={press}
      onPointerDown={() => {
        if (sound === 'tap') sfx.uiTap()
        else if (sound === 'back') sfx.uiBack()
        haptics.tap()
      }}
      onClick={onPress}
    >
      {children}
    </m.button>
  )
}
