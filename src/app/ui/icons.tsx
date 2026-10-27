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

export const SnowflakeIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
    <path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2" />
  </svg>
)

export const StarIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path
      d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z"
      fill="currentColor"
    />
  </svg>
)

export const TimerIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="13.5" r="7" />
    <path d="M12 13.5V10M10 3.5h4M18 6.5l1.2-1.2" />
  </svg>
)

export const HeartIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path
      d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"
      fill="currentColor"
    />
  </svg>
)

export const LotusIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 18c-3-2-4-5-4-8 2 .5 3.5 2 4 4 .5-2 2-3.5 4-4 0 3-1 6-4 8z" fill="currentColor" />
    <path d="M12 18c-4 0-7-2-8.5-5 2.5-.3 4.5.5 6 2M12 18c4 0 7-2 8.5-5-2.5-.3-4.5.5-6 2" />
    <path d="M12 14c-.8-3 0-6 0-9 0 3 .8 6 0 9z" />
  </svg>
)

export const TargetIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
)

export const ModesIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="4" y="4" width="7" height="7" rx="2" />
    <rect x="13" y="4" width="7" height="7" rx="2" />
    <rect x="4" y="13" width="7" height="7" rx="2" />
    <circle cx="16.5" cy="16.5" r="3.5" />
  </svg>
)

export const FlagIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M6 20.5V4" />
    <path d="M6 4.5h11l-2.5 4 2.5 4H6" fill="currentColor" />
  </svg>
)

export const ChartIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4.5 19.5h15" />
    <path d="M7 16v-5M12 16V6.5M17 16v-8" strokeWidth={3.2} />
  </svg>
)

export const SparkleIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path
      d="M12 3.5c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z"
      fill="currentColor"
    />
  </svg>
)

/** Small drawings of the pond decorations, for the wardrobe tiles and toasts. */
export const ReedsArt = (p: IconProps) => (
  <svg viewBox="0 0 48 48" aria-hidden {...p}>
    <g stroke="#26313d" strokeWidth="2.5" strokeLinecap="round">
      <path d="M16 44c0-12 1-22 4-32M24 44V8M32 44c0-12-1-22-4-30" fill="none" />
    </g>
    <g fill="#8a5a3b" stroke="#26313d" strokeWidth="2">
      <rect x="17.5" y="9" width="6" height="14" rx="3" transform="rotate(8 20 16)" />
      <rect x="25.5" y="11" width="6" height="14" rx="3" transform="rotate(-8 28 18)" />
    </g>
    <path d="M10 44h28" stroke="#3f97ad" strokeWidth="3" strokeLinecap="round" />
  </svg>
)

export const LanternArt = (p: IconProps) => (
  <svg viewBox="0 0 48 48" aria-hidden {...p}>
    <circle cx="28" cy="18" r="13" fill="#ffd77a" opacity="0.45" />
    <path d="M14 44V12M14 13l12-4" stroke="#26313d" strokeWidth="3" strokeLinecap="round" />
    <rect
      x="21"
      y="10"
      width="14"
      height="18"
      rx="4"
      fill="#fff0b0"
      stroke="#26313d"
      strokeWidth="2.5"
    />
    <rect x="23" y="6" width="10" height="5" rx="2" fill="#26313d" />
  </svg>
)

export const SignArt = (p: IconProps) => (
  <svg viewBox="0 0 48 48" aria-hidden {...p}>
    <rect
      x="21.5"
      y="24"
      width="5"
      height="20"
      rx="2.5"
      fill="#8a5a3b"
      stroke="#26313d"
      strokeWidth="2"
    />
    <rect
      x="6"
      y="8"
      width="36"
      height="20"
      rx="5"
      fill="#d9a066"
      stroke="#26313d"
      strokeWidth="2.5"
    />
    <path
      d="m15 13 1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z"
      fill="#ffe066"
      stroke="#26313d"
      strokeWidth="1.2"
    />
    <path d="M25 18h11" stroke="#26313d" strokeWidth="3" strokeLinecap="round" />
  </svg>
)

export const ShareIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 15V4M8 7.5 12 3.5l4 4" />
    <path d="M7 11H5.5v9h13v-9H17" />
  </svg>
)

export const FlameIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path
      d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.5 2.6-5.3 3.6-8.5 1.8 1.3 2.4 3 2.3 4.6 1-.8 1.8-2.1 1.9-3.9 2.6 2 3.2 5 3.2 7.8 0 3.4-2.6 6-4.5 6z"
      fill="currentColor"
    />
  </svg>
)

export const BoltIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M13.5 3 5.5 13.5h6l-1 7.5 8-10.5h-6z" fill="currentColor" />
  </svg>
)

export const ContrastIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
  </svg>
)

export const MusicIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M9 17.5V6l10-2v11.5" />
    <circle cx="6.5" cy="17.5" r="2.5" fill="currentColor" />
    <circle cx="16.5" cy="15.5" r="2.5" fill="currentColor" />
  </svg>
)

export const MusicOffIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M9 17.5V6l10-2v11.5" />
    <circle cx="6.5" cy="17.5" r="2.5" fill="currentColor" />
    <circle cx="16.5" cy="15.5" r="2.5" fill="currentColor" />
    <path d="M4 4l16 16" />
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
