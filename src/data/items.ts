/**
 * Basic consumable gear available at character creation.
 *
 * The Player's Guide does not price equipment yet, so costs and effects here
 * are proposals sized against the 10 starting coins: a character can afford a
 * kit of cheap supplies or one healing potion plus a few essentials.
 */

import type { SpecialKey } from './types'

export const STARTING_COINS = 10

/** The condition an item treats, and the attributes the patient may test with. */
export interface Treatment {
  condition: string
  attributes: [SpecialKey, SpecialKey?]
}

export interface Item {
  id: string
  name: string
  cost: number
  description: string
  /** HP restored when used outside of combat. */
  healing?: number
  treats?: Treatment
}

/** How long a torch burns, in Intervals spent at each brightness. */
export interface TorchSpec {
  name: string
  bright: number
  steady: number
  dim: number
}

export const ORDINARY_TORCH: TorchSpec = {
  name: 'Torch',
  bright: 1,
  steady: 3,
  dim: 2,
}

/** Lit by the Priest's Holy Light ability in place of an ordinary torch. */
export const HOLY_TORCH: TorchSpec = {
  name: 'Holy torch',
  bright: 3,
  steady: 3,
  dim: 2,
}

export const ITEMS: Item[] = [
  {
    id: 'torch',
    name: 'Torch',
    cost: 1,
    description: `Lights the way underground. Burns Bright for ${ORDINARY_TORCH.bright} Intervals, Steady for ${ORDINARY_TORCH.steady}, then Dim for ${ORDINARY_TORCH.dim} before going out.`,
  },
  {
    id: 'ration',
    name: 'Ration',
    cost: 1,
    description: 'Food and water for one day of travel.',
  },
  {
    id: 'bandage',
    name: 'Bandage',
    cost: 2,
    healing: 2,
    treats: { condition: 'wound', attributes: ['intelligence', 'endurance'] },
    description: 'Treats a Wound. Also restores 2 HP when applied outside of combat.',
  },
  {
    id: 'antivenom',
    name: 'Antivenom',
    cost: 3,
    treats: { condition: 'poison', attributes: ['strength', 'endurance'] },
    description: 'Treats Poison.',
  },
  {
    id: 'laudanum',
    name: 'Laudanum',
    cost: 3,
    treats: { condition: 'insanity', attributes: ['perception', 'charisma'] },
    description: 'Treats Insanity.',
  },
  {
    id: 'holyWater',
    name: 'Holy Water',
    cost: 3,
    treats: { condition: 'curse', attributes: ['luck'] },
    description: 'Treats a Curse.',
  },
  {
    id: 'stimulant',
    name: 'Stimulant',
    cost: 2,
    treats: { condition: 'fatigue', attributes: ['strength', 'endurance'] },
    description: 'Treats Fatigue.',
  },
  {
    id: 'liquidCourage',
    name: 'Liquid Courage',
    cost: 2,
    treats: { condition: 'fear', attributes: ['charisma', 'luck'] },
    description: 'Treats Fear.',
  },
  {
    id: 'smokeBomb',
    name: 'Smoke Bomb',
    cost: 3,
    description: 'Fills a room with thick smoke. Those inside cannot be seen from outside until it clears.',
  },
  {
    id: 'healingPotion',
    name: 'Healing Potion',
    cost: 5,
    healing: 4,
    description: 'Restore 4 HP when drunk. Can be used as a Fast action.',
  },
]

export const ITEMS_BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]))

/** Item id -> art file key, since a few ids differ from their filenames. */
export const ITEM_ART_ID: Record<string, string> = {
  torch: 'torch',
  ration: 'ration',
  bandage: 'bandage',
  antivenom: 'antidote',
  laudanum: 'potion',
  holyWater: 'potion',
  stimulant: 'potion',
  liquidCourage: 'potion',
  smokeBomb: 'smokebomb',
  healingPotion: 'potion',
}
