import { ABILITY_HANDLERS, unsupportedAbility } from './abilities'
import { attackEnemy, changeEngagement, defend } from './effects'
import {
  abilityById,
  addStep,
  enemyById,
  engagedEnemies,
  livingEnemies,
  parseCost,
  playerActorOf,
  playerByKey,
  type Engine,
} from './state'
import { engageTargetLabel } from './engagement'
import { boostOption, commitResource, resourceAvailable, commitmentValue, noCommitment, releaseCommitment, type Commitment } from './tokens'
import { enemyTargets, groupTargets, resourceGate } from './targets'
import type { BattlePlayer, BattleState, CombatOption, PlannedCombat } from './types'

function abilityOptions(b: BattleState, p: BattlePlayer): CombatOption[] {
  return p.abilityIds
    .flatMap((id) => abilityById(id) ?? [])
    .filter((ability) => !(ability.types.length === 1 && ['Interval', 'Triggered'].includes(ability.types[0])))
    .flatMap((ability) => {
      const handler = ABILITY_HANDLERS[ability.id] ?? unsupportedAbility
      const options = handler.options({
        b,
        p,
        id: `ability:${ability.id}`,
        gate: resourceGate(p, ability),
        base: {
          slot: ability.types.includes('Fast') ? 'fast' : 'action',
          label: ability.name,
          description: `${ability.cost !== '—' ? `${ability.cost}. ` : ''}${ability.text}`,
        },
      })
      const boost = ability.types.includes('Fight') ? boostOption(p, 'power') : undefined
      return boost ? options.map((o) => ({ ...o, boost })) : options
    })
}

export function availableCombatActions(b: BattleState, p: BattlePlayer): CombatOption[] {
  const engaged = engagedEnemies(b, p)
  const groups = groupTargets(b, p, false)
  return [
    {
      id: 'attack',
      slot: 'action',
      label: 'Attack',
      description: `Make a Strength test against an enemy you are engaged with, using its Defense. A hit deals 1 damage.`,
      targets: enemyTargets(livingEnemies(b), engaged),
      requiresEngaged: true,
      boost: boostOption(p, 'power'),
      disabledReason: livingEnemies(b).length === 0 ? 'No enemy to target' : undefined,
    },
    {
      id: 'defend',
      slot: 'action',
      label: 'Defend',
      description: 'Make an Agility test and add the result to your Defense score for the round.',
      boost: boostOption(p, 'armor'),
    },
    {
      id: 'engage',
      slot: 'action',
      label: 'Change engagement',
      description:
        'Make an Agility test to move to another engagement group. The Difficulty depends on who is in the groups.',
      targets: groups.map((g) => ({ ...g, label: engageTargetLabel(b, p, g.id, g.label) })),
      disabledReason: groups.length === 0 ? 'Nowhere to go' : undefined,
    },
    ...abilityOptions(b, p),
  ]
}

function isValid(b: BattleState, p: BattlePlayer, planned: PlannedCombat): CombatOption | undefined {
  const option = availableCombatActions(b, p).find((o) => o.id === planned.actionId)
  if (!option || option.disabledReason) return undefined
  if (option.targets && !option.targets.some((t) => t.id === planned.targetId)) return undefined
  if (option.requiresEngaged && !engagedEnemies(b, p).some((e) => e.id === planned.targetId)) return undefined
  return option
}

function noMove(engine: Engine, p: BattlePlayer) {
  addStep(engine, {
    actor: playerActorOf(p),
    title: 'No move',
    intro: `${p.name} hesitates.`,
    outcome: 'That is no longer possible, so the moment passes.',
    tone: 'neutral',
  })
}

/** Takes the Armor or Power the player chose out of play before the draw. */
function commitBoost(p: BattlePlayer, option: CombatOption, requested: number | undefined): Commitment {
  if (!option.boost || !requested) return noCommitment
  const amount = Math.min(requested, resourceAvailable(p, option.boost.tokenId))
  return commitResource(p, option.boost.tokenId, amount) ?? noCommitment
}

export function performAction(engine: Engine, p: BattlePlayer, planned: PlannedCombat) {
  const { b } = engine
  const option = isValid(b, p, planned)
  if (!option) return noMove(engine, p)

  const target = planned.targetId ?? ''
  const [, abilityId, extra] = option.id.split(':')
  const enemy = enemyById(b, target)
  const handler = abilityId ? ABILITY_HANDLERS[abilityId] : undefined
  if (abilityId && !handler) return

  const ability = abilityId ? abilityById(abilityId) : undefined
  const cost = handler?.costOf?.(extra) ?? (ability ? parseCost(ability.cost) : null)
  const commit = cost ? commitResource(p, cost.tokenId, cost.amount) : noCommitment
  if (!commit) return noMove(engine, p)
  const boostCommit = commitBoost(p, option, planned.boost)
  const boost = commitmentValue(boostCommit)

  if (option.id === 'attack' && enemy) {
    attackEnemy(engine, p, enemy, { power: boost })
  } else if (option.id === 'defend') {
    defend(engine, p, boost)
  } else if (option.id === 'engage') {
    changeEngagement(engine, p, target, true)
  } else if (handler) {
    handler.perform({ engine, p, target, extra, enemy, ally: playerByKey(b, target), commit, boost })
  }

  releaseCommitment(p, commit)
  releaseCommitment(p, boostCommit)
}

/** What to pre-select for a player: attack an engaged enemy if there is one, otherwise defend. */
export function suggestedAction(b: BattleState, p: BattlePlayer): PlannedCombat {
  const target = engagedEnemies(b, p)[0]
  return target ? { actionId: 'attack', targetId: target.id } : { actionId: 'defend' }
}
