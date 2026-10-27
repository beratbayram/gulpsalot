import { useId, type SVGProps } from 'react'
import { skinColors, type HatId, type SkinId } from '../../game/cosmetics'
import { HAT_ART, HAT_OUTLINE, type HatShape } from '../../game/draw/hats'

const ink = '#26313d'
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`

interface GulpsalotFaceProps extends SVGProps<SVGSVGElement> {
  mood?: 'happy' | 'worried'
  skin?: SkinId
  /** Draws a hat and leaves room above the head for it. */
  hat?: HatId
}

/** Gulpsalot's face as an SVG, matching the in-game art. Used by the HUD, splash and wardrobe. */
export function GulpsalotFace({
  mood = 'happy',
  skin = 'classic',
  hat,
  ...props
}: GulpsalotFaceProps) {
  const gradient = useId()
  const c = skinColors(skin)
  return (
    <svg viewBox={hat ? '0 -40 120 140' : '0 0 120 100'} aria-hidden {...props}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hex(c.bodyLight)} />
          <stop offset="0.6" stopColor={hex(c.body)} />
          <stop offset="1" stopColor={hex(c.bodyShade)} />
        </linearGradient>
      </defs>
      <g fill={ink} stroke={ink} strokeWidth="8" strokeLinejoin="round">
        <ellipse cx="60" cy="64" rx="50" ry="31" />
        <circle cx="37" cy="31" r="18" />
        <circle cx="83" cy="31" r="18" />
      </g>
      <g fill={`url(#${gradient})`}>
        <ellipse cx="60" cy="64" rx="50" ry="31" />
        <circle cx="37" cy="31" r="18" />
        <circle cx="83" cy="31" r="18" />
      </g>
      <ellipse cx="60" cy="78" rx="30" ry="14" fill={hex(c.belly)} />
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
      {hat && hat !== 'none' && <Hat id={hat} />}
    </svg>
  )
}

/** The in-game hat, mapped from Gulpsalot's body space onto this smaller face. */
function Hat({ id }: { id: Exclude<HatId, 'none'> }) {
  const art = HAT_ART[id]
  const degrees = (art.rotation * 180) / Math.PI
  return (
    <g transform={`translate(60 15) scale(0.65) translate(${art.x} ${art.y}) rotate(${degrees})`}>
      {art.shapes.map((shape, i) => (
        <HatPart key={i} shape={shape} />
      ))}
    </g>
  )
}

function HatPart({ shape }: { shape: HatShape }) {
  const outline = shape.outline
    ? { stroke: ink, strokeWidth: HAT_OUTLINE, strokeLinejoin: 'round' as const }
    : {}
  switch (shape.type) {
    case 'path': {
      const line =
        shape.line === undefined
          ? outline
          : {
              stroke: hex(shape.line),
              strokeWidth: shape.width ?? 2,
              strokeLinecap: 'round' as const,
              strokeLinejoin: 'round' as const,
            }
      const fill = shape.fill === undefined ? 'none' : hex(shape.fill)
      return <path d={shape.d} fill={fill} {...line} />
    }
    case 'circle':
      return <circle cx={shape.x} cy={shape.y} r={shape.r} fill={hex(shape.fill)} {...outline} />
    case 'ellipse':
      return (
        <ellipse
          cx={shape.x}
          cy={shape.y}
          rx={shape.rx}
          ry={shape.ry}
          fill={hex(shape.fill)}
          {...outline}
        />
      )
  }
}
