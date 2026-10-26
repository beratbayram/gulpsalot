import { AnimatePresence, m } from 'motion/react'
import { useEffect, useState, type CSSProperties } from 'react'
import { sfx } from '../../audio'
import { easeOutCubic } from '../../lib/math'
import { monetization } from '../../platform/monetization'
import * as actions from '../actions'
import { useGame } from '../gameContext'
import { bouncy, popUp, stagger } from '../motion'
import { useAppStore } from '../store'
import { Button, IconButton } from '../ui/Button'
import { AdIcon, FlyIcon, HomeIcon, RestartIcon } from '../ui/icons'

const COUNT_DELAY = 450
const COUNT_DURATION = 750

function useCountUp(target: number) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now() + COUNT_DELAY
    const duration = target > 0 ? Math.min(1200, COUNT_DURATION + target * 12) : 1
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration))
      setValue(Math.round(easeOutCubic(t) * target))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return value
}

const SPARKS = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2
  return { x: Math.cos(a) * 70, y: Math.sin(a) * 46, d: i * 0.02 }
})

export function GameOverScreen() {
  const game = useGame()
  const run = useAppStore((s) => s.lastRun)
  const shown = useCountUp(run?.score ?? 0)
  const counted = run ? shown >= run.score : false
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (shown > 0) sfx.countTick(shown)
  }, [shown])

  useEffect(() => {
    if (counted && run?.isBest) sfx.newBest()
  }, [counted, run?.isBest])

  if (!run) return null
  const canContinue = run.canContinue && monetization.canShowRewarded('continue')
  const title = run.cause === 'stung' ? 'Ouch, a bee!' : "Tummy's empty!"

  const onContinue = async () => {
    if (!game || busy) return
    setBusy(true)
    const ok = await actions.continueWithAd(game)
    if (!ok) setBusy(false)
  }

  const onAgain = async () => {
    if (!game || busy) return
    setBusy(true)
    await actions.playAgain(game)
  }

  return (
    <m.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="overlay__dim overlay__dim--soft" />
      <m.section
        className="card"
        role="dialog"
        aria-label={title}
        initial={{ y: -40, scale: 0.7, opacity: 0, rotate: -3 }}
        animate={{ y: 0, scale: 1, opacity: 1, rotate: 0, transition: bouncy }}
        exit={{ y: 30, scale: 0.9, opacity: 0, transition: { duration: 0.18 } }}
      >
        <m.div
          className="card__body"
          variants={stagger(0.06, 0.15)}
          initial="hidden"
          animate="show"
        >
          <m.h2 className="card__title" variants={popUp}>
            {title}
          </m.h2>

          <m.div className="result" variants={popUp}>
            <span className="result__label">Flies eaten</span>
            <span className="result__value">
              <FlyIcon className="result__icon" />
              {shown}
            </span>
            <AnimatePresence>
              {counted && run.isBest && (
                <m.div
                  className="new-best"
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: -8, transition: bouncy }}
                >
                  New best!
                  {SPARKS.map((s, i) => (
                    <i
                      key={i}
                      className="spark"
                      style={
                        {
                          '--x': `${s.x}px`,
                          '--y': `${s.y}px`,
                          animationDelay: `${s.d}s`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </m.div>
              )}
            </AnimatePresence>
            {!run.isBest && run.best > 0 && <span className="result__best">Best {run.best}</span>}
          </m.div>

          <m.div className="card__actions" variants={popUp}>
            <Button size="lg" icon={<RestartIcon />} onPress={onAgain} disabled={busy}>
              Play again
            </Button>
            {canContinue && (
              <Button
                variant="green"
                icon={<AdIcon />}
                onPress={onContinue}
                disabled={busy}
                badge="AD"
              >
                Continue
              </Button>
            )}
          </m.div>

          <m.div variants={popUp}>
            <IconButton label="Home" sound="back" onPress={() => game && actions.home(game)}>
              <HomeIcon />
            </IconButton>
          </m.div>
        </m.div>
      </m.section>
    </m.div>
  )
}
