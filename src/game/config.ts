/**
 * Every gameplay and feel tunable lives here, so balancing never means
 * hunting through entity code.
 */
export const CONFIG = {
  world: {
    width: 400,
    minHeight: 700,
    maxHeight: 900,
    /** Insects stay below this line so they never hide under the HUD. */
    flyTop: 128,
    /** Distance from the bottom of the world to the lily pad center. */
    padFromBottom: 112,
    /** Distance from the bottom of the world to the water line. */
    waterFromBottom: 250,
  },

  hunger: {
    max: 100,
    start: 100,
    perFly: 14,
    sting: 28,
    /** Fraction of max where the "starving" warnings kick in. */
    critical: 0.25,
    continueTo: 60,
    drainStart: 5,
    drainPerSecond: 0.045,
    drainMax: 11,
  },

  stun: 0.9,
  invulnerableAfterContinue: 1.6,
  dyingDuration: 1.4,

  tongue: {
    launch: { freq: 5.2, damping: 0.58 },
    retract: { freq: 6.2, damping: 0.82 },
    retractLoaded: { freq: 5.4, damping: 0.82 },
    yank: { freq: 8.5, damping: 0.95 },
    /** Pause at full reach before pulling back. */
    dwell: 0.05,
    /** Safety net: start retracting after this long even if the target was never reached. */
    maxOut: 0.25,
    tipRadius: 15,
    minLength: 56,
    /** How far above the mouth the target must be. */
    minRise: 36,
    segments: 14,
    /** Taps made while the tongue is busy are kept this long. */
    inputBuffer: 0.12,
  },

  insects: {
    flyHitRadius: 21,
    beeHitRadius: 12,
    flyLife: [6, 10] as const,
    beeLife: [10, 16] as const,
  },

  spawn: {
    firstFly: 0.35,
    rampTime: 120,
    flyInterval: [1.15, 0.55] as const,
    maxFlies: [3, 7] as const,
    beeStart: 8,
    beeInterval: [6, 2.6] as const,
    maxBees: [1, 4] as const,
    flySpeed: [85, 150] as const,
    beeSpeed: [55, 88] as const,
  },

  attract: {
    maxFlies: 3,
    flyInterval: 1.6,
    autoShot: [2.6, 5.2] as const,
  },

  fx: {
    shakeMaxOffset: 12,
    shakeMaxAngle: 0.025,
    shakeDecay: 1.7,
    stingTrauma: 0.65,
    catchTrauma: 0.1,
    gulpTrauma: 0.14,
    hitStopSting: 0.06,
    hitStopCatch: 0.028,
    reducedMotionShake: 0.25,
  },
} as const

export type Range = readonly [number, number]
