import type { Ability } from '../../data/types'
import { enemiesInGroup, distinctGroupIds, describeGroup, enemyDefense, groupOf, livingPlayers, playersInGroup, tokenName, parseCost } from './state'
import { NEW_GROUP } from './types'
import type { BattleEnemy, BattlePlayer, BattleState, TargetChoice } from './types'

export function enemyTargets(list: BattleEnemy[], engaged: BattleEnemy[] = list): TargetChoice[] {
  return list.map((e) => ({
    id: e.id,
    label: `${e.name} (${e.hp}/${e.maxHp} HP, Defense ${enemyDefense(e)})${engaged.includes(e) ? '' : ', not engaged'}`,
  }))
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
  return (p.resources[cost.tokenId] ?? 0) < cost.amount ? `Needs ${cost.amount} ${tokenName(cost.tokenId)}` : undefined
}
