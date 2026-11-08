import { CONDITION_TOKEN_IDS } from '../../data/tokens'
import type { DrawRules } from '../drawTest'
import { ACTIONS_PER_TURN } from './types'
import type { BattlePlayer, SealedCondition } from './types'

export const sealedOf = (p: BattlePlayer): SealedCondition[] => p.sealedConditions ?? []
export const hasSealed = (p: BattlePlayer, tokenId: string) => sealedOf(p).some((c) => c.tokenId === tokenId)
export const countSealed = (p: BattlePlayer, tokenId: string) => sealedOf(p).filter((c) => c.tokenId === tokenId).length

export const isCondition = (tokenId: string) => CONDITION_TOKEN_IDS.includes(tokenId)

/** A sealed Insanity stops Fast and Triggered abilities. */
export const canUseFastOrTriggered = (p: BattlePlayer) => !hasSealed(p, 'insanity')

/** A sealed Fear stops attacks against enemies. */
export const canAttack = (p: BattlePlayer) => !hasSealed(p, 'fear')

/**
 * A Fatigue sealed before this round began costs one action at the start of the turn, however many
 * are sealed. One sealed during this round's turn waits for the next.
 */
export const actionsThisTurn = (p: BattlePlayer, round: number) =>
  ACTIONS_PER_TURN - (sealedOf(p).some((c) => c.tokenId === 'fatigue' && c.round < round) ? 1 : 0)

/** A sealed Curse starts the next draw, and a sealed Wound turns a second Wound into a Critical Failure. */
export function drawRulesFor(p: BattlePlayer): DrawRules {
  return {
    startWith: hasSealed(p, 'curse') ? ['curse'] : [],
    woundSealed: hasSealed(p, 'wound'),
  }
}
