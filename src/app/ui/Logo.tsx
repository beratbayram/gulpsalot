import { m, type Variants } from 'motion/react'

const LETTERS = ['P', 'o', 'f', 'i', 'k']

const letter: Variants = {
  hidden: { y: 28, opacity: 0, filter: 'blur(8px)' },
  show: (i: number) => ({
    y: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 160, damping: 20, delay: 0.1 + i * 0.06 },
  }),
  exit: (i: number) => ({
    y: -20,
    opacity: 0,
    filter: 'blur(6px)',
    transition: { duration: 0.25, delay: i * 0.03, ease: 'easeIn' },
  }),
}

export function Logo() {
  return (
    <h1 className="logo" aria-label="Pofik">
      {LETTERS.map((ch, i) => (
        <m.span key={i} className="logo__letter" custom={i} variants={letter} aria-hidden>
          {ch}
        </m.span>
      ))}
    </h1>
  )
}
