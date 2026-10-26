import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

export const PlayIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </svg>
)

export const PauseIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M8.5 5.5v13M15.5 5.5v13" strokeWidth={3.4} />
  </svg>
)

export const HomeIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4 11.5 12 4.5l8 7" />
    <path d="M6.5 10v9h11v-9" />
    <path d="M10.5 19v-5h3v5" />
  </svg>
)

export const RestartIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M19 12a7 7 0 1 1-2.05-4.95" />
    <path d="M19.5 4.5v4h-4" />
  </svg>
)

export const SoundOnIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z" fill="currentColor" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </svg>
)

export const SoundOffIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z" fill="currentColor" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </svg>
)

export const VibrateIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="8" y="4" width="8" height="16" rx="2" />
    <path d="M4.5 9v6M19.5 9v6" />
  </svg>
)

export const VibrateOffIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="8" y="4" width="8" height="16" rx="2" />
    <path d="M4 4l16 16" />
  </svg>
)

export const AdIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="5.5" width="17" height="12" rx="2.5" />
    <path d="M10.5 9v5l4-2.5z" fill="currentColor" />
    <path d="M9 20.5h6" />
  </svg>
)

export const CloseIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </svg>
)

/** Little cartoon fly used for the score. */
export const FlyIcon = (p: IconProps) => (
  <svg viewBox="0 0 32 32" aria-hidden {...p}>
    <ellipse
      cx="10.5"
      cy="10"
      rx="7"
      ry="4.5"
      fill="#eef8ff"
      stroke="#26313d"
      strokeWidth="1.6"
      transform="rotate(-25 10.5 10)"
    />
    <ellipse
      cx="17"
      cy="8.5"
      rx="7.5"
      ry="4.8"
      fill="#eef8ff"
      stroke="#26313d"
      strokeWidth="1.6"
      transform="rotate(-10 17 8.5)"
    />
    <ellipse cx="13" cy="18" rx="8.5" ry="6.2" fill="#3c4252" stroke="#26313d" strokeWidth="2" />
    <circle cx="22" cy="16.5" r="5" fill="#2c303c" stroke="#26313d" strokeWidth="2" />
    <circle cx="23.6" cy="15.3" r="3" fill="#fff" />
    <circle cx="24.4" cy="15.5" r="1.5" fill="#26313d" />
  </svg>
)

export const PhoneIcon = (p: IconProps) => (
  <svg viewBox="0 0 48 48" aria-hidden {...p}>
    <rect
      x="13"
      y="4"
      width="22"
      height="40"
      rx="5"
      fill="#fff6e0"
      stroke="#26313d"
      strokeWidth="3"
    />
    <path d="M21 9h6" stroke="#26313d" strokeWidth="3" strokeLinecap="round" />
    <circle cx="24" cy="38" r="2" fill="#26313d" />
  </svg>
)
