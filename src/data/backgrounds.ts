import type { Background } from './types'

/**
 * Backgrounds are grouped by the attribute they raise. Each grants +1 and a
 * passive the guide explicitly asks the GM to interpret generously.
 */
export const BACKGROUNDS: Background[] = [
  {
    id: 'soldier',
    name: 'Soldier',
    attributeBonus: 'strength',
    blurb: 'You served in an army, militia, mercenary company, or other organized fighting force.',
    ability: {
      name: 'Military Training',
      text: 'You are familiar with military organizations, ranks, procedures, camps, fortifications, and military life.',
    },
  },
  {
    id: 'labourer',
    name: 'Labourer',
    attributeBonus: 'strength',
    blurb:
      'You made your living through demanding physical work such as construction, mining, logging, or hauling cargo.',
    ability: {
      name: 'Hard Work',
      text: 'You are experienced with tools, construction, hauling, and other forms of physical labour.',
    },
  },
  {
    id: 'hunter',
    name: 'Hunter',
    attributeBonus: 'perception',
    blurb: 'You made your living hunting animals and navigating the wilderness.',
    ability: {
      name: 'Tracker',
      text: 'You can identify and follow tracks and other signs left behind by creatures.',
    },
  },
  {
    id: 'guard',
    name: 'Guard',
    attributeBonus: 'perception',
    blurb: 'You spent your time watching for trouble and protecting people, places, or possessions.',
    ability: {
      name: 'Watchful',
      text: 'You are experienced at identifying security weaknesses and recognizing signs that something is amiss.',
    },
  },
  {
    id: 'sailor',
    name: 'Sailor',
    attributeBonus: 'endurance',
    blurb: 'You spent years aboard ships, travelling waterways and working alongside other sailors.',
    ability: {
      name: 'Sea Legs',
      text: 'You are at home aboard ships and accustomed to swimming, sailing, and the hazards of life at sea.',
    },
  },
  {
    id: 'farmer',
    name: 'Farmer',
    attributeBonus: 'endurance',
    blurb: 'You worked the land and learned to depend on crops, animals, weather, and the changing seasons.',
    ability: {
      name: 'Country Living',
      text: 'You are knowledgeable about crops, livestock, weather, and rural life.',
    },
  },
  {
    id: 'entertainer',
    name: 'Entertainer',
    attributeBonus: 'charisma',
    blurb:
      'You made your living performing as a musician, actor, dancer, storyteller, or another kind of entertainer.',
    ability: {
      name: 'Performer',
      text: 'You can usually find somewhere to perform in exchange for modest food, lodging, or coin.',
    },
  },
  {
    id: 'merchant',
    name: 'Merchant',
    attributeBonus: 'charisma',
    blurb: 'You made your living buying, selling, and transporting goods.',
    ability: {
      name: 'Commerce',
      text: 'You know how to find markets, buyers, sellers, and sources for ordinary goods in populated areas.',
    },
  },
  {
    id: 'scholar',
    name: 'Scholar',
    attributeBonus: 'intelligence',
    blurb: 'You devoted yourself to study, research, and the pursuit of knowledge.',
    ability: {
      name: 'Academic',
      text: 'You know how to find libraries, archives, scholars, and other sources of specialized knowledge.',
    },
  },
  {
    id: 'artisan',
    name: 'Artisan',
    attributeBonus: 'intelligence',
    blurb: 'You trained extensively in a particular trade or craft.',
    ability: {
      name: 'Craft',
      text: 'Choose a craft. You can create, repair, and assess items related to it when you have appropriate tools and materials.',
    },
  },
  {
    id: 'urchin',
    name: 'Urchin',
    attributeBonus: 'agility',
    blurb:
      'You grew up surviving on the streets and learned how to navigate places where you were often overlooked.',
    ability: {
      name: 'Streetwise',
      text: 'You are adept at finding shortcuts, shelter, and overlooked ways through populated settlements.',
    },
  },
  {
    id: 'criminal',
    name: 'Criminal',
    attributeBonus: 'agility',
    blurb: 'You made your living outside the law and learned to navigate the criminal underworld.',
    ability: {
      name: 'Underworld Connections',
      text: 'You know how to locate fences, illicit goods and services, and members of the local criminal element.',
    },
  },
  {
    id: 'gambler',
    name: 'Gambler',
    attributeBonus: 'luck',
    blurb:
      'You spent your time around cards, dice, wagers, and people willing to risk their fortunes on chance.',
    ability: {
      name: 'Games of Chance',
      text: 'You are familiar with common gambling games and know how to find places and people where serious gambling occurs.',
    },
  },
  {
    id: 'treasureHunter',
    name: 'Treasure Hunter',
    attributeBonus: 'luck',
    blurb:
      'You made a career of searching ruins, forgotten places, and other dangerous locations for valuable discoveries.',
    ability: {
      name: 'Treasure Sense',
      text: 'You can recognize signs that a location has previously been searched, looted, or deliberately used to conceal valuables.',
    },
  },
]
