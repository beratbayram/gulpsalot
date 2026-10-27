import { sfx } from '../../audio'
import { nextLang } from '../../i18n'
import { haptics } from '../../platform/haptics'
import { useAppStore } from '../store'
import { useT } from '../useT'
import { IconButton } from './Button'
import { SoundOffIcon, SoundOnIcon, VibrateIcon, VibrateOffIcon } from './icons'

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
        label={t('settings.language')}
        onPress={() => setSetting('lang', nextLang(settings.lang))}
      >
        <span className="icon-btn__text">{settings.lang.toUpperCase()}</span>
      </IconButton>
    </div>
  )
}
