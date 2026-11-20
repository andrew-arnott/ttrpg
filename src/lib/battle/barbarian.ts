import { releaseCondition, takeDamage } from '../characterTest'
import { recoverToken, adjustBag } from '../tokenFlow'
import { attackEnemy } from './effects'
import { sealedOf } from './conditionRules'
import { addStep, enemiesInGroup, groupOf, moveToGroup, playerActorOf, tokenName, type Engine } from './state'
import {
  BERSERK_BLOW_COST_HP,
  BERSERK_BLOW_DAMAGE,
  RECKLESS_CHARGE_BONUS,
  ROAR_ATTACK_PENALTY,
  SAVAGE_BLOW_DAMAGE,
} from './types'
import type { BattleEnemy, BattlePlayer } from './types'

/** Reckless Fury: using a Reckless ability recovers 1 Fury. Returns what to add to the outcome. */
function recklessFury(p: BattlePlayer): string {
  if (!p.abilityIds.includes('recklessFury') || !recoverToken(p, 'fury')) return ''
  return ` Reckless Fury: ${p.name} recovers 1 Fury.`
}

export function savageBlow(engine: Engine, p: BattlePlayer, e: BattleEnemy) {
  attackEnemy(engine, p, e, {
    title: 'Savage Blow',
    intro: `${p.name} swings with everything they have at ${e.name}.`,
    bonusDamage: SAVAGE_BLOW_DAMAGE,
  })
}

export function recklessCharge(engine: Engine, p: BattlePlayer, e: BattleEnemy) {
  moveToGroup(engine.b, p.key, groupOf(engine.b, e.id))
  attackEnemy(engine, p, e, {
    title: 'Reckless Charge',
    intro: `${p.name} charges ${e.name} without a thought for what comes next.`,
    testBonus: { label: 'Reckless Charge', value: RECKLESS_CHARGE_BONUS },
  })
  p.bag = adjustBag(p.bag, 'fatigue', 1)
  addStep(engine, {
    actor: playerActorOf(p),
    title: 'Reckless',
    intro: 'The charge leaves them winded.',
    outcome: `${p.name} adds 1 Fatigue to their bag.${recklessFury(p)}`,
    tone: 'failure',
  })
}

export function berserkBlow(engine: Engine, p: BattlePlayer, e: BattleEnemy) {
  const { dealt, absorbed } = takeDamage(p, BERSERK_BLOW_COST_HP, true)
  addStep(engine, {
    actor: playerActorOf(p),
    title: 'Berserk',
    intro: `${p.name} drives themselves into a frenzy.`,
    outcome: `${p.name} takes ${dealt} damage (${p.hp}/${p.maxHp} HP).${absorbed > 0 ? ` ${absorbed} absorbed by Shield.` : ''}`,
    tone: 'failure',
  })
  attackEnemy(engine, p, e, {
    title: 'Berserk Blow',
    intro: `${p.name} brings it down on ${e.name}.`,
    totalDamage: BERSERK_BLOW_DAMAGE,
  })
}

export function terrifyingRoar(engine: Engine, p: BattlePlayer) {
  const scared = enemiesInGroup(engine.b, groupOf(engine.b, p.key))
  scared.forEach((e) => {
    e.empowered -= ROAR_ATTACK_PENALTY
  })
  addStep(engine, {
    actor: playerActorOf(p),
    title: 'Terrifying Roar',
    intro: `${p.name} bellows.`,
    outcome: `${scared.map((e) => e.name).join(', ')} ${scared.length === 1 ? 'has' : 'have'} -${ROAR_ATTACK_PENALTY} attack value until the end of the round.`,
    tone: 'success',
  })
}

/** Releases 1 sealed condition of the player's choice from themselves. */
export function rallyThroughPain(engine: Engine, p: BattlePlayer) {
  const sealed = sealedOf(p)
  if (sealed.length === 0) return
  let chosen = sealed[0]
  if (sealed.length > 1) {
    const answer = engine.ask({
      abilityId: 'rallyThroughPain',
      reactorKey: p.key,
      title: 'Rally Through Pain',
      prompt: `${p.name} shakes off one sealed condition.`,
      cost: 'free',
      targets: sealed.map((c, i) => ({ id: String(i), label: tokenName(c.tokenId) })),
      required: true,
      confirmLabel: 'Release it',
    })
    chosen = sealed[Number(answer.targetId)] ?? sealed[0]
  }
  releaseCondition(p, chosen)
  addStep(engine, {
    actor: playerActorOf(p),
    title: 'Rally Through Pain',
    intro: `${p.name} grits their teeth and keeps going.`,
    outcome: `${tokenName(chosen.tokenId)} returns to ${p.name}'s bag.`,
    tone: 'success',
  })
}
