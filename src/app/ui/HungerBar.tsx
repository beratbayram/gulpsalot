import { useEffect, useRef, useState } from 'react'
import { useGame } from '../gameContext'
import { useHudStore } from '../hudStore'
import { PofikFace } from './PofikFace'

const GOOD = [140, 195, 74]
const OK = [233, 196, 106]
const BAD = [224, 122, 95]

function hungerColor(h: number) {
  const [a, b, t] = h > 0.5 ? [OK, GOOD, (h - 0.5) / 0.5] : [BAD, OK, h / 0.5]
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `rgb(${c[0]} ${c[1]} ${c[2]})`
}

/**
 * Belly meter. Values arrive from the game up to once per frame; we write
 * them straight to CSS variables instead of re-rendering. A white "trail"
 * lags behind sudden drops (stings) like a fighting-game health bar.
 */
export function HungerBar() {
  const ref = useRef<HTMLDivElement>(null)
  const game = useGame()
  const [worried, setWorried] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let trail = useHudStore.getState().hunger
    let trailHold = 0
    let last = performance.now()

    const apply = (hunger: number, critical: boolean) => {
      const now = performance.now()
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (hunger >= trail) {
        trail = hunger
        trailHold = 0.35
      } else if (trailHold > 0) {
        trailHold -= dt
      } else {
        trail += (hunger - trail) * Math.min(1, dt * 5)
      }
      el.style.setProperty('--hunger', hunger.toFixed(4))
      el.style.setProperty('--trail', trail.toFixed(4))
      el.style.setProperty('--hunger-color', hungerColor(hunger))
      el.classList.toggle('is-critical', critical)
      setWorried(hunger < 0.3)
    }

    const s = useHudStore.getState()
    apply(s.hunger, s.critical)
    return useHudStore.subscribe((state) => apply(state.hunger, state.critical))
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!game || !el) return
    const offCaught = game.events.on('caught', () => {
      el.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.09)' },
          { transform: 'scale(0.98)' },
          { transform: 'scale(1)' },
        ],
        { duration: 380, easing: 'ease-out' },
      )
    })
    const offStung = game.events.on('stung', () => {
      el.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-7px) rotate(-2deg)' },
          { transform: 'translateX(6px) rotate(1.5deg)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(2px)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 420, easing: 'ease-out' },
      )
    })
    return () => {
      offCaught()
      offStung()
    }
  }, [game])

  return (
    <div
      ref={ref}
      className="hunger"
      role="meter"
      aria-label="Hunger"
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <PofikFace className="hunger__face" mood={worried ? 'worried' : 'happy'} />
      <div className="hunger__track">
        <div className="hunger__trail" />
        <div className="hunger__fill" />
        <div className="hunger__shine" />
      </div>
    </div>
  )
}
