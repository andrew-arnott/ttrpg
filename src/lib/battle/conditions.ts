import { TOKENS } from '../../data/tokens'
import { adjustBag } from '../tokenFlow'
import { releaseAllConditions, releaseCondition } from '../characterTest'
import { sealedOf } from './conditionRules'
import { canReact, payForReaction } from '../reactorRules'
import { addStep, playerActorOf, tokenName, type Engine } from './state'
import { releaseCommitment } from './tokens'
import type { BattlePlayer, ReactionRequest } from './types'

/**
 * An enemy hit gives its condition token. An ally with Divine Intervention may prevent it.
 * Returns what to add to the outcome.
 */
export function gainCondition(engine: Engine, target: BattlePlayer, tokenId: string): string {
  const cost = { tokenId: 'faith', amount: 1 }
  for (const priest of engine.b.players) {
    if (priest.key === target.key || !canReact(priest, 'divineIntervention', cost)) continue
    const request: ReactionRequest = {
      abilityId: 'divineIntervention',
      reactorKey: priest.key,
      title: 'Divine Intervention',
      prompt: `${target.name} is about to gain a ${tokenName(tokenId)} token. ${priest.name} can prevent it.`,
      cost: '1 Faith',
    }
    if (!engine.ask(request).use) continue
    releaseCommitment(priest, payForReaction(priest, cost))
    return `${priest.name} prevents the ${tokenName(tokenId)} token with Divine Intervention.`
  }
  target.bag = adjustBag(target.bag, tokenId, 1)
  return `${target.name} gains a ${tokenName(tokenId)} token in their bag.`
}

/** Priest's Cleanse: release everything sealed on someone. Returns how many were released. */
export function cleanse(target: BattlePlayer): number {
  const count = sealedOf(target).length
  releaseAllConditions(target)
  return count
}

/**
 * At the end of a combat round each character releases one sealed condition of their choice,
 * other than one sealed this round. With a choice to make, the player is asked.
 */
export function releaseAtRoundEnd(engine: Engine) {
  for (const p of engine.b.players) {
    if (p.hp <= 0) continue
    const eligible = sealedOf(p).filter((c) => c.round < engine.b.round)
    if (eligible.length === 0) continue
    let chosen = eligible[0]
    if (eligible.length > 1) {
      const options = eligible.map((c, i) => ({ id: String(i), label: tokenName(c.tokenId) }))
      const answer = engine.ask({
        abilityId: 'release',
        reactorKey: p.key,
        title: 'Release a condition',
        prompt: `${p.name} may release one sealed condition at the end of the round.`,
        cost: 'free',
        targets: options,
        required: true,
        confirmLabel: 'Release it',
      })
      chosen = eligible[Number(answer.targetId)] ?? eligible[0]
    }
    releaseCondition(p, chosen)
    addStep(engine, {
      actor: playerActorOf(p),
      title: 'Condition released',
      intro: `${p.name} shakes off the ${tokenName(chosen.tokenId)}.`,
      outcome: `${TOKENS[chosen.tokenId]?.name ?? chosen.tokenId} returns to ${p.name}'s bag.`,
      tone: 'success',
    })
  }
}
