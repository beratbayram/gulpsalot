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

export const CalendarIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
    <path d="M4 10.5h16M8.5 3.5v4M15.5 3.5v4" />
    <circle cx="12" cy="15.2" r="1.6" fill="currentColor" stroke="none" />
  </svg>
)

export const HangerIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M9.8 6.6a2.2 2.2 0 1 1 3.3 1.9c-.8.5-1.1.9-1.1 1.6v.6" />
    <path d="M12 10.7 3.7 16.4c-.9.6-.5 1.9.6 1.9h15.4c1.1 0 1.5-1.3.6-1.9z" />
  </svg>
)

export const TrophyIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M8 4.5h8v5a4 4 0 0 1-8 0z" fill="currentColor" />
    <path d="M8 6.5H5.5a2.6 2.6 0 0 0 2.8 3.6M16 6.5h2.5a2.6 2.6 0 0 1-2.8 3.6" />
    <path d="M12 13.6v3.4M8.5 19.5h7M9.8 17h4.4" />
  </svg>
)

export const LockIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2" fill="currentColor" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
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
