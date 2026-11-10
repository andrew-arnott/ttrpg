import type { Adventurer } from '../adventurer'
import type { SpecialKey } from '../../data/types'
import type { TestBonus } from '../skillTest'
import type { SealedCondition } from '../conditionRules'
import type { ReactionAnswer, ReactionRequest, TargetChoice } from '../reactionTypes'
import type { ResolutionStep } from '../resolution'

export type { ReactionAnswer, ReactionRequest, SealedCondition, TargetChoice }

export const ACTIONS_PER_TURN = 2
export const DEFEND_ATTRIBUTE: SpecialKey = 'agility'
export const ENGAGE_ATTRIBUTE: SpecialKey = 'agility'
export const ENGAGE_BASE_DIFFICULTY = 4
export const ENGAGE_MIN_DIFFICULTY = 2
export const FORTIFY_DEFENSE = 2
export const BACKSTAB_DAMAGE = 2
export const SMITE_BONUS_DAMAGE = 2
export const HEAL_AMOUNT = 2
export const MAX_FIREBALL_MANA = 3
export const LOG_LIMIT = 40
export const NEW_GROUP = 'new'

export interface BattlePlayer extends Adventurer {
  /** Defense score for this round. Resets at the end of the round. */
  defense: number
  colorIndex: number
  /** Triggered abilities already used this round that only work once per round. */
  usedThisRound?: string[]
  /** Shield Wall was used this round: this Defense score can cover allies in the same group. */
  shieldWall?: boolean
}

export interface SealedToken {
  /** The token that was sealed. */
  tokenId: string
  byKey: string
  /** The resource it stood in for, when it was Expertise or a Critical Success rather than the resource itself. */
  as?: string
  /** What it counts for: 1 for most tokens, 2 for a Critical Success. */
  value?: number
}

export interface BattleEnemy {
  id: string
  defId: string
  name: string
  hp: number
  maxHp: number
  defense: number
  sealed: SealedToken[]
  disabled: boolean
  provokedBy: string | null
  /** Extra attack value until the end of the round. */
  empowered: number
  /** Its healing triggers no longer work, because its wards were dispelled. */
  unwarded?: boolean
}

export type BattleResult = 'ongoing' | 'victory' | 'defeat'

export interface BattleState {
  round: number
  players: BattlePlayer[]
  enemies: BattleEnemy[]
  /** Combatant id to engagement group id. */
  groups: Record<string, string>
  nextGroup: number
  log: string[]
  result: BattleResult
  /** `players`: someone is choosing an action. `enemies`: everyone has acted and the enemies are next. */
  phase: 'players' | 'enemies'
  /** Index into `players` of whoever is choosing an action. */
  turnIndex: number
  /** Actions the current player has used this round. Fast abilities are free and do not count. */
  actionsUsed: number
  /** Steps leading into round 1, played once when the battle begins. */
  opening: ResolutionStep[]
  /** Set while the battle waits for a player to decide whether to use a Triggered ability. */
  pending?: PendingReaction | null
  /** What the party's torch does to every test in this fight. */
  light?: TestBonus | null
}


export type BattleFlow = { kind: 'action'; planned: PlannedCombat | null } | { kind: 'enemies' }

/**
 * Everything needed to run the interrupted action again with the player's answer. The
 * dice are recorded in `tape` so the replay repeats the same outcomes up to the question.
 */
export interface PendingReaction {
  request: ReactionRequest
  snapshot: BattleState
  flow: BattleFlow
  tape: number[]
  answers: ReactionAnswer[]
  /** Steps already played before the question. */
  stepsShown: number
}

export interface PlannedCombat {
  actionId: string
  targetId?: string
  /** Armor or Power to commit to the test before drawing, when the option offers it. */
  boost?: number
}

/** What helps or hinders the party's Perception tests to spot enemies before they strike. */
export interface SurpriseCheck {
  modifiers: { label: string; value: number }[]
}

/** Armor or Power that can be committed to a test for +1 each. */
export interface BoostOption {
  tokenId: 'armor' | 'power'
  /** The most that can be added, counting Expertise and Critical Success tokens in play. */
  max: number
}

export interface CombatOption {
  id: string
  slot: 'action' | 'fast'
  label: string
  description: string
  targets?: TargetChoice[]
  boost?: BoostOption
  disabledReason?: string
}

