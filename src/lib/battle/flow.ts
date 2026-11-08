import type { Rng } from '../drawTest'
import type { ResolutionStep } from '../resolution'
import { availableCombatActions, performAction } from './actions'
import { enemyActions, resetRoundState } from './enemies'
import { addStep, finalStep, type Engine } from './state'
import { ACTIONS_PER_TURN } from './types'
import type { BattlePlayer, BattleState, PlannedCombat } from './types'

/** The player who is choosing an action right now, if any. */
export function currentPlayer(b: BattleState): BattlePlayer | null {
  if (b.result !== 'ongoing' || b.phase !== 'players') return null
  const p = b.players[b.turnIndex]
  return p && p.hp > 0 ? p : null
}

function advanceTurn(b: BattleState) {
  const current = b.players[b.turnIndex]
  if (b.actionsUsed < ACTIONS_PER_TURN && current && current.hp > 0) return
  const next = b.players.findIndex((p, i) => i > b.turnIndex && p.hp > 0)
  b.actionsUsed = 0
  if (next === -1) {
    b.phase = 'enemies'
  } else {
    b.turnIndex = next
  }
}

/**
 * Resolves the current player's choice and moves on. `null` skips the action. A Fast
 * ability is free, so it resolves without using up one of the player's actions.
 */
export function takeAction(
  battle: BattleState,
  planned: PlannedCombat | null,
  rng: Rng,
): { battle: BattleState; steps: ResolutionStep[] } {
  const engine: Engine = { b: structuredClone(battle), rng, steps: [] }
  const { b } = engine
  b.opening = []
  const p = currentPlayer(b)
  if (!p) return { battle: b, steps: [] }

  let free = false
  if (planned) {
    free = availableCombatActions(b, p).find((o) => o.id === planned.actionId)?.slot === 'fast'
    performAction(engine, p, planned)
  }
  if (!free) b.actionsUsed += 1

  if (b.result === 'ongoing') advanceTurn(b)
  finalStep(engine)
  return { battle: b, steps: engine.steps }
}

/** The current player gives up their remaining actions this round. */
export function endTurn(battle: BattleState): BattleState {
  const b = structuredClone(battle)
  if (!currentPlayer(b)) return b
  b.actionsUsed = ACTIONS_PER_TURN
  advanceTurn(b)
  return b
}

/** Every player has acted: the enemies attack in random order, Defense resets, and a new round begins. */
export function runEnemyPhase(
  battle: BattleState,
  rng: Rng,
): { battle: BattleState; steps: ResolutionStep[] } {
  const engine: Engine = { b: structuredClone(battle), rng, steps: [] }
  const { b } = engine
  b.opening = []
  if (b.result !== 'ongoing' || b.phase !== 'enemies') return { battle: b, steps: [] }

  addStep(engine, {
    actor: null,
    title: 'Enemy phase',
    intro: 'Every adventurer has acted.',
    outcome: 'Now the enemies strike back!',
    tone: 'failure',
  })
  enemyActions(engine)
  resetRoundState(b)

  if (b.result === 'ongoing') {
    b.round += 1
    b.phase = 'players'
    b.turnIndex = Math.max(0, b.players.findIndex((p) => p.hp > 0))
    b.actionsUsed = 0
    addStep(engine, {
      actor: null,
      title: 'Round ends',
      intro: 'The dust settles for a moment.',
      outcome: `Defense scores reset. Round ${b.round} begins.`,
      tone: 'neutral',
    })
  }
  finalStep(engine)
  return { battle: b, steps: engine.steps }
}
