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
    sting: 28,
    /** Spider bite. A little gentler than a sting: spiders are easy to see. */
    bite: 22,
    /** Fraction of max where the "starving" warnings kick in. */
    critical: 0.25,
    continueTo: 60,
    drainStart: 5,
    drainPerSecond: 0.045,
    drainMax: 11,
  },

  stun: 0.9,
  /** Seconds without a catch before Pofik yawns. */
  yawnAfter: 7,
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
    /** Extra reach around a bee that still counts as a close call. */
    closeCall: 26,
  },

  /** Score points and hunger refill for each kind of prey. Ladybugs are a bitter decoy. */
  prey: {
    fly: { points: 1, food: 14 },
    golden: { points: 5, food: 40 },
    dragonfly: { points: 3, food: 20 },
    firefly: { points: 2, food: 16 },
    moth: { points: 2, food: 15 },
    ladybug: { points: 0, food: 0 },
    beetle: { points: 1, food: 10 },
  },

  /** Power-up beetles: what each one does and for how long, in seconds. */
  power: {
    frenzy: { duration: 5, every: 0.2, maxFlies: 14 },
    freeze: { duration: 5, scale: 0.35 },
    double: { duration: 7 },
  },

  /** Food eaten on a full belly fills the burp meter; this much fills it. */
  burp: { capacity: 60, points: 5 },

  /** Catching this many of the same kind in a row pays `bonus` times its points. */
  set: { size: 3, bonus: 3 },

  /** A hit within this distance of an insect's center is a bullseye. */
  bullseye: { radius: 7, points: 1 },

  /** Eating a ladybug: Pofik grimaces and his next shot launches slower. */
  bitter: { shots: 1, launchScale: 0.5 },

  combo: {
    /** Seconds to land the next catch. The clock only runs while the tongue is home. */
    window: 2.4,
    /** Chain length (insects caught in quick succession) needed for x2, x3, x4 and x5. */
    steps: [2, 4, 7, 11] as const,
  },

  insects: {
    fly: { hitRadius: 21, life: [6, 10] as const },
    golden: { hitRadius: 19, life: [4, 6] as const },
    dragonfly: { hitRadius: 17, life: [7, 10] as const },
    firefly: { hitRadius: 21, life: [8, 12] as const },
    moth: { hitRadius: 20, life: [8, 12] as const },
    ladybug: { hitRadius: 19, life: [7, 11] as const },
    beetle: { hitRadius: 20, life: [6, 9] as const },
    bee: { hitRadius: 12, life: [10, 16] as const },
    wasp: { hitRadius: 12, life: [9, 14] as const },
    /** How long a spider dangles before it climbs back up. */
    spider: { hitRadius: 16, life: [6, 9] as const },
  },

  /** Wasps chase the tongue tip while it is out and within this range. */
  wasp: { lureRange: 230, lureSpeed: 1.7 },

  /** The spider's silk is sticky: a tongue that crosses it snags and comes back empty. */
  spider: { threadTop: -90, snagRadius: 6 },

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
    /** A fly spawn turns golden with this chance (one golden fly at a time). */
    golden: { start: 15, chance: [0.03, 0.045] as const, speed: 1.6 },
    dragonfly: {
      start: 25,
      interval: [10, 5.5] as const,
      max: [1, 2] as const,
      speed: [165, 215] as const,
    },
    /** Fireflies only come out once the sky is this dark (see `sky`). */
    firefly: {
      minSky: 1.5,
      interval: [3.2, 2.4] as const,
      max: [2, 3] as const,
      speed: [45, 60] as const,
    },
    /** Moths loop around a light (the moon, or the lantern decoration) at night. */
    moth: {
      minSky: 1.4,
      interval: [3.8, 2.8] as const,
      max: [2, 3] as const,
      speed: [70, 92] as const,
    },
    ladybug: {
      start: 14,
      interval: [11, 7] as const,
      max: [1, 2] as const,
      speed: [55, 75] as const,
    },
    wasp: {
      start: 45,
      interval: [14, 8] as const,
      max: [1, 2] as const,
      speed: [80, 110] as const,
    },
    beetle: {
      start: 20,
      interval: [22, 14] as const,
      max: [1, 1] as const,
      speed: [70, 90] as const,
    },
    /** Spiders drop in from the top on a thread, at this descent speed. */
    spider: {
      start: 60,
      interval: [16, 10] as const,
      max: [1, 2] as const,
      speed: [70, 95] as const,
    },
  },

  /** A fish leaps from the water now and then and snatches a low-flying insect. */
  fish: {
    start: 18,
    interval: [9, 16] as const,
    /** Bubbles on the water before the leap: the warning. */
    lurk: 1,
    leap: 0.8,
    /** How far above the bottom of the insect zone a target can be. */
    band: 120,
    reach: 44,
  },

  /** Each run's weather, picked from the run seed with these odds. */
  weather: {
    odds: { clear: 0.5, rain: 0.2, wind: 0.15, fog: 0.15 },
    /** Rain keeps insects this much lower, out from under the clouds. */
    rainLower: 90,
    /** Wind push on insects in world units per second squared: steady part plus gusts. */
    wind: { base: 25, gust: 70 },
    /** Morning fog thins out between these run times. */
    fogLift: [25, 60] as const,
  },

  /** A heron's shadow crosses the pond; shooting while it watches gets Pofik pecked. */
  heron: {
    start: 40,
    interval: [50, 75] as const,
    warn: 1.5,
    pass: 2.8,
    peck: 22,
    stun: 0.8,
  },

  /** Run time in seconds for each step of the day to dusk to night shift. */
  sky: {
    duskStart: 45,
    duskEnd: 70,
    nightStart: 85,
    nightEnd: 110,
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
