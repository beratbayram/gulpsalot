/** Calls `onHide` when the app goes to the background and `onShow` when it returns. */
export function watchVisibility(onHide: () => void, onShow: () => void) {
  const handle = () => (document.visibilityState === 'hidden' ? onHide() : onShow())
  document.addEventListener('visibilitychange', handle)
  window.addEventListener('pagehide', onHide)
  return () => {
    document.removeEventListener('visibilitychange', handle)
    window.removeEventListener('pagehide', onHide)
  }
}

/** Phones held sideways get a "rotate back" overlay and the game pauses. */
export const landscapePhoneQuery =
  '(orientation: landscape) and (pointer: coarse) and (max-height: 540px)'

export const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
