import { PROFESSIONS } from '../../data/professions'
import { TOKENS } from '../../data/tokens'
import type { Ability } from '../../data/types'
import type { Rng } from '../drawTest'
import { adjustBag } from '../tokenFlow'
import { playerActor, type ResolutionStep, type StepActor } from '../resolution'
import type { BattleEnemy, BattlePlayer, BattleState } from './types'
import { LOG_LIMIT } from './types'

export const allAbilities: Ability[] = PROFESSIONS.flatMap((p) => [...p.abilities, ...p.explorationAbilities])
export const abilityById = (id: string): Ability | undefined => allAbilities.find((a) => a.id === id)

export const livingPlayers = (b: BattleState) => b.players.filter((p) => p.hp > 0)
export const livingEnemies = (b: BattleState) => b.enemies.filter((e) => e.hp > 0)

/** How much of a resource a player has sealed on an enemy, counting Expertise and Critical Success stand-ins. */
export { adjustBag }

export const sealedCount = (e: BattleEnemy, resourceId: string) =>
  e.sealed.filter((s) => (s.as ?? s.tokenId) === resourceId).reduce((sum, s) => sum + (s.value ?? 1), 0)

/** Exposed (Cunning sealed on the enemy) lowers its Defense. */
export const enemyDefense = (e: BattleEnemy) => Math.max(0, e.defense - sealedCount(e, 'cunning'))

export const playerByKey = (b: BattleState, key: string) => b.players.find((p) => p.key === key)
export const enemyById = (b: BattleState, id: string) => b.enemies.find((e) => e.id === id)

export const groupOf = (b: BattleState, id: string) => b.groups[id]

export const enemiesInGroup = (b: BattleState, groupId: string) =>
  livingEnemies(b).filter((e) => groupOf(b, e.id) === groupId)
export const playersInGroup = (b: BattleState, groupId: string) =>
  livingPlayers(b).filter((p) => groupOf(b, p.key) === groupId)

export const engagedEnemies = (b: BattleState, p: BattlePlayer) => enemiesInGroup(b, groupOf(b, p.key))

export function distinctGroupIds(b: BattleState): string[] {
  const living = new Set([...livingPlayers(b).map((p) => p.key), ...livingEnemies(b).map((e) => e.id)])
  return [...new Set(Object.entries(b.groups).filter(([id]) => living.has(id)).map(([, g]) => g))]
}

export interface EngagementGroup {
  id: string
  players: BattlePlayer[]
  enemies: BattleEnemy[]
}

/** Engagement groups that still have someone standing in them. */
export function engagementGroups(b: BattleState): EngagementGroup[] {
  return distinctGroupIds(b).map((id) => ({ id, players: playersInGroup(b, id), enemies: enemiesInGroup(b, id) }))
}

export function describeGroup(b: BattleState, groupId: string): string {
  const names = [...playersInGroup(b, groupId), ...enemiesInGroup(b, groupId)].map((c) => c.name)
  return names.length > 0 ? names.join(' + ') : 'empty group'
}

export const fmtSigned = (n: number) => (n > 0 ? `+${n}` : `${n}`)

export function shuffled<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export const pick = <T>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)]

export function parseCost(cost: string): { tokenId: string; amount: number } | null {
  const match = /^(\d+)\s+([A-Za-z]+)$/.exec(cost.trim())
  if (!match) return null
  return { tokenId: match[2].toLowerCase(), amount: Number(match[1]) }
}

export const tokenName = (tokenId: string) => TOKENS[tokenId]?.name ?? tokenId

export interface Engine {
  b: BattleState
  rng: Rng
  steps: ResolutionStep[]
}

export const playerActorOf = (p: BattlePlayer): StepActor => playerActor(p, p.colorIndex)

export const enemyActorOf = (e: BattleEnemy): StepActor => ({
  key: e.id,
  name: e.name,
  artKind: 'enemy',
  artId: e.defId,
  colorIndex: -1,
})

export function addStep(engine: Engine, step: ResolutionStep) {
  engine.steps.push(step)
  engine.b.log = [`${step.intro} ${step.outcome}`, ...engine.b.log].slice(0, LOG_LIMIT)
}

export function updateResult(b: BattleState) {
  if (livingEnemies(b).length === 0) b.result = 'victory'
  else if (livingPlayers(b).length === 0) b.result = 'defeat'
}

export function moveToGroup(b: BattleState, id: string, groupId: string) {
  b.groups[id] = groupId
}

export function newGroup(b: BattleState): string {
  b.nextGroup += 1
  return `g${b.nextGroup}`
}


export function finalStep(engine: Engine) {
  const { result } = engine.b
  if (result === 'ongoing') return
  addStep(engine, {
    actor: null,
    title: result === 'victory' ? 'Victory!' : 'Defeat',
    intro: result === 'victory' ? 'The last enemy falls.' : 'The party is overwhelmed.',
    outcome: result === 'victory' ? 'The fight is won.' : 'Every adventurer has fallen.',
    tone: result === 'victory' ? 'success' : 'failure',
  })
}

