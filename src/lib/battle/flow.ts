import type { Rng } from '../drawTest'
import type { ResolutionStep } from '../resolution'
import { availableCombatActions, performAction } from './actions'
import { actionsThisTurn } from './conditionRules'
import { releaseAtRoundEnd } from './conditions'
import { returnSealedResolve } from './sealedResolve'
import { enemyActions, resetRoundState } from './enemies'
import { offerFollowUps } from './followUps'
import { addStep, createEngine, finalStep, type Engine } from './state'
import { runReplayable } from '../replay'
import { ACTIONS_PER_TURN } from './types'
import type { BattleFlow, BattlePlayer, BattleState, PlannedCombat, ReactionAnswer } from './types'

/** The player who is choosing an action right now, if any. */
export function currentPlayer(b: BattleState): BattlePlayer | null {
  if (b.result !== 'ongoing' || b.phase !== 'players' || b.pending) return null
  const p = b.players[b.turnIndex]
  return p && p.hp > 0 ? p : null
}

function advanceTurn(b: BattleState) {
  const current = b.players[b.turnIndex]
  if (current && current.hp > 0 && b.actionsUsed < actionsThisTurn(current, b.round)) return
  const next = b.players.findIndex((p, i) => i > b.turnIndex && p.hp > 0)
  b.actionsUsed = 0
  b.turnStarted = false
  if (next === -1) {
    b.phase = 'enemies'
  } else {
    b.turnIndex = next
  }
}

/** Start-of-turn effects happen once, just before the player's first action of the turn. */
function startTurn(engine: Engine, p: BattlePlayer) {
  if (engine.b.turnStarted) return
  engine.b.turnStarted = true
  returnSealedResolve(engine, p)
}

type Outcome = { battle: BattleState; steps: ResolutionStep[] }

function playerActionFlow(engine: Engine, planned: PlannedCombat | null) {
  const { b } = engine
  b.opening = []
  const p = currentPlayer(b)
  if (!p) return

  startTurn(engine, p)
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

function endTurnFlow(engine: Engine) {
  const { b } = engine
  b.opening = []
  const p = currentPlayer(b)
  if (!p) return
  startTurn(engine, p)
  b.actionsUsed = ACTIONS_PER_TURN
  advanceTurn(b)
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
  if (b.result === 'ongoing') releaseAtRoundEnd(engine)

  if (b.result === 'ongoing') {
    b.round += 1
    b.phase = 'players'
    b.turnIndex = Math.max(0, b.players.findIndex((p) => p.hp > 0))
    b.actionsUsed = 0
    b.turnStarted = false
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
 * used the player's answer is looked up in `answers`; when there is none yet the run stops
 * and the battle is returned with `pending` set (see `runReplayable`).
 */
function runFlow(
  snapshot: BattleState,
  flow: BattleFlow,
  rng: Rng,
  tape: number[],
  answers: ReactionAnswer[],
  stepsShown: number,
): Outcome {
  const initial = createEngine(structuredClone(snapshot), rng)
  const replayed = runReplayable<BattleState>({
    rng,
    tape,
    answers,
    stepsShown,
    initial: { state: initial.b, steps: initial.steps },
    run: ({ rng: dice, ask, progress }) => {
      const engine = createEngine(structuredClone(snapshot), dice)
      engine.ask = ask
      progress.state = engine.b
      progress.steps = engine.steps
      if (flow.kind === 'action') playerActionFlow(engine, flow.planned)
      else if (flow.kind === 'endTurn') endTurnFlow(engine)
      else enemyPhaseFlow(engine)
      return { state: engine.b, steps: engine.steps }
    },
  })
  const { pause } = replayed
  replayed.state.pending = pause ? { ...pause, snapshot, flow, answers } : null
  return { battle: replayed.state, steps: replayed.steps }
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
export function endTurn(battle: BattleState, rng: Rng): Outcome {
  if (battle.pending) return { battle, steps: [] }
  return runFlow(battle, { kind: 'endTurn' }, rng, [], [], 0)
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
