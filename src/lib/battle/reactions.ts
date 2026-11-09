import { canReact, payForReaction, type Cost } from '../reactorRules'
import type { Commitment } from '../tokenFlow'
import type { Engine } from './state'
import type { BattleEnemy, BattlePlayer, ReactionRequest } from './types'

export const INTERCEPT_DEFENSE = 2

const INTERCEPT_COST: Cost = { tokenId: 'resolve', amount: 1 }

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
