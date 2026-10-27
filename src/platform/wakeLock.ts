/**
 * Keeps the screen on during a run (Screen Wake Lock: Safari 16.4+, Chrome 84+).
 * Browsers drop the lock when the page is hidden, so `restore()` takes it again
 * on return. Swap for a Capacitor keep-awake plugin in native builds.
 */
let sentinel: WakeLockSentinel | null = null
let wanted = false

async function request() {
  if (sentinel || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
  try {
    sentinel = await navigator.wakeLock.request('screen')
    sentinel.addEventListener('release', () => {
      sentinel = null
    })
    // Released again while the request was in flight.
    if (!wanted) void release()
  } catch {
    // Refused (battery saver, not visible): the game works without it.
  }
}

async function release() {
  const current = sentinel
  sentinel = null
  try {
    await current?.release()
  } catch {
    // Already released.
  }
}

export const wakeLock = {
  acquire() {
    wanted = true
    void request()
  },
  release() {
    wanted = false
    void release()
  },
  /** Call when the page is visible again. */
  restore() {
    if (wanted) void request()
  },
}
