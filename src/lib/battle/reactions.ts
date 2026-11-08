import { withBonus, type SkillTestOutcome } from '../skillTest'
import { commitResource, releaseCommitment, resourceAvailable, type Commitment } from './tokens'
import type { Engine } from './state'
import type { BattleEnemy, BattlePlayer, ReactionRequest } from './types'

export const PRAYER_BONUS = 2
export const INTERCEPT_DEFENSE = 2

interface Cost {
  tokenId: string
  amount: number
}

const PRAYER_COST: Cost = { tokenId: 'faith', amount: 2 }
const INTERCEPT_COST: Cost = { tokenId: 'resolve', amount: 1 }

/** Whether a player is standing, knows the ability, and can pay for it. */
export function canReact(p: BattlePlayer, abilityId: string, cost: Cost | null): boolean {
  if (p.hp <= 0 || !p.abilityIds.includes(abilityId)) return false
  return !cost || resourceAvailable(p, cost.tokenId) >= cost.amount
}

/** Pays for a reaction. The tokens go back to the bag once the reaction has played out. */
export function payForReaction(p: BattlePlayer, cost: Cost): Commitment {
  return commitResource(p, cost.tokenId, cost.amount) ?? { resourceId: cost.tokenId, tokens: [] }
}

/**
 * A priest may add +2 to an ally's failed test. A Critical Failure cannot be saved.
 * Returns the test as it stands afterwards.
 */
export function offerPrayer(engine: Engine, tester: BattlePlayer, test: SkillTestOutcome): SkillTestOutcome {
  if (test.passed || test.result.outcome === 'critical-failure') return test
  for (const priest of engine.b.players) {
    if (priest.key === tester.key || !canReact(priest, 'prayer', PRAYER_COST)) continue
    const request: ReactionRequest = {
      abilityId: 'prayer',
      reactorKey: priest.key,
      title: 'Prayer',
      prompt: `${tester.name} failed the test with ${test.total} against ${test.difficulty + test.penalty}. ${priest.name} can pray to add +${PRAYER_BONUS}.`,
      cost: '2 Faith',
    }
    if (!engine.ask(request).use) continue
    releaseCommitment(priest, payForReaction(priest, PRAYER_COST))
    return withBonus(test, { label: `Prayer (${priest.name})`, value: PRAYER_BONUS })
  }
  return test
}

export interface Interception {
  interceptor: BattlePlayer
  commit: Commitment
}

/** An ally with Intercept may take a single-target attack meant for someone else. */
export function offerIntercept(
  engine: Engine,
  attacker: BattleEnemy,
  attackName: string,
  target: BattlePlayer,
): Interception | null {
  for (const candidate of engine.b.players) {
    if (candidate.key === target.key || !canReact(candidate, 'intercept', INTERCEPT_COST)) continue
    const request: ReactionRequest = {
      abilityId: 'intercept',
      reactorKey: candidate.key,
      title: 'Intercept',
      prompt: `${attacker.name} is about to hit ${target.name} with ${attackName}. ${candidate.name} can step in and take the attack instead, with +${INTERCEPT_DEFENSE} Defense against it.`,
      cost: '1 Resolve',
    }
    if (engine.ask(request).use) return { interceptor: candidate, commit: payForReaction(candidate, INTERCEPT_COST) }
  }
  return null
}
