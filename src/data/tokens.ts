import type { TokenDef, TokenStack } from './types'

/**
 * Every token the game defines, keyed by id.
 *
 * Numeric tokens are plain contributors that end the draw. Anything with
 * `chain` keeps the draw going; anything with `resource` goes into play after
 * the test resolves and can be spent on abilities.
 */
export const TOKENS: Record<string, TokenDef> = {
  critFailure: {
    id: 'critFailure',
    name: 'Critical Failure',
    modifier: null,
    keywords: [],
    effect: 'Automatically fails, ends the draw, and generates a Complication.',
  },
  plus0: { id: 'plus0', name: '+0', modifier: 0, keywords: [] },
  plus1: { id: 'plus1', name: '+1', modifier: 1, keywords: [] },
  plus2: { id: 'plus2', name: '+2', modifier: 2, keywords: [] },
  plus3: { id: 'plus3', name: '+3', modifier: 3, keywords: [] },
  plus4: { id: 'plus4', name: '+4', modifier: 4, keywords: [] },
  critSuccess: {
    id: 'critSuccess',
    name: 'Critical Success',
    modifier: 5,
    keywords: ['resource'],
    effect: 'Ends the draw. In play it counts as 2 Expertise, and must be spent or sealed as a single token.',
  },
  opportunity: {
    id: 'opportunity',
    name: 'Opportunity',
    modifier: 1,
    keywords: ['chain'],
  },
  expertise: {
    id: 'expertise',
    name: 'Expertise',
    modifier: 0,
    keywords: ['chain', 'resource'],
    effect: 'Can be spent as any profession resource.',
  },
  complication: {
    id: 'complication',
    name: 'Complication',
    modifier: -1,
    keywords: ['chain'],
    effect: 'May trigger enemy or environmental effects.',
  },

  // Species tokens
  shield: {
    id: 'shield',
    name: 'Shield',
    modifier: 2,
    keywords: [],
    effect:
      'Put in play after the test. The next time you take damage, each Shield in play reduces it by 1, then returns to your bag.',
  },
  might: {
    id: 'might',
    name: 'Might',
    modifier: 2,
    keywords: [],
    effect: 'Retains its original modifier. Drawn during a successful attack, deals 1 additional damage.',
  },

  // Profession resources
  resolve: {
    id: 'resolve',
    name: 'Resolve',
    modifier: 0,
    keywords: ['chain', 'resource'],
    effect: 'Activates Warrior abilities.',
    startsInPlay: true,
  },
  armor: {
    id: 'armor',
    name: 'Armor',
    modifier: 0,
    keywords: ['chain', 'resource'],
    effect: 'Spend before drawing to add +1 to a Defend result.',
    startsInPlay: true,
  },
  power: {
    id: 'power',
    name: 'Power',
    modifier: 0,
    keywords: ['chain', 'resource'],
    effect: 'Spend before drawing to add +1 to an Attack result.',
    startsInPlay: true,
  },
  cunning: {
    id: 'cunning',
    name: 'Cunning',
    modifier: 0,
    keywords: ['chain', 'resource'],
    effect: 'Activates Rogue abilities.',
    startsInPlay: true,
  },
  faith: {
    id: 'faith',
    name: 'Faith',
    modifier: 0,
    keywords: ['chain', 'resource'],
    effect: 'Activates Priest abilities.',
    startsInPlay: true,
  },
  mana: {
    id: 'mana',
    name: 'Mana',
    modifier: 0,
    keywords: ['chain', 'resource'],
    effect: 'Activates Wizard abilities. Only put in play if the test succeeds.',
    startsInPlay: true,
  },

  // Granted in play, not at creation
  bless: {
    id: 'bless',
    name: 'Bless',
    modifier: 2,
    keywords: ['chain'],
    effect: 'Removed from the bag after it is drawn and the test resolves.',
  },

  // Conditions — all -1, Chain. Acquired in play, never at creation.
  wound: {
    id: 'wound',
    name: 'Wound',
    modifier: -1,
    keywords: ['chain'],
    effect: 'While a Wound is sealed, drawing another Wound causes a Critical Failure and seals the new Wound.',
  },
  poison: {
    id: 'poison',
    name: 'Poison',
    modifier: -1,
    keywords: ['chain'],
    effect: 'When sealed, take 1 damage for each Poison currently sealed on you.',
  },
  insanity: {
    id: 'insanity',
    name: 'Insanity',
    modifier: -1,
    keywords: ['chain'],
    effect: 'While sealed, you cannot use Fast or Triggered abilities.',
  },
  curse: {
    id: 'curse',
    name: 'Curse',
    modifier: -1,
    keywords: ['chain'],
    effect: 'Automatically draw the sealed Curse on your next test.',
  },
  fatigue: {
    id: 'fatigue',
    name: 'Fatigue',
    modifier: -1,
    keywords: ['chain'],
    effect: 'While sealed, lose 1 action at the beginning of your turn.',
  },
  fear: {
    id: 'fear',
    name: 'Fear',
    modifier: -1,
    keywords: ['chain'],
    effect: 'While sealed, you cannot attack enemies.',
  },
}

/** The 15 tokens every character starts with, before species and profession. */
export const STANDARD_BAG: TokenStack[] = [
  { tokenId: 'critFailure', count: 1 },
  { tokenId: 'plus0', count: 1 },
  { tokenId: 'plus1', count: 2 },
  { tokenId: 'plus2', count: 2 },
  { tokenId: 'plus3', count: 4 },
  { tokenId: 'plus4', count: 1 },
  { tokenId: 'critSuccess', count: 1 },
  { tokenId: 'opportunity', count: 1 },
  { tokenId: 'expertise', count: 1 },
  { tokenId: 'complication', count: 1 },
]

export const CONDITION_TOKEN_IDS = ['wound', 'poison', 'insanity', 'curse', 'fatigue', 'fear']
