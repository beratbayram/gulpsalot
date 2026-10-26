import { m, type Variants } from 'motion/react'

const LETTERS = [
  { ch: 'P', color: '#8bd65a' },
  { ch: 'o', color: '#ff7096' },
  { ch: 'f', color: '#ffc93c' },
  { ch: 'i', color: '#5fb4ec' },
  { ch: 'k', color: '#ff9f43' },
]

const letter: Variants = {
  hidden: (i: number) => ({ y: -120, opacity: 0, rotate: i % 2 ? 18 : -18, scale: 0.6 }),
  show: (i: number) => ({
    y: 0,
    opacity: 1,
    rotate: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 420, damping: 13, delay: 0.08 + i * 0.07 },
  }),
  exit: (i: number) => ({
    y: -90,
    opacity: 0,
    transition: { duration: 0.22, delay: i * 0.03, ease: 'easeIn' },
  }),
}

export function Logo() {
  return (
    <h1 className="logo" aria-label="Pofik">
      {LETTERS.map((l, i) => (
        <m.span key={i} className="logo__letter" custom={i} variants={letter} aria-hidden>
          <span style={{ color: l.color, animationDelay: `${0.9 + i * 0.13}s` }}>{l.ch}</span>
        </m.span>
      ))}
    </h1>
  )
}
