export interface FrequencyCapOptions {
  /** Minimum finished runs between two interstitials. */
  everyRuns: number
  /** Minimum time between two interstitials. */
  minGapMs: number
}

export function createFrequencyCap(options: FrequencyCapOptions, now: () => number = Date.now) {
  let runsSince = 0
  let lastShown = -Infinity
  return {
    recordRun() {
      runsSince++
    },
    shouldShow() {
      return runsSince >= options.everyRuns && now() - lastShown >= options.minGapMs
    },
    markShown() {
      runsSince = 0
      lastShown = now()
    },
  }
}
