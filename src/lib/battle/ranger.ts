import type { Commitment } from '../tokenFlow'
import { attackEnemy, sealOn } from './effects'
import { focusSealedBy } from './quarry'
import { adjustBag, addStep, livingEnemies, moveToGroup, newGroup, playerActorOf, type Engine } from './state'
import { AIMED_SHOT_BONUS, CALLED_SHOT_DAMAGE, COVERING_FIRE_DEFENSE } from './types'
import type { BattleEnemy, BattlePlayer } from './types'

/** Marks an enemy as the Ranger's Quarry, returning the Focus sealed on any earlier one to their bag. */
export function markQuarry(engine: Engine, p: BattlePlayer, e: BattleEnemy, commit: Commitment) {
  for (const old of livingEnemies(engine.b)) {
    if (old === e) continue
    for (const token of focusSealedBy(old, p)) {
      old.sealed.splice(old.sealed.indexOf(token), 1)
      p.bag = adjustBag(p.bag, token.tokenId, 1)
    }
  }
  const sealed = sealOn(p, e, commit)
  addStep(engine, {
    actor: playerActorOf(p),
    title: 'Mark Quarry',
    intro: `${p.name} fixes on ${e.name}.`,
    outcome: `${sealed} ${e.name} is ${p.name}'s Quarry: attacks against it get +1 to the test result.`,
    tone: 'success',
  })
}

export function aimedShot(engine: Engine, p: BattlePlayer, e: BattleEnemy) {
  attackEnemy(engine, p, e, {
    title: 'Aimed Shot',
    intro: `${p.name} takes careful aim at ${e.name}.`,
    testBonus: { label: 'Aimed Shot', value: AIMED_SHOT_BONUS },
  })
}

export function calledShot(engine: Engine, p: BattlePlayer, e: BattleEnemy) {
  attackEnemy(engine, p, e, {
    title: 'Called Shot',
    intro: `${p.name} calls their shot on ${e.name}.`,
    bonusDamage: CALLED_SHOT_DAMAGE,
  })
}

export function snapShot(engine: Engine, p: BattlePlayer, e: BattleEnemy) {
  attackEnemy(engine, p, e, { title: 'Snap Shot', intro: `${p.name} looses a snap shot at ${e.name}.` })
}

export function retreatingShot(engine: Engine, p: BattlePlayer, e: BattleEnemy) {
  attackEnemy(engine, p, e, { title: 'Retreating Shot', intro: `${p.name} fires at ${e.name} and falls back.` })
  if (p.hp <= 0 || engine.b.result !== 'ongoing') return
  moveToGroup(engine.b, p.key, newGroup(engine.b))
  addStep(engine, {
    actor: playerActorOf(p),
    title: 'Falls back',
    intro: `${p.name} slips out of the scrum.`,
    outcome: `${p.name} breaks away to a group of their own.`,
    tone: 'success',
  })
}

export function coveringFire(engine: Engine, p: BattlePlayer, ally: BattlePlayer) {
  ally.defense += COVERING_FIRE_DEFENSE
  addStep(engine, {
    actor: playerActorOf(p),
    title: 'Covering Fire',
    intro: `${p.name} lays down arrows to cover ${ally.name}.`,
    outcome: `${ally.name} gains +${COVERING_FIRE_DEFENSE} Defense (${ally.defense} this round).`,
    tone: 'success',
  })
}
