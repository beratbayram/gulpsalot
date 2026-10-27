import { m } from 'motion/react'
import { dailyDate, dailyKey } from '../../game/daily'
import { locale } from '../../i18n'
import * as actions from '../actions'
import { useGame } from '../gameContext'
import { popUp, stagger } from '../motion'
import { dailyBestFor, useAppStore } from '../store'
import { useLang, useT } from '../useT'
import { Button, IconButton } from '../ui/Button'
import { CalendarIcon, FlyIcon, HangerIcon, PlayIcon, TrophyIcon } from '../ui/icons'
import { Logo } from '../ui/Logo'
import { SettingsToggles } from '../ui/SettingsToggles'

export function TitleScreen() {
  const game = useGame()
  const t = useT()
  const lang = useLang()
  const best = useAppStore((s) => s.best)
  const daily = useAppStore((s) => s.daily)
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

      <m.div className="title-actions" variants={popUp}>
        <div className="breathe">
          <Button size="lg" icon={<PlayIcon />} onPress={() => game && actions.play(game)}>
            {t('title.play')}
          </Button>
        </div>
        <Button
          variant="secondary"
          icon={<CalendarIcon />}
          badge={dayLabel}
          onPress={() => game && actions.play(game, 'daily')}
        >
          {t('title.daily')}
        </Button>
        {todayBest > 0 && (
          <span className="title-note">{t('title.dailyBest', { n: todayBest })}</span>
        )}
      </m.div>

      <m.div className="title-row" variants={popUp}>
        <IconButton label={t('title.wardrobe')} onPress={() => setScreen('wardrobe')}>
          <HangerIcon />
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
      </m.div>

      {updateReady && applyUpdate && (
        <m.button type="button" className="update-pill" variants={popUp} onClick={applyUpdate}>
          {t('title.update')}
        </m.button>
      )}
    </m.section>
  )
}
