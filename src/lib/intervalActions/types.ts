import type { DungeonRoom } from '../../data/dungeon'
import type { ReactionAnswer, ReactionRequest } from '../reactionTypes'
import type { DungeonState } from '../dungeonState'

export type ActionId =
  | 'investigate'
  | `disarm:${string}`
  | 'rest'
  | 'watch'
  | `use:${string}`
  | `treat:${string}`
  | `interact:${string}`
  | `unlock:${string}`
  | `ability:${string}`

export type ActionGroup = 'Basic' | 'Room' | 'Class'

export interface ActionOption {
  id: ActionId
  group: ActionGroup
  label: string
  description: string
  /** Rooms the action can be pointed at, for actions that need a target. */
  targets?: DungeonRoom[]
  disabledReason?: string
}

export interface PlannedAction {
  actionId: ActionId
  targetRoomId?: string
}

export type InteractionPlan = Record<string, PlannedAction>

export const DEFAULT_ACTION: PlannedAction = { actionId: 'watch' }
export const TREAT_DIFFICULTY = 6

/** An Interval stopped partway through to ask a player about a Triggered ability. */
export interface PendingInterval {
  request: ReactionRequest
  snapshot: DungeonState
  plan: InteractionPlan
  tape: number[]
  answers: ReactionAnswer[]
  /** Steps already played before the question. */
  stepsShown: number
}
