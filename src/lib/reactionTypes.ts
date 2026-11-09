export interface TargetChoice {
  id: string
  label: string
  /** Why this choice cannot be picked right now. It is still listed so the player can see why. */
  disabledReason?: string
}

/** A Triggered ability a player may use right now, or a choice they must make. */
export interface ReactionRequest {
  abilityId: string
  reactorKey: string
  title: string
  prompt: string
  /** What using it costs, for display. */
  cost: string
  /** Choices to pick between, such as the enemy for another attack or the condition to release. */
  targets?: TargetChoice[]
  /** The question must be answered with a choice; there is no declining. */
  required?: boolean
  /** Label for the confirm button of a required question. */
  confirmLabel?: string
}

export interface ReactionAnswer {
  use: boolean
  targetId?: string
}
