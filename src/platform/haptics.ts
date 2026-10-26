/**
 * Vibration feedback. The web Vibration API works on Android browsers only
 * (iOS Safari has none), so the setting is hidden where unsupported.
 * Swap for @capacitor/haptics when the native apps arrive.
 */
const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
let enabled = true

function vibrate(pattern: number | number[]) {
  if (!supported || !enabled) return
  try {
    navigator.vibrate(pattern)
  } catch {
    // Some browsers throw before the first user gesture.
  }
}

export const haptics = {
  supported,
  setEnabled(value: boolean) {
    enabled = value
  },
  tap: () => vibrate(6),
  light: () => vibrate(12),
  sting: () => vibrate([40, 40, 60]),
  heavy: () => vibrate(90),
}
