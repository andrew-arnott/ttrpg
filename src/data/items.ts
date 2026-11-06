/**
 * Basic consumable gear available at character creation.
 *
 * The Player's Guide does not price equipment yet, so costs and effects here
 * are proposals sized against the 10 starting coins: a character can afford a
 * kit of cheap supplies or one healing potion plus a few essentials.
 */

export const STARTING_COINS = 10

export interface Item {
  id: string
  name: string
  cost: number
  description: string
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
  bright: 2,
  steady: 2,
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
    description: 'Restore 2 HP when applied outside of combat.',
  },
  {
    id: 'antidote',
    name: 'Antidote',
    cost: 3,
    description: 'Remove one sealed Poison token from yourself or an ally.',
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
    description: 'Restore 4 HP when drunk. Can be used as a Fast action.',
  },
]

export const ITEMS_BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]))

/** Item id -> art file key, since a few ids differ from their filenames. */
export const ITEM_ART_ID: Record<string, string> = {
  torch: 'torch',
  ration: 'ration',
  bandage: 'bandage',
  antidote: 'antidote',
  smokeBomb: 'smokebomb',
  healingPotion: 'potion',
}
