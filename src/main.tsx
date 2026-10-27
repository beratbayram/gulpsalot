import '@fontsource-variable/fredoka'
import './app/styles/tokens.css'
import './app/styles/global.css'
import './app/styles/ui.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { parseChallenge, withoutChallenge } from './app/sharing'
import { useAppStore } from './app/store'
import { audio } from './audio'
import { loadGameFont } from './game/fonts'
import { setLang } from './i18n'
import { monetization } from './platform/monetization'
import { storage } from './platform/storage'

async function boot() {
  await storage.init()
  useAppStore.getState().hydrate()
  // A friend's challenge link: keep it for the title screen, then tidy the address.
  const challenge = parseChallenge(window.location.search)
  if (challenge) {
    useAppStore.getState().setChallenge(challenge)
    window.history.replaceState(null, '', withoutChallenge(window.location.href))
  }
  setLang(useAppStore.getState().settings.lang)
  audio.install()
  await Promise.all([loadGameFont(), monetization.init()])
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
