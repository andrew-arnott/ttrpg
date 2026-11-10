import { releaseAllConditions } from '../characterTest'
import {
  burnTorchInterval,
  KEEP_WATCH,
  patrolCountdown,
  patrolIsDue,
  roomById,
  springPatrol,
  STAND_WATCH,
  withLog,
  type DungeonState,
  type PartyMember,
  type Watchfulness,
} from '../dungeonState'
import { drewComplication, type Rng } from '../drawTest'
import type { ReactionAnswer } from '../reactionTypes'
import { runReplayable } from '../replay'
import type { ResolutionStep } from '../resolution'
import { torchLevel } from '../torch'
import { abilityHandler } from './abilities'
import { BASIC_HANDLERS } from './basic'
import { applyComplication } from './complications'
import { keepWatch, type ActionHandler, type Context, type Resolution } from './context'
import type { ActionOption, InteractionPlan } from './types'
import { DEFAULT_ACTION } from './types'

export { memberAbilities } from './abilities'
export * from './types'

/** Action kinds in menu order. An action id is its kind, then the arguments after colons. */
const HANDLERS: Record<string, ActionHandler> = { ...BASIC_HANDLERS, ability: abilityHandler }

export function availableActions(state: DungeonState, member: PartyMember): ActionOption[] {
  return Object.values(HANDLERS).flatMap((handler) => handler.options(state, member))
}

function resolveAction(ctx: Context): Resolution {
  const [kind, ...args] = ctx.planned.actionId.split(':')
  const handler = HANDLERS[kind]
  return handler ? handler.perform(ctx, args) : keepWatch(ctx)
}

/**
 * Plays out one Interval: each character acts in party order on the state left by the one
 * before, then the torch burns down a step. Anything a character cannot actually do (a stale
 * plan, a missing torch) becomes Keep watch.
 */
function intervalFlow(
  state: DungeonState,
  plan: InteractionPlan,
  io: { rng: Rng; ask: Context['ask']; progress: { state: DungeonState; steps: ResolutionStep[] } },
): { state: DungeonState; steps: ResolutionStep[] } {
  const { rng, ask, progress } = io
  let working = state
  const steps: ResolutionStep[] = []
  progress.state = working
  progress.steps = steps
  const torch = torchLevel(state.torch)
  let watch: Watchfulness | null = null

  for (const original of state.party) {
    const member = working.party.find((m) => m.key === original.key) ?? original
    const planned = plan[member.key] ?? DEFAULT_ACTION
    const option = availableActions(working, member).find((o) => o.id === planned.actionId)
    const usable = option && !option.disabledReason ? planned : DEFAULT_ACTION
    if (usable.actionId === 'ability:standWatch') watch = STAND_WATCH
    else if (usable.actionId === 'watch' && !watch) watch = KEEP_WATCH

    const { state: next, step } = resolveAction({
      state: working,
      member,
      room: roomById(working.dungeon, working.roomId),
      planned: usable,
      rng,
      ask,
      torch,
      notes: [],
    })
    steps.push(step)
    working = withLog(next, `${step.intro} ${step.outcome}`)
    progress.state = working

    const trigger = roomById(working.dungeon, working.roomId).complication
    if (trigger && step.test && drewComplication(step.test.result)) {
      const colorIndex = working.party.findIndex((m) => m.key === member.key)
      const latest = working.party.find((m) => m.key === member.key) ?? member
      const consequence = applyComplication(working, latest, trigger, colorIndex)
      steps.push(consequence.step)
      working = withLog(consequence.state, `${consequence.step.intro} ${consequence.step.outcome}`)
      progress.state = working
    }
  }

  working = {
    ...working,
    party: working.party.map((m) => {
      const rested = { ...m }
      releaseAllConditions(rested)
      return rested
    }),
  }
  const burned = burnTorchInterval(working)
  const { patrol } = burned.state.dungeon
  const warned = Boolean(watch) && patrolCountdown(burned.state) === 1
  steps.push({
    actor: null,
    title: 'The Interval ends',
    intro: 'Time passes in the dark halls.',
    outcome: warned ? `${burned.message} ${patrol.warning}` : burned.message,
    tone: warned ? 'failure' : 'neutral',
  })
  let finished = withLog({ ...burned.state, watch }, burned.message)
  if (patrolIsDue(finished)) {
    finished = springPatrol(finished, rng)
    steps.push({
      actor: null,
      title: 'Interrupted!',
      intro: patrol.arrival,
      outcome: 'Combat begins.',
      tone: 'failure',
    })
  }
  return { state: finished, steps }
}

type Outcome = { state: DungeonState; steps: ResolutionStep[] }

function runInterval(
  snapshot: DungeonState,
  plan: InteractionPlan,
  rng: Rng,
  tape: number[],
  answers: ReactionAnswer[],
  stepsShown: number,
): Outcome {
  const replayed = runReplayable<DungeonState>({
    rng,
    tape,
    answers,
    stepsShown,
    initial: { state: snapshot, steps: [] },
    run: (io) => intervalFlow(snapshot, plan, io),
  })
  const { pause } = replayed
  return {
    state: { ...replayed.state, pending: pause ? { ...pause, snapshot, plan, answers } : null },
    steps: replayed.steps,
  }
}

/**
 * Resolves an Interval. If a Triggered ability could be used partway through, the result has
 * `pending` set and holds only the steps before the question, until `respondToIntervalReaction`.
 */
export function resolveInterval(state: DungeonState, plan: InteractionPlan, rng: Rng): Outcome {
  if (state.pending) return { state, steps: [] }
  return runInterval(state, plan, rng, [], [], 0)
}

/** Gives the answer to the waiting question and carries on with the rest of the Interval. */
export function respondToIntervalReaction(state: DungeonState, answer: ReactionAnswer, rng: Rng): Outcome {
  const { pending } = state
  if (!pending) return { state, steps: [] }
  return runInterval(
    pending.snapshot,
    pending.plan,
    rng,
    pending.tape,
    [...pending.answers, answer],
    pending.stepsShown,
  )
}
