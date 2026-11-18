import type { Ability, AttackKind } from '../../data/types'
import { weaponAttackKind } from '../../data/weapons'
import { isQuarry } from './quarry'
import { enemiesInGroup, distinctGroupIds, describeGroup, enemyDefense, groupOf, livingPlayers, playersInGroup, tokenName, parseCost } from './state'
import { resourceAvailable } from './tokens'
import { NEW_GROUP } from './types'
import type { BattleEnemy, BattlePlayer, BattleState, TargetChoice } from './types'

export const NOT_ENGAGED = 'Not engaged'
export const ENGAGED = 'Engaged with you'
export const TOO_CLOSE = 'Engaged: too close for a ranged attack'

/** Enemies as choices. `unavailable` says why one cannot be picked; those stay listed but disabled. */
export function enemyTargets(
  list: BattleEnemy[],
  unavailable: (e: BattleEnemy) => string | undefined = () => undefined,
): TargetChoice[] {
  return list.map((e) => ({
    id: e.id,
    label: `${e.name} (${e.hp}/${e.maxHp} HP, Defense ${enemyDefense(e)})`,
    disabledReason: unavailable(e),
  }))
}

/** Only enemies in the player's own engagement group can be picked. */
export const onlyEngaged = (b: BattleState, p: BattlePlayer) => {
  const engaged = enemiesInGroup(b, groupOf(b, p.key))
  return (e: BattleEnemy) => (engaged.includes(e) ? undefined : NOT_ENGAGED)
}

/**
 * Which enemies an attack can reach. A melee attack needs an enemy you are engaged with, a ranged attack one you
 * are not (except your Quarry, with Keen Eye), and either reaches anyone.
 */
export function attackReach(b: BattleState, p: BattlePlayer, kind: AttackKind | undefined): (e: BattleEnemy) => string | undefined {
  const engaged = enemiesInGroup(b, groupOf(b, p.key))
  return (e) => {
    const close = engaged.includes(e)
    if (kind === 'melee') return close ? undefined : NOT_ENGAGED
    if (kind === 'ranged') return close && !(p.abilityIds.includes('keenEye') && isQuarry(e, p)) ? TOO_CLOSE : undefined
    return undefined
  }
}

/** The kind of attack an ordinary attack with the weapon in hand is. */
export const weaponKind = (p: BattlePlayer): AttackKind => weaponAttackKind(p.hands)

/** The ability itself is unavailable when every target is. */
export function noUsableTarget(targets: TargetChoice[] | undefined): string | undefined {
  if (!targets || targets.length === 0 || targets.some((t) => !t.disabledReason)) return undefined
  const reason = targets[0].disabledReason
  return reason === NOT_ENGAGED
    ? 'No enemy you are engaged with'
    : reason === TOO_CLOSE
      ? 'No enemy you are not engaged with'
      : (reason ?? 'No valid target')
}

export function groupTargets(b: BattleState, p: BattlePlayer, includeOwn: boolean): TargetChoice[] {
  const own = groupOf(b, p.key)
  const others = distinctGroupIds(b)
    .filter((g) => includeOwn || g !== own)
    .map((g) => ({ id: g, label: describeGroup(b, g) }))
  const aloneNow = playersInGroup(b, own).length === 1 && enemiesInGroup(b, own).length === 0
  return aloneNow ? others : [...others, { id: NEW_GROUP, label: 'Break away alone' }]
}

export const allyTargets = (b: BattleState): TargetChoice[] =>
  livingPlayers(b).map((a) => ({ id: a.key, label: `${a.name} (${a.hp}/${a.maxHp} HP)` }))

export function resourceGate(p: BattlePlayer, ability: Ability): string | undefined {
  const cost = parseCost(ability.cost)
  if (!cost) return undefined
  return resourceAvailable(p, cost.tokenId) < cost.amount ? `Needs ${cost.amount} ${tokenName(cost.tokenId)}` : undefined
}
