import type { SVGProps } from 'react'

/** Pofik's face as an SVG, matching the in-game art. Used by the HUD and splash. */
export function PofikFace({
  mood = 'happy',
  ...props
}: SVGProps<SVGSVGElement> & { mood?: 'happy' | 'worried' }) {
  const ink = '#26313d'
  return (
    <svg viewBox="0 0 120 100" aria-hidden {...props}>
      <defs>
        <linearGradient id="pofik-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b4ec8a" />
          <stop offset="0.6" stopColor="#8bd65a" />
          <stop offset="1" stopColor="#6cbd45" />
        </linearGradient>
      </defs>
      <g fill={ink} stroke={ink} strokeWidth="8" strokeLinejoin="round">
        <ellipse cx="60" cy="64" rx="50" ry="31" />
        <circle cx="37" cy="31" r="18" />
        <circle cx="83" cy="31" r="18" />
      </g>
      <g fill="url(#pofik-skin)">
        <ellipse cx="60" cy="64" rx="50" ry="31" />
        <circle cx="37" cy="31" r="18" />
        <circle cx="83" cy="31" r="18" />
      </g>
      <ellipse cx="60" cy="78" rx="30" ry="14" fill="#e6f7b8" />
      <g fill="#fff" stroke={ink} strokeWidth="3">
        <circle cx="37" cy="30" r="12" />
        <circle cx="83" cy="30" r="12" />
      </g>
      <circle cx="39" cy="33" r="5.5" fill={ink} />
      <circle cx="85" cy="33" r="5.5" fill={ink} />
      <circle cx="37" cy="31" r="1.8" fill="#fff" />
      <circle cx="83" cy="31" r="1.8" fill="#fff" />
      {mood === 'worried' && (
        <path d="M44 13 30 9M76 13l14-4" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />
      )}
      <ellipse cx="24" cy="62" rx="7" ry="4" fill="#ff8fa8" opacity="0.6" />
      <ellipse cx="96" cy="62" rx="7" ry="4" fill="#ff8fa8" opacity="0.6" />
      <path
        d={mood === 'happy' ? 'M42 58q18 12 36 0' : 'M44 64q16-8 32 0'}
        fill="none"
        stroke={ink}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
