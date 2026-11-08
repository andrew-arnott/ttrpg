import type { SpecialKey, SpecialSpread, TokenStack } from '../../data/types'
import type { ResolutionStep } from '../resolution'

export const ACTIONS_PER_TURN = 2
export const ATTACK_ATTRIBUTE: SpecialKey = 'strength'
export const DEFEND_ATTRIBUTE: SpecialKey = 'agility'
export const ENGAGE_ATTRIBUTE: SpecialKey = 'agility'
export const ENGAGE_DIFFICULTY = 4
export const FORTIFY_DEFENSE = 2
export const BACKSTAB_DAMAGE = 2
export const HEAL_AMOUNT = 2
export const MAX_FIREBALL_MANA = 3
/** Difficulty for the enemies' Perception test to surprise the party, before watchfulness and light. */
export const SURPRISE_BASE_DIFFICULTY = 4
export const LOG_LIMIT = 40
export const NEW_GROUP = 'new'

export interface BattlePlayer {
  key: string
  name: string
  professionId: string
  hp: number
  maxHp: number
  special: SpecialSpread
  bag: TokenStack[]
  resources: Record<string, number>
  abilityIds: string[]
  /** Shield tokens drawn and waiting to absorb the next damage taken. */
  shieldsInPlay: number
  /** Defense score for this round. Resets at the end of the round. */
  defense: number
  colorIndex: number
}

export interface SealedToken {
  tokenId: string
  byKey: string
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
}

export interface PlannedCombat {
  actionId: string
  targetId?: string
}

/** Inputs to the enemies' Perception test to surprise the party. */
export interface SurpriseCheck {
  perception: number
  modifiers: { label: string; value: number }[]
}

export interface TargetChoice {
  id: string
  label: string
}

export interface CombatOption {
  id: string
  slot: 'action' | 'fast'
  label: string
  description: string
  targets?: TargetChoice[]
  /**
   * The target must be in the player's own engagement group when the action resolves,
   * not when it is planned, so an earlier action can move the player into position.
   */
  requiresEngaged?: boolean
  disabledReason?: string
}

