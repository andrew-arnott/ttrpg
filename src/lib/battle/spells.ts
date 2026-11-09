import { drawExactly } from '../drawTest'
import type { SkillTestOutcome } from '../skillTest'
import { takeDamage } from '../characterTest'
import { adjustBag } from '../tokenFlow'
import { attackEnemy } from './effects'
import {
  addStep,
  groupOf,
  livingEnemies,
  moveToGroup,
  playerActorOf,
  updateResult,
  type Engine,
} from './state'
import { enemyTargets } from './targets'
import { commitResource, releaseCommitment, resourceAvailable, type Commitment } from './tokens'
import type { BattleEnemy, BattlePlayer } from './types'

export const CHAIN_LIGHTNING_DAMAGE = 2
/** Extra Mana to arc to a second, then a third, enemy. */
export const CHAIN_LIGHTNING_EXTRA_COST = [2, 3]
export const ARCANE_FOCUS_TOKENS = 5

/**
 * Attacks the first enemy, then offers to spend more Mana to arc to a different one, up to three
 * in all. Each target needs its own Intelligence test, and the caster decides after seeing the last.
 */
export function chainLightning(engine: Engine, caster: BattlePlayer, first: BattleEnemy) {
  const hit = new Set<string>()
  let target = first
  let paid: Commitment | null = null
  for (let arc = 0; ; arc++) {
    hit.add(target.id)
    attackEnemy(engine, caster, target, {
      title: 'Chain Lightning',
      attribute: 'intelligence',
      damage: CHAIN_LIGHTNING_DAMAGE,
      intro:
        arc === 0
          ? `${caster.name} hurls lightning at ${target.name}.`
          : `The lightning arcs to ${target.name}.`,
    })
    if (paid) releaseCommitment(caster, paid)
    paid = null
    const cost = CHAIN_LIGHTNING_EXTRA_COST[arc]
    const options = livingEnemies(engine.b).filter((e) => !hit.has(e.id))
    if (engine.b.result !== 'ongoing' || cost === undefined || options.length === 0) return
    if (resourceAvailable(caster, 'mana') < cost) return

    const answer = engine.ask({
      abilityId: 'chainLightning',
      reactorKey: caster.key,
      title: 'Chain Lightning',
      prompt: `Spend ${cost} more Mana to arc to another enemy?`,
      cost: `${cost} Mana`,
      targets: enemyTargets(options),
    })
    if (!answer.use) return
    target = options.find((e) => e.id === answer.targetId) ?? options[0]
    paid = commitResource(caster, 'mana', cost)
    if (!paid) return
  }
}

/** Swaps engagement groups with another character or an enemy, with no test. */
export function transpose(engine: Engine, caster: BattlePlayer, targetId: string, targetName: string) {
  const { b } = engine
  const mine = groupOf(b, caster.key)
  const theirs = groupOf(b, targetId)
  moveToGroup(b, caster.key, theirs)
  moveToGroup(b, targetId, mine)
  addStep(engine, {
    actor: playerActorOf(caster),
    title: 'Transpose',
    intro: `${caster.name} twists the space between them and ${targetName}.`,
    outcome:
      mine === theirs
        ? `They trade places, but they were already in the same group.`
        : `${caster.name} and ${targetName} trade engagement groups.`,
    tone: 'success',
  })
}

/** Draws exactly five tokens with no test. Mana goes into play, Complications hurt, the rest return. */
export function arcaneFocus(engine: Engine, caster: BattlePlayer) {
  const drawn = drawExactly(caster.bag, ARCANE_FOCUS_TOKENS, engine.rng)
  const mana = drawn.filter((d) => d.tokenId === 'mana').length
  const complications = drawn.filter((d) => d.tokenId === 'complication').length
  caster.bag = adjustBag(caster.bag, 'mana', -mana)
  caster.resources = { ...caster.resources, mana: (caster.resources.mana ?? 0) + mana }
  takeDamage(caster, complications, true)
  updateResult(engine.b)

  const test: SkillTestOutcome = {
    attribute: 'intelligence',
    attributeValue: 0,
    difficulty: 0,
    penalty: 0,
    bonuses: [],
    result: { drawn, total: 0, outcome: 'normal', complication: false },
    total: 0,
    passed: true,
  }
  const falls = caster.hp === 0 ? ` ${caster.name} falls!` : ''
  addStep(engine, {
    actor: playerActorOf(caster),
    title: 'Arcane Focus',
    intro: `${caster.name} reaches into the weave and pulls out ${drawn.length} tokens.`,
    test,
    testMode: 'score',
    testHeading: 'No test: the tokens only recover Mana',
    resultLine: `${mana} Mana into play, ${complications} Complication${complications === 1 ? '' : 's'}`,
    outcome:
      complications > 0
        ? `${caster.name} recovers ${mana} Mana and takes ${complications} damage (${caster.hp}/${caster.maxHp} HP).${falls}`
        : `${caster.name} recovers ${mana} Mana.`,
    tone: complications > 0 ? 'failure' : mana > 0 ? 'success' : 'neutral',
  })
}
