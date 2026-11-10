import { canUseFastOrTriggered } from '../conditionRules'
import { canReact, payForReaction, type Cost } from '../reactorRules'
import { releaseCommitment, resourceAvailable, type Commitment } from '../tokenFlow'
import type { Engine } from './state'
import type { BattleEnemy, BattlePlayer, ReactionRequest } from './types'

export const INTERCEPT_DEFENSE = 2

const INTERCEPT_COST: Cost = { tokenId: 'resolve', amount: 1 }

export interface Interception {
  interceptor: BattlePlayer
  commit: Commitment
}

/** An ally with Intercept may take a single-target attack meant for someone else. */
export function offerIntercept(
  engine: Engine,
  attacker: BattleEnemy,
  attackName: string,
  target: BattlePlayer,
): Interception | null {
  for (const candidate of engine.b.players) {
    if (candidate.key === target.key || !canReact(candidate, 'intercept', INTERCEPT_COST)) continue
    const request: ReactionRequest = {
      abilityId: 'intercept',
      reactorKey: candidate.key,
      title: 'Intercept',
      prompt: `${attacker.name} is about to hit ${target.name} with ${attackName}. ${candidate.name} can step in and take the attack instead, with +${INTERCEPT_DEFENSE} Defense against it.`,
      cost: '1 Resolve',
    }
    if (engine.ask(request).use) return { interceptor: candidate, commit: payForReaction(candidate, INTERCEPT_COST) }
  }
  return null
}

export interface Cover {
  /** The Attack value left once the Shield Wall has taken what it can. */
  remaining: number
  note: string
}

/**
 * A warrior who used Shield Wall this round may spend their Defense score on an attack against an
 * ally in the same group. Whatever the score cannot cover is set against the ally's own Defense.
 */
export function offerShieldWall(
  engine: Engine,
  attacker: BattleEnemy,
  attackName: string,
  target: BattlePlayer,
  value: number,
): Cover {
  let remaining = value
  const notes: string[] = []
  for (const guard of engine.b.players) {
    const sameGroup = engine.b.groups[guard.key] === engine.b.groups[target.key]
    if (remaining <= 0) break
    if (guard.key === target.key || !guard.shieldWall || guard.defense <= 0 || guard.hp <= 0 || !sameGroup) continue
    const request: ReactionRequest = {
      abilityId: 'shieldWall',
      reactorKey: guard.key,
      title: 'Shield Wall',
      prompt: `${attacker.name} attacks ${target.name} with ${attackName} (Attack ${remaining}). ${guard.name} can cover them with a Defense score of ${guard.defense}.`,
      cost: 'free',
    }
    if (!engine.ask(request).use) continue
    const absorbed = Math.min(guard.defense, remaining)
    guard.defense -= absorbed
    remaining -= absorbed
    notes.push(`${guard.name}'s Shield Wall absorbs ${absorbed}`)
  }
  return { remaining, note: notes.length > 0 ? `, ${notes.join(', ')}` : '' }
}

const LAST_STAND_COST: Cost = { tokenId: 'resolve', amount: 1 }

/** A warrior who has just been brought to 0 HP may spend 1 Resolve to stay on their feet at 1 HP instead. */
export function offerLastStand(engine: Engine, p: BattlePlayer): boolean {
  if (p.hp > 0 || !p.abilityIds.includes('lastStand') || !canUseFastOrTriggered(p)) return false
  if (resourceAvailable(p, LAST_STAND_COST.tokenId) < LAST_STAND_COST.amount) return false
  const request: ReactionRequest = {
    abilityId: 'lastStand',
    reactorKey: p.key,
    title: 'Last Stand',
    prompt: `${p.name} has been brought down to 0 HP. Last Stand spends 1 Resolve to stay on their feet at 1 HP instead.`,
    cost: '1 Resolve',
  }
  if (!engine.ask(request).use) return false
  releaseCommitment(p, payForReaction(p, LAST_STAND_COST))
  p.hp = 1
  return true
}
