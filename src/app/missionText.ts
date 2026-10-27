import { missionDef, missionTarget } from '../game/missions'
import type { MessageKey, Vars } from '../i18n'

type Translate = (key: MessageKey, vars?: Vars) => string

/** Wording for missions that can ask for exactly one, where "{n}" would read oddly. */
const ONE: Partial<Record<string, MessageKey>> = {
  golden: 'mission.one.golden',
  burp: 'mission.one.burp',
  daily: 'mission.one.daily',
}

/** "Catch 15 flies" for the mission at a sequence index. */
export function missionText(t: Translate, index: number) {
  const { goal } = missionDef(index)
  const n = missionTarget(index)
  const id = goal.type === 'catch' ? goal.kind : goal.type
  const one = n === 1 ? ONE[id] : undefined
  if (one) return t(one)
  const key: MessageKey =
    goal.type === 'catch' ? `mission.catch.${goal.kind}` : `mission.${goal.type}`
  return t(key, { n })
}
