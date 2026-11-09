import { canUseFastOrTriggered, type SealedCondition } from './conditionRules'
import type { ReactionRequest } from './reactionTypes'
import { withBonus, type SkillTestOutcome } from './skillTest'
import {
  commitResource,
  releaseCommitment,
  resourceAvailable,
  type Commitment,
  type TokenHolder,
} from './tokenFlow'
import type { Ask } from './replay'

/** Someone who may use a Triggered ability. */
export interface Reactor extends TokenHolder {
  key: string
  name: string
  hp: number
  abilityIds: string[]
  sealedConditions?: SealedCondition[]
}

export interface Cost {
  tokenId: string
  amount: number
}

export const PRAYER_BONUS = 2
export const PRAYER_COST: Cost = { tokenId: 'faith', amount: 2 }

/** Whether someone is standing, knows the ability, is not blocked by Insanity, and can pay for it. */
export function canReact(p: Reactor, abilityId: string, cost: Cost | null): boolean {
  if (p.hp <= 0 || !p.abilityIds.includes(abilityId) || !canUseFastOrTriggered(p)) return false
  return !cost || resourceAvailable(p, cost.tokenId) >= cost.amount
}

/** Pays for a reaction. The tokens go back to the bag once the reaction has played out. */
export function payForReaction(p: TokenHolder, cost: Cost): Commitment {
  return commitResource(p, cost.tokenId, cost.amount) ?? { resourceId: cost.tokenId, tokens: [] }
}

/**
 * A priest may add +2 to an ally's failed test. A Critical Failure cannot be saved. The priest
 * who prays is changed in place. Returns the test as it stands afterwards.
 */
export function offerPrayer(ask: Ask, party: Reactor[], tester: Reactor, test: SkillTestOutcome): SkillTestOutcome {
  if (test.passed || test.result.outcome === 'critical-failure') return test
  for (const priest of party) {
    if (priest.key === tester.key || !canReact(priest, 'prayer', PRAYER_COST)) continue
    const request: ReactionRequest = {
      abilityId: 'prayer',
      reactorKey: priest.key,
      title: 'Prayer',
      prompt: `${tester.name} failed the test with ${test.total} against ${test.difficulty + test.penalty}. ${priest.name} can pray to add +${PRAYER_BONUS}.`,
      cost: '2 Faith',
    }
    if (!ask(request).use) continue
    releaseCommitment(priest, payForReaction(priest, PRAYER_COST))
    return withBonus(test, { label: `Prayer (${priest.name})`, value: PRAYER_BONUS })
  }
  return test
}
