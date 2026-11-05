import type { Species } from './types'

export const SPECIES: Species[] = [
  {
    id: 'dwarf',
    name: 'Dwarf',
    blurb:
      'Hardy and resilient. Their larger token bags produce more consistent results, while their shields provide protection in battle.',
    attributeBonus: 'endurance',
    traits: [
      { name: 'Darkvision', text: 'You can see in darkness as though it were dim light.' },
      {
        name: 'Shield Tokens',
        text: 'Add 3 Shield (+2) tokens to your starting bag. When you draw a Shield, put it in play after the test. The next time you take damage, each Shield in play reduces that damage by 1, then returns to your bag.',
      },
    ],
    bagMods: [{ kind: 'add', tokenId: 'shield', count: 3 }],
  },
  {
    id: 'elf',
    name: 'Elf',
    blurb:
      'Exceptionally agile and graceful. Their smaller bags produce more extreme results and make special tokens more common.',
    attributeBonus: 'agility',
    traits: [
      {
        name: 'Graceful',
        text: 'You can move across narrow or unstable surfaces without making a test unless additional danger or difficulty is present.',
      },
      { name: 'Focused', text: 'Remove one +1, one +2, and one +3 token from your starting bag.' },
    ],
    bagMods: [
      { kind: 'remove', tokenId: 'plus1', count: 1 },
      { kind: 'remove', tokenId: 'plus2', count: 1 },
      { kind: 'remove', tokenId: 'plus3', count: 1 },
    ],
  },
  {
    id: 'halfling',
    name: 'Halfling',
    blurb:
      'An uncanny ability to find unexpected opportunities, often succeeding through extraordinary good fortune.',
    attributeBonus: 'luck',
    traits: [
      {
        name: 'Unassuming',
        text: 'Unless you give them reason to think otherwise, strangers rarely perceive you as particularly dangerous or threatening.',
      },
      { name: 'Fortuitous', text: 'Add 2 additional Opportunity tokens to your starting bag.' },
    ],
    bagMods: [{ kind: 'add', tokenId: 'opportunity', count: 2 }],
  },
  {
    id: 'human',
    name: 'Human',
    blurb: 'Adaptable and versatile, capable of excelling in almost any profession.',
    attributeBonus: null,
    traits: [{ name: 'Versatile', text: 'Add 1 additional Expertise token to your starting bag.' }],
    bagMods: [{ kind: 'add', tokenId: 'expertise', count: 1 }],
  },
  {
    id: 'orc',
    name: 'Orc',
    blurb: 'Powerfully built and naturally suited to overcoming challenges through physical force.',
    attributeBonus: 'strength',
    traits: [
      {
        name: 'Powerful Build',
        text: 'You can carry, lift, push, and drag considerably more weight than most similarly sized creatures.',
      },
      {
        name: 'Mighty Blows',
        text: 'Replace 2 +2 tokens in your starting bag with corresponding Might tokens. Might tokens retain their original modifiers. When drawn during a successful attack, each deals 1 additional damage.',
      },
    ],
    bagMods: [{ kind: 'replace', fromTokenId: 'plus2', toTokenId: 'might', count: 2 }],
  },
  {
    id: 'catfolk',
    name: 'Catfolk',
    blurb: 'Exceptional senses and an uncanny awareness of their surroundings.',
    attributeBonus: 'perception',
    traits: [
      {
        name: 'Keen Senses',
        text: 'Your hearing and sense of smell are considerably more sensitive than those of most species.',
      },
      {
        name: 'Foresight',
        text: 'When you draw an Opportunity, you may ignore the next token drawn and draw another in its place. The ignored token contributes no modifier or effects.',
      },
    ],
    bagMods: [],
  },
  {
    id: 'jann',
    name: 'Jann',
    blurb:
      'A people of ancient desert cities and far-reaching trade routes, with metallic skin ranging from copper and brass to bronze and gold.',
    attributeBonus: 'charisma',
    traits: [
      {
        name: 'Appraiser',
        text: 'You can quickly determine the approximate value of ordinary goods, precious metals, gems, artwork, and other valuables.',
      },
      {
        name: 'Exchange',
        text: 'When you rest, you may replace one Expertise token in your bag with an Opportunity, or one Opportunity with an Expertise.',
      },
    ],
    bagMods: [],
  },
  {
    id: 'verdant',
    name: 'Verdant',
    blurb:
      'Long-lived plant people with bark-like skin, leaves, flowers, moss, and vines, whose cultures value study and preserved knowledge.',
    attributeBonus: 'intelligence',
    traits: [
      {
        name: 'Photosynthesis',
        text: 'You do not require conventional food. Given regular access to sunlight and water, you can sustain yourself through photosynthesis.',
      },
      {
        name: 'Accumulated Knowledge',
        text: 'After you succeed on a test where Opportunity tokens were drawn, you may put them into play. They can be spent as part of a test to add +1 to that test.',
      },
    ],
    bagMods: [],
  },
]
