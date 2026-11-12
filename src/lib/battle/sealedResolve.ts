import { adjustBag, addStep, playerActorOf, sealedCount, type Engine } from './state'
import type { BattleEnemy, BattlePlayer, ReactionRequest } from './types'

const ownResolve = (e: BattleEnemy, p: BattlePlayer) =>
  e.sealed.filter((s) => s.byKey === p.key && (s.as ?? s.tokenId) === 'resolve')

/** Takes one of the player's sealed Resolve tokens off the enemy and puts it in their bag. */
function returnOne(p: BattlePlayer, e: BattleEnemy) {
  const token = ownResolve(e, p)[0]
  e.sealed.splice(e.sealed.indexOf(token), 1)
  p.bag = adjustBag(p.bag, token.tokenId, 1)
  if (ownResolve(e, p).length === 0 && e.provokedBy === p.key) e.provokedBy = null
  if (sealedCount(e, 'resolve') === 0) e.disabled = false
}

/** Relentless Pressure lets the Warrior pick the one enemy that returns a token. */
function chooseEnemy(engine: Engine, p: BattlePlayer, holding: BattleEnemy[]): BattleEnemy {
  if (holding.length === 1) return holding[0]
  const request: ReactionRequest = {
    abilityId: 'relentlessPressure',
    reactorKey: p.key,
    title: 'Relentless Pressure',
    prompt: `${p.name}'s turn begins. Only 1 sealed Resolve returns this turn. Choose which enemy returns it.`,
    cost: 'free',
    targets: holding.map((e) => ({ id: e.id, label: `${e.name} (${ownResolve(e, p).length} of your Resolve sealed)` })),
    required: true,
    confirmLabel: 'Return it',
  }
  const answer = engine.ask(request)
  return holding.find((e) => e.id === answer.targetId) ?? holding[0]
}

/**
 * At the start of a player's turn each enemy holding one or more of their sealed Resolve returns 1 of
 * those tokens to their bag. With Relentless Pressure only 1 returns in total, from an enemy they choose.
 */
export function returnSealedResolve(engine: Engine, p: BattlePlayer) {
  const holding = engine.b.enemies.filter((e) => e.hp > 0 && ownResolve(e, p).length > 0)
  if (holding.length === 0) return
  const returning = p.abilityIds.includes('relentlessPressure') ? [chooseEnemy(engine, p, holding)] : holding
  returning.forEach((e) => returnOne(p, e))
  addStep(engine, {
    actor: playerActorOf(p),
    title: 'Start of turn',
    intro: `${p.name}'s turn begins.`,
    outcome: `${returning.map((e) => e.name).join(', ')} return${returning.length === 1 ? 's' : ''} 1 sealed Resolve to ${p.name}'s bag.`,
    tone: 'success',
  })
}
