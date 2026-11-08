import { enemiesInGroup, groupOf, playersInGroup } from './state'
import { ENGAGE_BASE_DIFFICULTY, ENGAGE_MIN_DIFFICULTY, NEW_GROUP } from './types'
import type { BattlePlayer, BattleState } from './types'

export interface EngageDifficulty {
  base: number
  /** Enemies in the group being left. They hold the character in place. */
  enemiesLeaving: number
  /** Enemies in the group being joined. */
  enemiesJoining: number
  /** Allies in the group being left, not counting the character. They cover the escape. */
  alliesLeaving: number
  total: number
  /** The minimum Difficulty raised the total above what the terms add up to. */
  floored: boolean
}

export function engageDifficulty(b: BattleState, p: BattlePlayer, targetGroup: string): EngageDifficulty {
  const own = groupOf(b, p.key)
  const enemiesLeaving = enemiesInGroup(b, own).length
  const alliesLeaving = playersInGroup(b, own).filter((a) => a.key !== p.key).length
  const enemiesJoining = targetGroup === NEW_GROUP ? 0 : enemiesInGroup(b, targetGroup).length
  const raw = ENGAGE_BASE_DIFFICULTY + enemiesLeaving + enemiesJoining - alliesLeaving
  return {
    base: ENGAGE_BASE_DIFFICULTY,
    enemiesLeaving,
    enemiesJoining,
    alliesLeaving,
    total: Math.max(ENGAGE_MIN_DIFFICULTY, raw),
    floored: raw < ENGAGE_MIN_DIFFICULTY,
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** The terms of the Difficulty, leaving out the ones that are zero. */
export function engageBreakdown(d: EngageDifficulty): string[] {
  const lines = [`${d.base} base`]
  if (d.enemiesLeaving > 0) lines.push(`+${d.enemiesLeaving} for ${plural(d.enemiesLeaving, 'enemy')} you are leaving`)
  if (d.enemiesJoining > 0) lines.push(`+${d.enemiesJoining} for ${plural(d.enemiesJoining, 'enemy')} in the group you are joining`)
  if (d.alliesLeaving > 0) lines.push(`-${d.alliesLeaving} for ${plural(d.alliesLeaving, 'ally')} covering you`)
  if (d.floored) lines.push(`minimum Difficulty ${ENGAGE_MIN_DIFFICULTY}`)
  return lines
}

export function engageTargetLabel(b: BattleState, p: BattlePlayer, targetGroup: string, name: string): string {
  return `${name} (Difficulty ${engageDifficulty(b, p, targetGroup).total})`
}
