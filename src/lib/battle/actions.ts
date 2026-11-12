import { attackProfile } from '../../data/weapons'
import { describeAttack } from './attackPlan'
import { ABILITY_HANDLERS, unsupportedAbility } from './abilities'
import { canAttack, canUseFastOrTriggered } from './conditionRules'
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
import { enemyTargets, groupTargets, noUsableTarget, onlyEngaged, resourceGate } from './targets'
import type { BattlePlayer, BattleState, CombatOption, PlannedCombat } from './types'

const FEAR_REASON = 'Fear: you cannot attack'
const INSANITY_REASON = 'Insanity: no Fast abilities'

function abilityOptions(b: BattleState, p: BattlePlayer): CombatOption[] {
  return p.abilityIds
    .flatMap((id) => abilityById(id) ?? [])
    .filter((ability) => !(ability.types.length === 1 && ['Interval', 'Triggered', 'Passive'].includes(ability.types[0])))
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
      const fights = ability.types.includes('Fight')
      const boost = fights
        ? boostOption(p, 'power')
        : ability.types.includes('Defend')
          ? boostOption(p, 'armor')
          : undefined
      const blocked = fights && !canAttack(p) ? FEAR_REASON : ability.types.includes('Fast') && !canUseFastOrTriggered(p) ? INSANITY_REASON : undefined
      return options.map((o) => ({
        ...o,
        ...(boost ? { boost } : {}),
        disabledReason: o.disabledReason ?? blocked,
      }))
    })
}

/** An option with targets cannot be used when none of them can be picked. */
const withTargetGate = (o: CombatOption): CombatOption => ({
  ...o,
  disabledReason: o.disabledReason ?? noUsableTarget(o.targets),
})

export function availableCombatActions(b: BattleState, p: BattlePlayer): CombatOption[] {
  return listCombatActions(b, p).map(withTargetGate)
}

function listCombatActions(b: BattleState, p: BattlePlayer): CombatOption[] {
  const weapon = attackProfile(p.hands)
  const groups = groupTargets(b, p, false)
  return [
    {
      id: 'attack',
      slot: 'action',
      label: 'Attack',
      description: describeAttack(p),
      targets: enemyTargets(livingEnemies(b), weapon.ranged ? undefined : onlyEngaged(b, p)),
      boost: boostOption(p, 'power'),
      disabledReason: !canAttack(p) ? FEAR_REASON : livingEnemies(b).length === 0 ? 'No enemy to target' : undefined,
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
        'Move to another engagement group. If an enemy has you engaged this takes an Agility test, with a Difficulty that depends on who is in the groups. If nothing is engaged with you, you just move.',
      targets: groups.map((g) => ({ ...g, label: engageTargetLabel(b, p, g.id, g.label) })),
      disabledReason: groups.length === 0 ? 'Nowhere to go' : undefined,
    },
    ...abilityOptions(b, p),
  ]
}

function isValid(b: BattleState, p: BattlePlayer, planned: PlannedCombat): CombatOption | undefined {
  const option = availableCombatActions(b, p).find((o) => o.id === planned.actionId)
  if (!option || option.disabledReason) return undefined
  if (option.targets && !option.targets.some((t) => t.id === planned.targetId && !t.disabledReason)) return undefined
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

/** What to pre-select for a player: attack if they can, otherwise defend. A ranged weapon prefers an enemy it is not at close quarters with. */
export function suggestedAction(b: BattleState, p: BattlePlayer): PlannedCombat {
  if (!canAttack(p)) return { actionId: 'defend' }
  const engaged = engagedEnemies(b, p)
  const target = attackProfile(p.hands).ranged
    ? (livingEnemies(b).find((e) => !engaged.includes(e)) ?? engaged[0])
    : engaged[0]
  return target ? { actionId: 'attack', targetId: target.id } : { actionId: 'defend' }
}
