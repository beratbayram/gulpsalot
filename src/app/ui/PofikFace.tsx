import { useId, type SVGProps } from 'react'

/** Pofik's head, painted to match the realistic in-game frog. Used by the HUD and splash. */
export function PofikFace({
  mood = 'happy',
  ...props
}: SVGProps<SVGSVGElement> & { mood?: 'happy' | 'worried' }) {
  const id = useId().replace(/:/g, '')
  const lid = mood === 'worried' ? 9 : 0
  return (
    <svg viewBox="0 0 120 92" aria-hidden {...props}>
      <defs>
        <radialGradient id={`${id}skin`} cx="0.6" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#b2e26e" />
          <stop offset="0.55" stopColor="#74bb42" />
          <stop offset="1" stopColor="#3f8228" />
        </radialGradient>
        <radialGradient id={`${id}iris`} cx="0.45" cy="0.55" r="0.6">
          <stop offset="0" stopColor="#f0cf6a" />
          <stop offset="0.6" stopColor="#c8902a" />
          <stop offset="1" stopColor="#5a3a12" />
        </radialGradient>
      </defs>
      <path
        d="M10 62 C8 40 22 30 34 28 C30 14 44 6 52 16 C56 12 64 12 68 16 C76 6 90 14 86 28 C98 30 112 40 110 62 C108 82 86 90 60 90 C34 90 12 82 10 62 Z"
        fill={`url(#${id}skin)`}
        stroke="#14240d"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      <g fill="#4c8a2c" opacity="0.5">
        <circle cx="20" cy="66" r="1.6" />
        <circle cx="100" cy="64" r="1.8" />
        <circle cx="62" cy="38" r="1.2" />
        <circle cx="30" cy="44" r="1.3" />
      </g>
      <ellipse cx="60" cy="80" rx="28" ry="9" fill="#f3efcf" opacity="0.6" />
      {[38, 82].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="27" r="14" fill="#1a2a10" />
          <circle cx={cx} cy="27" r="12.5" fill={`url(#${id}iris)`} />
          <ellipse cx={cx} cy="27.5" rx="7.6" ry="6.8" fill="#0b0b08" />
          <ellipse cx={cx + 3.6} cy="23" rx="3.4" ry="2.8" fill="#fff" opacity="0.95" />
          <circle cx={cx - 3.6} cy="31.5" r="1.4" fill="#fff" opacity="0.85" />
          {lid > 0 && <path d={`M${cx - 12} 22 A12 12 0 0 1 ${cx + 12} 22 Z`} fill="#5f9a2f" />}
        </g>
      ))}
      <ellipse cx="26" cy="54" rx="7" ry="3.8" fill="#ff9fb0" opacity="0.45" />
      <ellipse cx="94" cy="54" rx="7" ry="3.8" fill="#ff9fb0" opacity="0.45" />
      <path
        d={mood === 'happy' ? 'M44 54 Q60 63 76 54' : 'M46 58 Q60 55 74 58'}
        fill="none"
        stroke="#24311a"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <ellipse cx="72" cy="38" rx="10" ry="3" fill="#fff" opacity="0.25" />
    </svg>
  )
}
