import { AnimatePresence, m } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { setMockAdPresenter, type MockAdKind } from '../../platform/monetization'
import { PhoneIcon } from '../ui/icons'
import { PofikFace } from '../ui/PofikFace'

/** Shown while the game boots. */
export function Splash() {
  return (
    <m.div
      className="splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
    >
      <PofikFace className="splash__face" />
    </m.div>
  )
}

/** Phones held sideways: asks to rotate back. CSS decides when it is visible. */
export function RotateDevice() {
  return (
    <div className="rotate" role="alert">
      <PhoneIcon className="rotate__phone" />
      <p>Turn your phone upright to play</p>
    </div>
  )
}

interface PendingAd {
  kind: MockAdKind
  resolve: (watched: boolean) => void
}

/** Dev-only fake ads so the continue / interstitial flow can be tested end to end. */
export function MockAdOverlay() {
  const [ad, setAd] = useState<PendingAd | null>(null)
  const [left, setLeft] = useState(0)
  const adRef = useRef<PendingAd | null>(null)

  useEffect(
    () =>
      setMockAdPresenter(
        (kind) =>
          new Promise<boolean>((resolve) => {
            const next = { kind, resolve }
            adRef.current = next
            setAd(next)
            setLeft(kind === 'rewarded' ? 3 : 2)
          }),
      ),
    [],
  )

  const finish = useCallback((watched: boolean) => {
    const current = adRef.current
    adRef.current = null
    setAd(null)
    current?.resolve(watched)
  }, [])

  useEffect(() => {
    if (!ad || left <= 0) return
    const id = setTimeout(() => {
      // Rewarded ads close on their own once watched.
      if (left === 1 && ad.kind === 'rewarded') finish(true)
      else setLeft(left - 1)
    }, 1000)
    return () => clearTimeout(id)
  }, [ad, left, finish])

  return (
    <AnimatePresence>
      {ad && (
        <m.div
          className="mock-ad"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="mock-ad__box">
            <p className="mock-ad__kind">
              {ad.kind === 'rewarded' ? 'Rewarded ad' : 'Interstitial ad'}
            </p>
            <p className="mock-ad__note">Development mock, no real ad network</p>
            <div className="mock-ad__count">{left > 0 ? left : '✓'}</div>
            <button
              type="button"
              className="btn btn--secondary btn--md"
              onClick={() => finish(left <= 0)}
            >
              {left > 0 ? 'Skip' : 'Close'}
            </button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
