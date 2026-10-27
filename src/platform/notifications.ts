/**
 * Local notifications, for the daily challenge reminder. The web build has
 * none (a PWA can't schedule them reliably); native builds swap in
 * `@capacitor/local-notifications` behind this interface.
 */
export interface Notifications {
  /** Replaces any earlier reminder with one at `at`. */
  scheduleDailyReminder(at: Date): Promise<void>
  cancelDailyReminder(): Promise<void>
}

export const notifications: Notifications = {
  async scheduleDailyReminder() {},
  async cancelDailyReminder() {},
}
