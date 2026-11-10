import type { SpecialSpread, TokenStack } from '../data/types'
import type { Hands } from '../data/weapons'
import type { SealedCondition } from './conditionRules'

/** What a character is, wherever they are: in the dungeon between fights or in the middle of one. */
export interface Adventurer {
  key: string
  name: string
  professionId: string
  speciesId?: string
  /** A portrait id or an uploaded image, for the avatar. */
  portrait?: string | null
  hp: number
  maxHp: number
  special: SpecialSpread
  bag: TokenStack[]
  /** Profession resource tokens currently in play. */
  resources: Record<string, number>
  abilityIds: string[]
  /** Shield tokens drawn and waiting to absorb the next damage taken. */
  shieldsInPlay: number
  /** What is held in each hand; the weapon decides what an ordinary attack tests. */
  hands?: Hands
  /** Conditions sealed on the character until the end of the Interval or fight. */
  sealedConditions?: SealedCondition[]
}

/** The part of an adventurer a fight starts from, with the mutable parts copied. */
export function intoFight(a: Adventurer): Adventurer {
  return {
    key: a.key,
    name: a.name,
    professionId: a.professionId,
    speciesId: a.speciesId,
    portrait: a.portrait,
    hp: a.hp,
    maxHp: a.maxHp,
    special: a.special,
    bag: a.bag.map((s) => ({ ...s })),
    resources: { ...a.resources },
    abilityIds: a.abilityIds,
    shieldsInPlay: a.shieldsInPlay,
    hands: a.hands,
    sealedConditions: [],
  }
}

/** What a fight leaves behind: HP (anyone who fell comes round with 1), tokens, and no sealed conditions. */
export function outOfFight<T extends Adventurer>(member: T, fought: Adventurer): T {
  return {
    ...member,
    hp: Math.max(1, fought.hp),
    resources: fought.resources,
    bag: fought.bag,
    shieldsInPlay: fought.shieldsInPlay,
    sealedConditions: [],
  }
}
