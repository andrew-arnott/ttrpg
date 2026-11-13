import { drawExactly } from '../drawTest'
import type { SkillTestOutcome } from '../skillTest'
import { takeDamage } from '../characterTest'
import { adjustBag } from '../tokenFlow'
import { attackEnemy, chainReaction, intelligenceVolley, spellBacklash } from './effects'
import {
  addStep,
  describeGroup,
  enemiesInGroup,
  groupOf,
  playersInGroup,
  livingEnemies,
  moveToGroup,
  playerActorOf,
  updateResult,
  type Engine,
} from './state'
import { enemyTargets } from './targets'
import { sealPulse } from './pulses'
import { commitResource, releaseCommitment, resourceAvailable, type Commitment } from './tokens'
import type { BattleEnemy, BattlePlayer } from './types'

export const CHAIN_LIGHTNING_DAMAGE = 2
/** Extra Mana to arc to the next enemy: 2 for the second, 3 for the third, and one more each time after. */
export const chainLightningExtraCost = (arc: number) => arc + 2
export const GRAVITY_WELL_DAMAGE = 1
export const ARCANE_FOCUS_TOKENS = 5

/**
 * Attacks the first enemy, then offers to spend more Mana to arc to a different one, for as long as there
 * are enemies left and Mana to pay. Each target needs its own Intelligence test, and the caster decides after seeing the last.
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
    if (target.hp <= 0) chainReaction(engine, caster, [target])
    if (paid) releaseCommitment(caster, paid)
    paid = null
    const cost = chainLightningExtraCost(arc)
    const options = livingEnemies(engine.b).filter((e) => !hit.has(e.id))
    if (engine.b.result !== 'ongoing' || options.length === 0) return
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

/**
 * Gravity Well: merges two engagement groups into one, then makes one Intelligence attack against every
 * enemy in it for 1 damage each. Allies in the new group take 1 damage automatically.
 */
export function gravityWell(engine: Engine, caster: BattlePlayer, groupA: string, groupB: string) {
  const { b } = engine
  const before = `${describeGroup(b, groupA)} and ${describeGroup(b, groupB)}`
  if (groupA !== groupB) {
    for (const [id, group] of Object.entries(b.groups)) if (group === groupB) moveToGroup(b, id, groupA)
  }
  addStep(engine, {
    actor: playerActorOf(caster),
    title: 'Gravity Well',
    intro: `${caster.name} warps the space between two groups.`,
    outcome: `${before} are pulled into one group.`,
    tone: 'success',
  })

  const fallen = intelligenceVolley(engine, caster, groupA, {
    title: 'Gravity Well',
    intro: `The new group is crushed together. One result is compared with every enemy's Defense.`,
    damage: GRAVITY_WELL_DAMAGE,
    dodge: 'slips the pressure.',
  })
  chainReaction(engine, caster, fallen)

  const crushed = playersInGroup(b, groupA)
  if (crushed.length > 0) {
    const lines = spellBacklash(engine, caster, crushed, GRAVITY_WELL_DAMAGE)
    addStep(engine, {
      actor: playerActorOf(caster),
      title: 'Crushing weight',
      intro: 'Gravity does not pick sides.',
      outcome: `${lines.join('; ')}.`,
      tone: 'failure',
    })
    updateResult(b)
  }
}

/** Dissonant Pulse: seals 2 Mana on a group, lowering every enemy's Defense in it by the Mana sealed there. */
export function dissonantPulse(engine: Engine, caster: BattlePlayer, groupId: string, commit: Commitment) {
  const { b } = engine
  sealPulse(b, caster, groupId, commit)
  const enemies = enemiesInGroup(b, groupId)
  const penalty = enemies[0]?.defensePenalty ?? 0
  addStep(engine, {
    actor: playerActorOf(caster),
    title: 'Dissonant Pulse',
    intro: `${caster.name} sets the air around ${describeGroup(b, groupId)} humming out of tune.`,
    outcome: `2 Mana is sealed there. Each enemy in the group has -${penalty} Defense until the group changes or the Mana returns.`,
    tone: 'success',
  })
}
