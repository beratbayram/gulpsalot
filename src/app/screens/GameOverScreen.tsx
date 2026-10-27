import { AnimatePresence, m } from 'motion/react'
import { useEffect, useState, type CSSProperties } from 'react'
import { sfx } from '../../audio'
import { easeOutCubic } from '../../lib/math'
import { monetization } from '../../platform/monetization'
import * as actions from '../actions'
import { useGame } from '../gameContext'
import { bouncy, popUp, stagger } from '../motion'
import { dailyDate } from '../../game/daily'
import { locale } from '../../i18n'
import { share } from '../../platform/share'
import { challengeUrl, resultLine } from '../sharing'
import { useAppStore, type LastRun } from '../store'
import { useLang, useT } from '../useT'
import { Button, IconButton } from '../ui/Button'
import {
  AdIcon,
  BoltIcon,
  CalendarIcon,
  FlyIcon,
  HangerIcon,
  HomeIcon,
  RestartIcon,
  ShareIcon,
  TargetIcon,
  TimerIcon,
} from '../ui/icons'
import { GulpsalotFace } from '../ui/GulpsalotFace'

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
  const skin = useAppStore((s) => s.look.skin)
  const t = useT()
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
  const title = t(`over.${run.cause}`)
  const daily = run.mode === 'daily'

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
            {daily && (
              <span className="result__mode">
                <CalendarIcon />
                {t('title.daily')}
              </span>
            )}
            {run.mode === 'challenge' && (
              <span className="result__mode">
                <BoltIcon />
                {t('challenge.mode')}
              </span>
            )}
            {(run.mode === 'rush' || run.mode === 'sharp') && (
              <span className="result__mode">
                {run.mode === 'rush' ? <TimerIcon /> : <TargetIcon />}
                {t(`mode.${run.mode}.name`)}
              </span>
            )}
            <span className="result__label">{t('over.score')}</span>
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
                  {t('over.newBest')}
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
            {run.toBeat !== null && counted && (
              <span className={run.score > run.toBeat ? 'result__beat is-won' : 'result__beat'}>
                {run.score > run.toBeat
                  ? t('over.beat', { n: run.toBeat })
                  : t('over.toBeat', { n: run.toBeat })}
              </span>
            )}
            {daily ? (
              <span className="result__best">{t('over.dailyBest', { n: run.dailyBest })}</span>
            ) : (
              !run.isBest &&
              run.best > 0 && (
                <span className="result__best">{t('over.best', { n: run.best })}</span>
              )
            )}
          </m.div>

          {run.unlocks.length > 0 && (
            <m.div className="unlocks" variants={popUp}>
              <span className="unlocks__title">{t('over.unlocked')}</span>
              <div className="unlocks__items">
                {run.unlocks.map((u) => (
                  <span key={`${u.type}-${u.id}`} className="unlock">
                    <GulpsalotFace
                      className="unlock__face"
                      skin={u.type === 'skin' ? u.id : skin}
                      hat={u.type === 'hat' ? u.id : 'none'}
                    />
                    {u.type === 'skin' ? t(`skin.${u.id}`) : t(`hat.${u.id}`)}
                  </span>
                ))}
              </div>
            </m.div>
          )}

          <m.div className="card__actions" variants={popUp}>
            <Button size="lg" icon={<RestartIcon />} onPress={onAgain} disabled={busy}>
              {t('over.again')}
            </Button>
            {canContinue && (
              <Button
                variant="green"
                icon={<AdIcon />}
                onPress={onContinue}
                disabled={busy}
                badge={t('over.ad')}
              >
                {t('over.continue')}
              </Button>
            )}
          </m.div>

          <m.div className="card__row" variants={popUp}>
            <IconButton
              label={t('common.home')}
              sound="back"
              onPress={() => game && actions.home(game)}
            >
              <HomeIcon />
            </IconButton>
            {run.unlocks.length > 0 && (
              <Button
                variant="secondary"
                icon={<HangerIcon />}
                onPress={() => game && actions.openWardrobe(game)}
                disabled={busy}
              >
                {t('over.tryOn')}
              </Button>
            )}
            <ShareButton run={run} compact={run.unlocks.length > 0} />
          </m.div>
        </m.div>
      </m.section>
    </m.div>
  )
}

/** The game's address without any parameters. */
const gameUrl = () => `${window.location.origin}${window.location.pathname}`

/**
 * Shares the run: a spoiler-free result line for the daily and the other modes,
 * or a challenge link with this run's seed and score for classic runs.
 */
function ShareButton({ run, compact }: { run: LastRun; compact: boolean }) {
  const t = useT()
  const lang = useLang()
  const day = useAppStore((s) => s.run.day)
  const [copied, setCopied] = useState(false)
  const challenge = run.mode === 'classic' || run.mode === 'challenge'

  const onShare = async () => {
    let text: string
    let url = gameUrl()
    if (challenge) {
      text = t('share.challenge', { n: run.score })
      url = challengeUrl(url, { seed: run.seed, score: run.score })
    } else {
      const title =
        run.mode === 'daily' && day
          ? t('share.daily', {
              date: new Intl.DateTimeFormat(locale(lang), {
                day: 'numeric',
                month: 'short',
              }).format(dailyDate(day)),
            })
          : t('share.mode', {
              mode:
                run.mode === 'daily'
                  ? t('title.daily')
                  : t(`mode.${run.mode as 'rush' | 'sharp' | 'zen'}.name`),
            })
      text = `${title}\n${resultLine(run)}`
    }
    const result = await share(text, url)
    if (result === 'copied') {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const label = copied
    ? t('over.copied')
    : challenge
      ? run.mode === 'challenge'
        ? t('over.challengeBack')
        : t('over.challenge')
      : t('over.share')
  if (compact) {
    return (
      <IconButton label={label} onPress={() => void onShare()}>
        <ShareIcon />
      </IconButton>
    )
  }
  return (
    <Button variant="secondary" icon={<ShareIcon />} onPress={() => void onShare()}>
      {label}
    </Button>
  )
}
