import { sfx } from '../../audio'
import { haptics } from '../../platform/haptics'
import { useAppStore } from '../store'
import { IconButton } from './Button'
import { SoundOffIcon, SoundOnIcon, VibrateIcon, VibrateOffIcon } from './icons'

export function SettingsToggles() {
  const settings = useAppStore((s) => s.settings)
  const setSetting = useAppStore((s) => s.setSetting)

  return (
    <div className="toggles">
      <IconButton
        label={settings.sound ? 'Mute sound' : 'Turn sound on'}
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
          label={settings.haptics ? 'Turn vibration off' : 'Turn vibration on'}
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
    </div>
  )
}
