import { AnimatePresence, LazyMotion, MotionConfig, domAnimation } from 'motion/react'
import { GameHost } from './GameHost'
import { GameOverScreen } from './screens/GameOverScreen'
import { Hud } from './screens/Hud'
import { MockAdOverlay, RotateDevice, Splash } from './screens/Overlays'
import { PauseMenu } from './screens/PauseMenu'
import { TitleScreen } from './screens/TitleScreen'
import { useAppStore } from './store'
import { usePwaUpdate } from './usePwaUpdate'

export function App() {
  const screen = useAppStore((s) => s.screen)
  usePwaUpdate()

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <div className="desk">
          <main className="device">
            <GameHost>
              <div className="ui-layer">
                <AnimatePresence>
                  {screen === 'title' && <TitleScreen key="title" />}
                  {(screen === 'playing' || screen === 'paused') && <Hud key="hud" />}
                  {screen === 'paused' && <PauseMenu key="pause" />}
                  {screen === 'over' && <GameOverScreen key="over" />}
                </AnimatePresence>
                <AnimatePresence>{screen === 'boot' && <Splash key="splash" />}</AnimatePresence>
                <MockAdOverlay />
              </div>
            </GameHost>
            <RotateDevice />
          </main>
        </div>
      </LazyMotion>
    </MotionConfig>
  )
}
