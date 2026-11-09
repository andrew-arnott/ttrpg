import type { TokenStack } from '../data/types'
import {
  currentPlayer,
  respondToReaction,
  runEnemyPhase,
  takeAction,
  type BattleState,
  type PlannedCombat,
  type ReactionAnswer,
  type ReactionRequest,
} from './battle'
import type { Rng } from './drawTest'
import type { PartyMember } from './dungeonState'
import { createPartyMember } from './partyMember'
import type { ResolutionStep } from './resolution'
import { sampleRoster } from './roster'

export function testMember(key: string, torches: number, overrides: Partial<PartyMember> = {}): PartyMember {
  const [sample] = sampleRoster()
  return {
    ...createPartyMember(key, sample.draft),
    name: key,
    inventory: { torch: torches },
    resources: {},
    ...overrides,
  }
}

/** A bag that always draws the same single token, so test outcomes are certain. */
export const bagOf = (tokenId: string): TokenStack[] => [{ tokenId, count: 50 }]

export const ALWAYS_PASS = bagOf('critSuccess')
export const ALWAYS_FAIL = bagOf('critFailure')

export interface TurnPlan {
  actions: [PlannedCombat | null, PlannedCombat | null]
  fast: PlannedCombat | null
}

export type BattlePlan = Record<string, TurnPlan>

/** Decides each Triggered ability question that comes up while a round plays. */
export type Reactions = (request: ReactionRequest) => ReactionAnswer

export const declineAll: Reactions = () => ({ use: false })
export const acceptAll: Reactions = (request) => ({ use: true, targetId: request.targets?.[0]?.id })

export const EMPTY_TURN: TurnPlan = { actions: [null, null], fast: null }

/**
 * Plays a whole round through the step-by-step API: each player's Fast ability, then their
 * two actions in order, then the enemy phase. A `null` action is skipped.
 */
export function playRound(
  battle: BattleState,
  plan: BattlePlan,
  rng: Rng,
  reactions: Reactions = declineAll,
): { battle: BattleState; steps: ResolutionStep[] } {
  let b = battle
  const steps: ResolutionStep[] = []
  const settle = (result: { battle: BattleState; steps: ResolutionStep[] }) => {
    b = result.battle
    steps.push(...result.steps)
    while (b.pending) settle(respondToReaction(b, reactions(b.pending.request), rng))
  }
  const take = (planned: PlannedCombat | null) => settle(takeAction(b, planned, rng))

  while (b.result === 'ongoing' && b.phase === 'players') {
    const player = currentPlayer(b)
    if (!player) break
    const turn = plan[player.key] ?? EMPTY_TURN
    const index = b.turnIndex
    const stillHisTurn = () => b.result === 'ongoing' && b.phase === 'players' && b.turnIndex === index
    if (turn.fast) take(turn.fast)
    for (const planned of turn.actions) {
      if (!stillHisTurn()) break
      take(planned)
    }
  }

  if (b.result === 'ongoing' && b.phase === 'enemies') {
    settle(runEnemyPhase(b, rng))
  }
  return { battle: b, steps }
}
