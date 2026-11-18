import type { Commitment } from '../tokenFlow'
import { testBonuses } from '../characterTest'
import { drawTest } from '../drawTest'
import type { SkillTestOutcome } from '../skillTest'
import { drawRulesFor } from './conditionRules'
import { afterTest, attackEnemy, runTriggers, sealOn } from './effects'
import { focusSealedBy } from './quarry'
import { adjustBag, addStep, fmtSigned, livingEnemies, moveToGroup, newGroup, playerActorOf, type Engine } from './state'
import { AIMED_SHOT_BONUS, CALLED_SHOT_DAMAGE } from './types'
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

export function retreatingStrike(engine: Engine, p: BattlePlayer, e: BattleEnemy) {
  attackEnemy(engine, p, e, { title: 'Retreating Strike', intro: `${p.name} strikes at ${e.name} and falls back.` })
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

/** Covering Fire: a Perception test whose result is added to an ally's Defense score, as a Defend adds to one's own. */
export function coveringFire(engine: Engine, p: BattlePlayer, ally: BattlePlayer) {
  const result = drawTest(p.bag, engine.rng, drawRulesFor(p))
  const perception = p.special.perception
  const bonuses = testBonuses(p, engine.b.torchLevel)
  const total = result.total + perception + bonuses.reduce((sum, x) => sum + x.value, 0)
  const failed = result.outcome === 'critical-failure'
  const gain = failed ? 0 : Math.max(0, total)
  afterTest(engine, p, result, gain > 0)
  const before = ally.defense
  ally.defense += gain
  const test: SkillTestOutcome = {
    attribute: 'perception',
    attributeValue: perception,
    difficulty: 0,
    bonuses,
    result,
    total,
    passed: gain > 0,
  }
  addStep(engine, {
    actor: playerActorOf(p),
    title: 'Covering Fire',
    intro: `${p.name} lays down arrows to cover ${ally.name}.`,
    test,
    testMode: 'score',
    resultLine: failed
      ? `Critical Failure: nothing is added. ${ally.name}'s Defense stays at ${ally.defense}`
      : `Tokens ${fmtSigned(result.total)} + Perception ${perception}${bonuses.map((x) => ` ${x.value < 0 ? '-' : '+'} ${x.label} ${Math.abs(x.value)}`).join('')} = ${total}: ${ally.name}'s Defense ${before} \u2192 ${ally.defense}`,
    outcome: gain > 0 ? `${ally.name} has ${ally.defense} Defense this round.` : `The cover comes to nothing. ${ally.name} gains no Defense.`,
    tone: gain > 0 ? 'success' : 'failure',
  })
  runTriggers(engine, p, result)
}
