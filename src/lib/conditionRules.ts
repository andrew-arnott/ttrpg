import { CONDITION_TOKEN_IDS } from '../data/tokens'
import type { DrawRules } from './drawTest'

/** A condition token attached to a character until it is released. */
export interface SealedCondition {
  tokenId: string
  /** The round it was sealed in. A condition cannot be released in the round it was sealed. */
  round: number
}

interface Afflictable {
  sealedConditions?: SealedCondition[]
}

export const sealedOf = (p: Afflictable): SealedCondition[] => p.sealedConditions ?? []
export const hasSealed = (p: Afflictable, tokenId: string) => sealedOf(p).some((c) => c.tokenId === tokenId)
export const countSealed = (p: Afflictable, tokenId: string) => sealedOf(p).filter((c) => c.tokenId === tokenId).length

export const isCondition = (tokenId: string) => CONDITION_TOKEN_IDS.includes(tokenId)

/** A sealed Insanity stops Fast and Triggered abilities. */
export const canUseFastOrTriggered = (p: Afflictable) => !hasSealed(p, 'insanity')

/** A sealed Fear stops attacks against enemies. */
export const canAttack = (p: Afflictable) => !hasSealed(p, 'fear')

/** A sealed Curse starts the next draw, and a sealed Wound turns a second Wound into a Critical Failure. */
export function drawRulesFor(p: Afflictable): DrawRules {
  return {
    startWith: hasSealed(p, 'curse') ? ['curse'] : [],
    woundSealed: hasSealed(p, 'wound'),
  }
}
