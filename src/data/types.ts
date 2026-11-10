/**
 * Rules model for the Player's Guide.
 *
 * Everything the UI renders is derived from the data files in this folder, so
 * filling in a TBD profession or tweaking a species means editing data only.
 */

export const SPECIAL_KEYS = [
  'strength',
  'perception',
  'endurance',
  'charisma',
  'intelligence',
  'agility',
  'luck',
] as const

export type SpecialKey = (typeof SPECIAL_KEYS)[number]

export type SpecialSpread = Record<SpecialKey, number>

/** The fixed array every character distributes across SPECIAL (step 2). */
export const SPECIAL_ARRAY = [1, 2, 2, 2, 3, 3, 3] as const

export const SPECIAL_LABELS: Record<SpecialKey, string> = {
  strength: 'Strength',
  perception: 'Perception',
  endurance: 'Endurance',
  charisma: 'Charisma',
  intelligence: 'Intelligence',
  agility: 'Agility',
  luck: 'Luck',
}

export const SPECIAL_USES: Record<SpecialKey, string> = {
  strength: 'Physical power, lifting, pushing, grappling, and breaking objects',
  perception: 'Noticing details, detecting danger, tracking, and awareness',
  endurance: 'Resisting poison, exhaustion, harsh conditions, and physical hardship',
  charisma: 'Persuasion, deception, intimidation, negotiation, and performance',
  intelligence: 'Knowledge, reasoning, investigation, and understanding complex things',
  agility: 'Speed, balance, stealth, precision, and coordination',
  luck: 'Fortunate coincidences, unexpected discoveries, and circumstances beyond your control',
}

/** Keywords a token can carry. See "Token Keywords and States". */
export type TokenKeyword = 'chain' | 'resource'

export interface TokenDef {
  id: string
  name: string
  /** Null for tokens with no numeric contribution (Critical Failure). */
  modifier: number | null
  keywords: TokenKeyword[]
  effect?: string
  /** Resource tokens that a profession starts with already in play. */
  startsInPlay?: boolean
}

/** A token id paired with how many copies are in the bag. */
export interface TokenStack {
  tokenId: string
  count: number
}

/** Declarative edits a species or profession makes to the standard bag. */
export type BagMod =
  | { kind: 'add'; tokenId: string; count: number }
  | { kind: 'remove'; tokenId: string; count: number }
  | { kind: 'replace'; fromTokenId: string; toTokenId: string; count: number }

export interface Species {
  id: string
  name: string
  blurb: string
  /** Humans are the one species with no attribute bump. */
  attributeBonus: SpecialKey | null
  traits: { name: string; text: string }[]
  bagMods: BagMod[]
  /** Sees in the dark as though it were dim light. */
  darkvision?: boolean
}

export interface Background {
  id: string
  name: string
  attributeBonus: SpecialKey
  blurb: string
  ability: { name: string; text: string }
}

export type AbilityType =
  | 'Fight'
  | 'Defend'
  | 'Engage'
  | 'Fast'
  | 'Triggered'
  | 'Action'
  | 'Interval'

export interface Ability {
  id: string
  name: string
  /** e.g. ['Engage', 'Fight'] for Backstab. */
  types: AbilityType[]
  cost: string
  text: string
}

export interface ResourceDef {
  tokenId: string
  effectWhenSpent: string
}

/**
 * A choice a profession offers over its starting tokens.
 * Warriors split 3 tokens between Armor and Power in any combination.
 */
export interface TokenChoice {
  id: string
  prompt: string
  total: number
  options: string[]
}

export interface Profession {
  id: string
  name: string
  blurb: string
  /** Null for Ranger and Berserker, which the Player's Guide lists as TBD. */
  startingHp: number | null
  importantSpecial: SpecialKey[]
  focus: string
  /** False for professions the guide has not finished defining. */
  defined: boolean
  fixedStartingTokens: TokenStack[]
  tokenChoices: TokenChoice[]
  resources: ResourceDef[]
  /** Choose `abilityPicks` from these. */
  abilities: Ability[]
  abilityPicks: number
  /** Granted in full, not chosen. */
  explorationAbilities: Ability[]
  notes: string[]
}
