import type { SpecialKey } from './types'

/** Something held in a hand slot: a weapon to attack with, or a shield. */
export interface HandItem {
  id: string
  name: string
  /** Starting coins. */
  cost: number
  kind: 'weapon' | 'shield'
  /** The SPECIAL attribute an attack with it tests. */
  attribute?: SpecialKey
  /** Hand slots it takes. A two-handed weapon takes both and does 1 extra damage. */
  hands: 1 | 2
  /** Can attack enemies you are not engaged with, but is at a penalty against ones you are. */
  ranged?: boolean
  /** Shield (+2) tokens it adds to the bag. */
  shieldTokens?: number
  description: string
}

export const TWO_HANDED_DAMAGE = 1
export const RANGED_CLOSE_PENALTY = -2

export const HAND_ITEMS: HandItem[] = [
  {
    id: 'sword',
    cost: 2,
    name: 'Sword',
    kind: 'weapon',
    attribute: 'strength',
    hands: 1,
    description: 'Attacks test Strength.',
  },
  {
    id: 'mace',
    cost: 2,
    name: 'Mace',
    kind: 'weapon',
    attribute: 'strength',
    hands: 1,
    description: 'Attacks test Strength.',
  },
  {
    id: 'dagger',
    cost: 1,
    name: 'Dagger',
    kind: 'weapon',
    attribute: 'agility',
    hands: 1,
    description: 'Attacks test Agility.',
  },
  {
    id: 'greataxe',
    cost: 3,
    name: 'Greataxe',
    kind: 'weapon',
    attribute: 'strength',
    hands: 2,
    description: 'Two-handed. Attacks test Strength and do 1 extra damage.',
  },
  {
    id: 'shortbow',
    cost: 3,
    name: 'Shortbow',
    kind: 'weapon',
    attribute: 'perception',
    hands: 2,
    ranged: true,
    description:
      'Two-handed and ranged. Attacks test Perception and do 1 extra damage. Can hit enemies you are not engaged with, but is at -2 against ones you are.',
  },
  {
    id: 'magicStaff',
    cost: 3,
    name: 'Magic Staff',
    kind: 'weapon',
    attribute: 'intelligence',
    hands: 2,
    description: 'Two-handed. Attacks test Intelligence and do 1 extra damage.',
  },
  {
    id: 'shield',
    cost: 2,
    name: 'Shield',
    kind: 'shield',
    hands: 1,
    shieldTokens: 2,
    description: 'Adds 2 Shield (+2) tokens to your bag. Each one you draw soaks up damage until it is used.',
  },
]

export const HAND_ITEMS_BY_ID: Record<string, HandItem> = Object.fromEntries(HAND_ITEMS.map((i) => [i.id, i]))

export interface Hands {
  main: string | null
  off: string | null
}

export const NO_HANDS: Hands = { main: null, off: null }

export interface AttackProfile {
  name: string
  attribute: SpecialKey
  twoHanded: boolean
  ranged: boolean
}

const UNARMED: AttackProfile = { name: 'bare hands', attribute: 'strength', twoHanded: false, ranged: false }

/** What an ordinary attack uses: the first weapon held, main hand first, otherwise bare hands. */
export function attackProfile(hands: Hands | undefined): AttackProfile {
  for (const id of [hands?.main, hands?.off]) {
    const item = id ? HAND_ITEMS_BY_ID[id] : undefined
    if (item?.kind === 'weapon' && item.attribute) {
      return { name: item.name.toLowerCase(), attribute: item.attribute, twoHanded: item.hands === 2, ranged: Boolean(item.ranged) }
    }
  }
  return UNARMED
}

/** Tidies a choice of hands: unknown items go, and a two-handed item leaves the other hand empty. */
export function normalizeHands(hands: Partial<Hands> | undefined): Hands {
  const known = (id: string | null | undefined) => (id && HAND_ITEMS_BY_ID[id] ? id : null)
  const main = known(hands?.main)
  const off = known(hands?.off)
  if (main && HAND_ITEMS_BY_ID[main].hands === 2) return { main, off: null }
  if (off && HAND_ITEMS_BY_ID[off].hands === 2) return { main: null, off }
  return { main, off }
}

export const heldItems = (hands: Hands | undefined): HandItem[] =>
  [hands?.main, hands?.off].flatMap((id) => (id && HAND_ITEMS_BY_ID[id] ? [HAND_ITEMS_BY_ID[id]] : []))
