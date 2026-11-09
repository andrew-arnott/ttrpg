import type { Rng } from './drawTest'
import type { ReactionAnswer, ReactionRequest } from './reactionTypes'
import type { ResolutionStep } from './resolution'

export type Ask = (request: ReactionRequest) => ReactionAnswer

/** Thrown out of a run when a player has to decide something before it can finish. */
class NeedsAnswer extends Error {
  request: ReactionRequest

  constructor(request: ReactionRequest) {
    super('A player has to decide whether to react')
    this.request = request
  }
}

/** What a run reports as it goes, so that a stopped run can still say where it got to. */
export interface Progress<S> {
  state: S
  steps: ResolutionStep[]
}

export interface Pause {
  request: ReactionRequest
  /** The dice rolled so far. */
  tape: number[]
  /** How many steps the run had produced when it stopped. */
  stepsShown: number
}

export interface Replayed<S> {
  state: S
  /** Steps produced since `stepsShown`. */
  steps: ResolutionStep[]
  /** Set when the run stopped to ask a question. */
  pause: Pause | null
}

interface ReplayArgs<S> {
  rng: Rng
  /** Dice from an earlier run of the same flow, repeated before any new ones are rolled. */
  tape: number[]
  /** Answers given so far, in the order the questions come up. */
  answers: ReactionAnswer[]
  stepsShown: number
  /**
   * Runs the flow. It rolls with `rng`, calls `ask` wherever a player might react, and keeps
   * `progress` pointing at its current state and steps.
   */
  run: (io: { rng: Rng; ask: Ask; progress: Progress<S> }) => Progress<S>
  /** The state to report if the run stops before it has set any. */
  initial: Progress<S>
}

/**
 * Runs a flow that may need to ask a player something partway through. The flow is a function
 * of its starting state, so when a question has no answer yet the run stops and reports it.
 * Running the same flow again with the answer repeats the recorded dice, which makes the outcome
 * up to the question identical, and carries on beyond it. Only the steps after `stepsShown`
 * come back, since the earlier ones have already been played.
 */
export function runReplayable<S>(args: ReplayArgs<S>): Replayed<S> {
  const recorded = [...args.tape]
  let diceUsed = 0
  let asked = 0
  const rng: Rng = () => {
    if (diceUsed >= recorded.length) recorded.push(args.rng())
    return recorded[diceUsed++]
  }
  const ask: Ask = (request) => {
    const answer = args.answers[asked]
    if (!answer) throw new NeedsAnswer(request)
    asked += 1
    return answer
  }
  const progress: Progress<S> = { ...args.initial }

  try {
    const done = args.run({ rng, ask, progress })
    return { state: done.state, steps: done.steps.slice(args.stepsShown), pause: null }
  } catch (error) {
    if (!(error instanceof NeedsAnswer)) throw error
    return {
      state: progress.state,
      steps: progress.steps.slice(args.stepsShown),
      pause: { request: error.request, tape: recorded, stepsShown: progress.steps.length },
    }
  }
}
