import type { Rng } from '../drawTest'
import type { ResolutionStep } from '../resolution'
import { availableCombatActions, performAction } from './actions'
import { enemyActions, resetRoundState } from './enemies'
import { offerFollowUps } from './followUps'
import { addStep, createEngine, finalStep, type Engine } from './state'
import { ACTIONS_PER_TURN } from './types'
import type { BattleFlow, BattlePlayer, BattleState, PlannedCombat, ReactionAnswer, ReactionRequest } from './types'

/** The player who is choosing an action right now, if any. */
export function currentPlayer(b: BattleState): BattlePlayer | null {
  if (b.result !== 'ongoing' || b.phase !== 'players' || b.pending) return null
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

/** Thrown out of an action when a player has to decide something before it can finish. */
class NeedsAnswer extends Error {
  request: ReactionRequest

  constructor(request: ReactionRequest) {
    super('A player has to decide whether to react')
    this.request = request
  }
}

type Outcome = { battle: BattleState; steps: ResolutionStep[] }

function playerActionFlow(engine: Engine, planned: PlannedCombat | null) {
  const { b } = engine
  b.opening = []
  const p = currentPlayer(b)
  if (!p) return

  let free = false
  if (planned) {
    free = availableCombatActions(b, p).find((o) => o.id === planned.actionId)?.slot === 'fast'
    performAction(engine, p, planned)
    offerFollowUps(engine)
  }
  if (!free) b.actionsUsed += 1

  if (b.result === 'ongoing') advanceTurn(b)
  finalStep(engine)
}

function enemyPhaseFlow(engine: Engine) {
  const { b } = engine
  b.opening = []
  if (b.result !== 'ongoing' || b.phase !== 'enemies') return

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
}

/**
 * Runs an action or the enemy phase from `snapshot`. Each time a Triggered ability could be
 * used the player's answer is looked up in `answers`; when there is none yet the run stops,
 * the battle is returned with `pending` set, and only the steps not yet played are returned.
 * Answering runs the same flow again from the snapshot, replaying the recorded dice, so the
 * outcome up to the question is identical.
 */
function runFlow(
  snapshot: BattleState,
  flow: BattleFlow,
  rng: Rng,
  tape: number[],
  answers: ReactionAnswer[],
  stepsShown: number,
): Outcome {
  const recorded = [...tape]
  let diceUsed = 0
  let asked = 0
  const engine = createEngine(structuredClone(snapshot), () => {
    if (diceUsed >= recorded.length) recorded.push(rng())
    return recorded[diceUsed++]
  })
  engine.ask = (request) => {
    const answer = answers[asked]
    if (!answer) throw new NeedsAnswer(request)
    asked += 1
    return answer
  }

  try {
    if (flow.kind === 'action') playerActionFlow(engine, flow.planned)
    else enemyPhaseFlow(engine)
  } catch (error) {
    if (!(error instanceof NeedsAnswer)) throw error
    const pending = { request: error.request, snapshot, flow, tape: recorded, answers, stepsShown: engine.steps.length }
    return { battle: { ...engine.b, pending }, steps: engine.steps.slice(stepsShown) }
  }
  engine.b.pending = null
  return { battle: engine.b, steps: engine.steps.slice(stepsShown) }
}

/**
 * Resolves the current player's choice and moves on. `null` skips the action. A Fast
 * ability is free, so it resolves without using up one of the player's actions. If a
 * Triggered ability could be used, the result has `pending` set until `respondToReaction`.
 */
export function takeAction(battle: BattleState, planned: PlannedCombat | null, rng: Rng): Outcome {
  if (battle.pending) return { battle, steps: [] }
  return runFlow(battle, { kind: 'action', planned }, rng, [], [], 0)
}

/** The current player gives up their remaining actions this round. */
export function endTurn(battle: BattleState): BattleState {
  if (battle.pending) return battle
  const b = structuredClone(battle)
  if (!currentPlayer(b)) return b
  b.actionsUsed = ACTIONS_PER_TURN
  advanceTurn(b)
  return b
}

/** Every player has acted: the enemies attack in random order, Defense resets, and a new round begins. */
export function runEnemyPhase(battle: BattleState, rng: Rng): Outcome {
  if (battle.pending) return { battle, steps: [] }
  return runFlow(battle, { kind: 'enemies' }, rng, [], [], 0)
}

/** Gives the answer to the waiting question and carries on with whatever was interrupted. */
export function respondToReaction(battle: BattleState, answer: ReactionAnswer, rng: Rng): Outcome {
  const { pending } = battle
  if (!pending) return { battle, steps: [] }
  return runFlow(
    pending.snapshot,
    pending.flow,
    rng,
    pending.tape,
    [...pending.answers, answer],
    pending.stepsShown,
  )
}
