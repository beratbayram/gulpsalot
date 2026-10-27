import { sfx } from '../../audio'
import { nextLang } from '../../i18n'
import { haptics } from '../../platform/haptics'
import { useAppStore } from '../store'
import { useT } from '../useT'
import { IconButton } from './Button'
import {
  ContrastIcon,
  MusicIcon,
  MusicOffIcon,
  SoundOffIcon,
  SoundOnIcon,
  VibrateIcon,
  VibrateOffIcon,
} from './icons'

export function SettingsToggles() {
  const settings = useAppStore((s) => s.settings)
  const setSetting = useAppStore((s) => s.setSetting)
  const t = useT()

  return (
    <div className="toggles">
      <IconButton
        label={settings.sound ? t('settings.soundOff') : t('settings.soundOn')}
        pressed={settings.sound}
        sound="none"
        onPress={() => {
          const next = !settings.sound
          setSetting('sound', next)
          // Play after unmuting so the click is audible.
          if (next) setTimeout(() => sfx.toggle(true), 50)
        }}
      >
        {settings.sound ? <SoundOnIcon /> : <SoundOffIcon />}
      </IconButton>
      <IconButton
        label={settings.music ? t('settings.musicOff') : t('settings.musicOn')}
        pressed={settings.music}
        sound="none"
        onPress={() => {
          const next = !settings.music
          setSetting('music', next)
          sfx.toggle(next)
        }}
      >
        {settings.music ? <MusicIcon /> : <MusicOffIcon />}
      </IconButton>
      {haptics.supported && (
        <IconButton
          label={settings.haptics ? t('settings.vibrationOff') : t('settings.vibrationOn')}
          pressed={settings.haptics}
          sound="none"
          onPress={() => {
            const next = !settings.haptics
            setSetting('haptics', next)
            sfx.toggle(next)
            haptics.setEnabled(next)
            if (next) haptics.light()
          }}
        >
          {settings.haptics ? <VibrateIcon /> : <VibrateOffIcon />}
        </IconButton>
      )}
      <IconButton
        label={settings.contrast ? t('settings.contrastOff') : t('settings.contrastOn')}
        pressed={settings.contrast}
        sound="none"
        onPress={() => {
          const next = !settings.contrast
          setSetting('contrast', next)
          sfx.toggle(next)
        }}
      >
        <ContrastIcon />
      </IconButton>
      <IconButton
        label={t('settings.language')}
        onPress={() => setSetting('lang', nextLang(settings.lang))}
      >
        <span className="icon-btn__text">{settings.lang.toUpperCase()}</span>
      </IconButton>
    </div>
  )
}
