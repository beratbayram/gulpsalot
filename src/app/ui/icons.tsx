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

/** House fly seen from above, for the score. */
export const FlyIcon = (p: IconProps) => (
  <svg viewBox="0 0 32 32" aria-hidden {...p}>
    <path
      d="M15 13 C9 9 3 11 4 15 C5 19 11 18 15 15 Z"
      fill="#dfe8ef"
      fillOpacity="0.55"
      stroke="#fff"
      strokeOpacity="0.6"
      strokeWidth="0.6"
    />
    <path
      d="M17 13 C23 9 29 11 28 15 C27 19 21 18 17 15 Z"
      fill="#dfe8ef"
      fillOpacity="0.55"
      stroke="#fff"
      strokeOpacity="0.6"
      strokeWidth="0.6"
    />
    <ellipse cx="16" cy="19" rx="3.6" ry="6" fill="#2e2e2c" />
    <ellipse cx="16" cy="12.5" rx="3.4" ry="3" fill="#5b5b57" />
    <ellipse cx="14.2" cy="9.6" rx="1.8" ry="1.6" fill="#a3301c" />
    <ellipse cx="17.8" cy="9.6" rx="1.8" ry="1.6" fill="#a3301c" />
    <path d="M14.6 12 V14 M16 11.6 V14 M17.4 12 V14" stroke="#1c1c1a" strokeWidth="0.6" />
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
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    />
    <path d="M21 9h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
)
