import { TOKENS } from '../../data/tokens'
import type { TestResult } from '../drawTest'
import { adjustBag } from '../tokenFlow'
import { countSealed, hasSealed, isCondition, sealedOf } from './conditionRules'
import { canReact, payForReaction } from './reactions'
import { addStep, dealDamageToPlayer, playerActorOf, tokenName, updateResult, type Engine } from './state'
import { releaseCommitment } from './tokens'
import type { BattlePlayer, ReactionRequest, SealedCondition } from './types'

function release(p: BattlePlayer, condition: SealedCondition) {
  const list = sealedOf(p)
  const index = list.indexOf(condition)
  if (index < 0) return
  p.sealedConditions = list.filter((_, i) => i !== index)
  p.bag = adjustBag(p.bag, condition.tokenId, 1)
}

/** Returns every sealed condition to the bag, for when the fight is over. */
export function releaseAllConditions(p: BattlePlayer) {
  for (const condition of [...sealedOf(p)]) release(p, condition)
}

/**
 * Condition tokens drawn in a failed test are sealed on the character and take effect. In a test
 * that succeeded they go back in the bag, and a Curse that started the draw stops being sealed.
 */
export function resolveConditions(engine: Engine, p: BattlePlayer, result: TestResult, succeeded: boolean) {
  const startedWithCurse = hasSealed(p, 'curse')
  const drawn = result.drawn.map((d) => d.tokenId).filter(isCondition)
  if (succeeded) {
    if (startedWithCurse) release(p, sealedOf(p).find((c) => c.tokenId === 'curse')!)
    return
  }
  const fromBag = startedWithCurse ? drawn.slice(1) : drawn
  for (const tokenId of fromBag) {
    p.bag = adjustBag(p.bag, tokenId, -1)
    p.sealedConditions = [...sealedOf(p), { tokenId, round: engine.b.round }]
    engine.notes.push(`${tokenName(tokenId)} is sealed on ${p.name}.`)
    if (tokenId === 'poison') {
      const damage = countSealed(p, 'poison')
      dealDamageToPlayer(p, damage)
      engine.notes.push(`${p.name} takes ${damage} poison damage (${p.hp}/${p.maxHp} HP).${p.hp === 0 ? ` ${p.name} falls!` : ''}`)
      updateResult(engine.b)
    }
  }
}

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
      })
      chosen = eligible[Number(answer.targetId)] ?? eligible[0]
    }
    release(p, chosen)
    addStep(engine, {
      actor: playerActorOf(p),
      title: 'Condition released',
      intro: `${p.name} shakes off the ${tokenName(chosen.tokenId)}.`,
      outcome: `${TOKENS[chosen.tokenId]?.name ?? chosen.tokenId} returns to ${p.name}'s bag.`,
      tone: 'success',
    })
  }
}
