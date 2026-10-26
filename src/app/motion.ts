import type { Transition, Variants } from 'motion/react'

export const springy: Transition = { type: 'spring', stiffness: 380, damping: 22 }
export const bouncy: Transition = { type: 'spring', stiffness: 520, damping: 14 }

/** Parent that staggers its children in and out. */
export const stagger = (inGap = 0.07, delay = 0.1): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: inGap, delayChildren: delay } },
  exit: { transition: { staggerChildren: 0.03, staggerDirection: -1 } },
})

export const popUp: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.9 },
  show: { opacity: 1, y: 0, scale: 1, transition: bouncy },
  exit: { opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.16, ease: 'easeIn' } },
}
