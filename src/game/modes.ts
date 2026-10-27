import type { Difficulty } from './rules'

/** How a run plays. Daily and challenge runs use the classic rules with a fixed seed. */
export type PlayMode = 'classic' | 'zen' | 'rush' | 'sharp'

export interface ModeRules {
  /** Bees, wasps, spiders and the heron. */
  hazards: boolean
  /** The belly drains and an empty belly ends the run. Also drives the burp meter. */
  hunger: boolean
  /** Points are counted and shown. */
  score: boolean
  powerUps: boolean
  /** Seconds until the run ends, or null for no limit. */
  timeLimit: number | null
  /** Misses cost a heart and the run ends at zero. Null for no hearts. */
  hearts: number | null
  /** Points a sting or peck costs when there is no belly to lose. */
  stingPoints: number
  /** Seconds into the difficulty and day to night curve the run starts at. */
  startTime: number
  /** Whether a rewarded ad can buy a second chance. */
  canContinue: boolean
}

export const MODES: Record<PlayMode, ModeRules> = {
  classic: {
    hazards: true,
    hunger: true,
    score: true,
    powerUps: true,
    timeLimit: null,
    hearts: null,
    stingPoints: 0,
    startTime: 0,
    canContinue: true,
  },
  // No bees, no hunger, no score: just Gulpsalot and the pond.
  zen: {
    hazards: false,
    hunger: false,
    score: false,
    powerUps: false,
    timeLimit: null,
    hearts: null,
    stingPoints: 0,
    startTime: 0,
    canContinue: false,
  },
  // Sixty busy seconds from mid-afternoon to night. Stings cost points.
  rush: {
    hazards: true,
    hunger: false,
    score: true,
    powerUps: true,
    timeLimit: 60,
    hearts: null,
    stingPoints: 5,
    startTime: 25,
    canContinue: false,
  },
  // Classic, plus three hearts: every miss costs one.
  sharp: {
    hazards: true,
    hunger: true,
    score: true,
    powerUps: true,
    timeLimit: null,
    hearts: 3,
    stingPoints: 0,
    startTime: 0,
    canContinue: false,
  },
}

export const PLAY_MODES = Object.keys(MODES) as PlayMode[]

const OFF = { active: false, interval: 99, max: 0, speed: 0 }

/** The spawn rules with whatever a mode leaves out switched off. */
export function modeDifficulty(rules: ModeRules, d: Difficulty): Difficulty {
  if (rules.hazards && rules.powerUps) return d
  return {
    ...d,
    bee: rules.hazards ? d.bee : OFF,
    wasp: rules.hazards ? d.wasp : OFF,
    spider: rules.hazards ? d.spider : OFF,
    beetle: rules.powerUps ? d.beetle : OFF,
  }
}

/** Score after a sting in a mode without hunger. Never below zero. */
export const stingScore = (rules: ModeRules, score: number) =>
  Math.max(0, score - rules.stingPoints)
