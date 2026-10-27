import { m } from 'motion/react'
import { currentStreak, dailyDate, dailyKey } from '../../game/daily'
import { locale } from '../../i18n'
import * as actions from '../actions'
import { useGame } from '../gameContext'
import { popUp, stagger } from '../motion'
import { dailyBestFor, useAppStore } from '../store'
import { useLang, useT } from '../useT'
import { Button, IconButton } from '../ui/Button'
import {
  BoltIcon,
  CalendarIcon,
  ChartIcon,
  CloseIcon,
  FlagIcon,
  FlameIcon,
  FlyIcon,
  HangerIcon,
  ModesIcon,
  PlayIcon,
  TrophyIcon,
} from '../ui/icons'
import { Logo } from '../ui/Logo'
import { SettingsToggles } from '../ui/SettingsToggles'

export function TitleScreen() {
  const game = useGame()
  const t = useT()
  const lang = useLang()
  const best = useAppStore((s) => s.best)
  const daily = useAppStore((s) => s.daily)
  const streak = useAppStore((s) => currentStreak(s.streak, dailyKey()))
  const challenge = useAppStore((s) => s.challenge)
  const setScreen = useAppStore((s) => s.setScreen)
  const updateReady = useAppStore((s) => s.updateReady)
  const applyUpdate = useAppStore((s) => s.applyUpdate)

  const today = dailyKey()
  const todayBest = dailyBestFor(daily, today)
  const dayLabel = new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short' }).format(
    dailyDate(today),
  )

  return (
    <m.section
      className="screen title-screen"
      variants={stagger()}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <m.div className="corner corner--right" variants={popUp}>
        <SettingsToggles />
      </m.div>

      <Logo />
      <m.p className="tagline" variants={popUp}>
        {t('title.tagline')}
      </m.p>

      {challenge && (
        <m.div className="challenge-card" variants={popUp} role="group">
          <span className="challenge-card__icon">
            <BoltIcon />
          </span>
          <span className="challenge-card__text">
            <strong>{t('challenge.title')}</strong>
            <small>{t('challenge.desc', { n: challenge.score })}</small>
          </span>
          <Button size="md" onPress={() => game && actions.play(game, 'challenge')}>
            {t('challenge.play')}
          </Button>
          <button
            type="button"
            className="challenge-card__close"
            aria-label={t('challenge.dismiss')}
            onClick={() => useAppStore.getState().setChallenge(null)}
          >
            <CloseIcon />
          </button>
        </m.div>
      )}

      <m.div className="title-actions" variants={popUp}>
        <div className="breathe">
          <Button size="lg" icon={<PlayIcon />} onPress={() => game && actions.play(game)}>
            {t('title.play')}
          </Button>
        </div>
        <div className="title-actions__row">
          <Button
            variant="secondary"
            icon={<CalendarIcon />}
            badge={dayLabel}
            onPress={() => game && actions.play(game, 'daily')}
          >
            {t('title.daily')}
          </Button>
          <Button variant="secondary" icon={<ModesIcon />} onPress={() => setScreen('modes')}>
            {t('title.modes')}
          </Button>
        </div>
        {(todayBest > 0 || streak > 0) && (
          <span className="title-note">
            {streak > 0 && (
              <span className="title-note__streak">
                <FlameIcon />
                {t('title.streak', { n: streak })}
              </span>
            )}
            {todayBest > 0 && <span>{t('title.dailyBest', { n: todayBest })}</span>}
          </span>
        )}
      </m.div>

      <m.div className="title-row" variants={popUp}>
        <IconButton label={t('title.wardrobe')} onPress={() => setScreen('wardrobe')}>
          <HangerIcon />
        </IconButton>
        <IconButton label={t('title.missions')} onPress={() => setScreen('missions')}>
          <FlagIcon />
        </IconButton>
        {best > 0 && (
          <div className="chip">
            <FlyIcon className="chip__icon" />
            {t('title.best')} <strong>{best}</strong>
          </div>
        )}
        <IconButton label={t('title.achievements')} onPress={() => setScreen('achievements')}>
          <TrophyIcon />
        </IconButton>
        <IconButton label={t('title.stats')} onPress={() => setScreen('stats')}>
          <ChartIcon />
        </IconButton>
      </m.div>

      {updateReady && applyUpdate && (
        <m.button type="button" className="update-pill" variants={popUp} onClick={applyUpdate}>
          {t('title.update')}
        </m.button>
      )}
    </m.section>
  )
}
