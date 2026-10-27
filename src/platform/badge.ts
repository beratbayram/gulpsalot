type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/**
 * A dot on the installed app's icon (Badging API) while today's daily
 * challenge is waiting. Does nothing where unsupported or not installed.
 */
export function setDailyBadge(waiting: boolean) {
  if (typeof navigator === 'undefined') return
  const nav = navigator as BadgeNavigator
  const call = waiting ? nav.setAppBadge?.(1) : nav.clearAppBadge?.()
  call?.catch(() => {})
}
