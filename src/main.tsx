import '@fontsource-variable/fredoka'
import './app/styles/tokens.css'
import './app/styles/global.css'
import './app/styles/ui.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { useAppStore } from './app/store'
import { audio } from './audio'
import { loadGameFont } from './game/fonts'
import { monetization } from './platform/monetization'
import { storage } from './platform/storage'

async function boot() {
  await storage.init()
  useAppStore.getState().hydrate()
  audio.install()
  await Promise.all([loadGameFont(), monetization.init()])
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
