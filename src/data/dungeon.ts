import type { SpecialKey } from './types'

export interface RoomReward {
  itemId: string
  count: number
}

/** Something hidden in a room that a successful Perception test uncovers. */
export interface RoomSecret {
  text: string
  difficulty: number
  reward?: RoomReward
}

/** A one-off thing to try in a room, offered as the "Room interaction" action. */
export interface RoomInteraction {
  label: string
  attribute: SpecialKey
  difficulty: number
  success: string
  failure: string
  reward?: RoomReward
}

export interface RoomMagic {
  detect: string
  identify: string
  dispelDifficulty: number
  dispelled: string
}

export interface DungeonRoom {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  description: string
  /** A note that points at the rule the room is good for practising. */
  lesson: string
  /** One useful detail revealed by studying the room. */
  intel: string
  secret: RoomSecret
  interaction: RoomInteraction
  magic?: RoomMagic
}

export interface DungeonLink {
  from: string
  to: string
  /** Hidden links are not part of the map until the party discovers them. */
  hidden?: { discovery: string }
}

/** A group of enemies that finds the party after a number of Intervals, wherever they are. */
export interface Patrol {
  arrivesAtInterval: number
  enemyIds: string[]
  /** Heard by anyone keeping watch in the Interval before the patrol arrives. */
  warning: string
  arrival: string
}

export interface Dungeon {
  id: string
  name: string
  blurb: string
  width: number
  height: number
  startRoomId: string
  rooms: DungeonRoom[]
  links: DungeonLink[]
  patrol: Patrol
}

export const linkKey = (link: Pick<DungeonLink, 'from' | 'to'>): string => `${link.from}>${link.to}`

export const SUNKEN_CRYPT: Dungeon = {
  id: 'sunkenCrypt',
  name: 'The Sunken Crypt',
  blurb:
    'A flooded burial complex beneath an abandoned chapel. A gentle first delve for learning how light, time, and exploration work together.',
  width: 1000,
  height: 640,
  startRoomId: 'entrance',
  rooms: [
    {
      id: 'entrance',
      name: 'Entrance Hall',
      x: 40,
      y: 250,
      w: 170,
      h: 140,
      description: 'Cracked steps lead down from the chapel above. Daylight reaches only the first few feet.',
      lesson: 'Your first torch is already lit. Each Interval you spend burns it down.',
      intel: 'The only way out is back up the steps, and the hall beyond is the heart of the complex.',
      secret: {
        text: 'a forgotten satchel wedged behind the bottom step',
        difficulty: 4,
        reward: { itemId: 'torch', count: 1 },
      },
      interaction: {
        label: 'Read the worn inscription over the door',
        attribute: 'intelligence',
        difficulty: 4,
        success: 'The inscription is a burial rite. It names the founders and says they sleep beyond the Shrine of Embers.',
        failure: 'The letters are too worn and weathered to make sense of.',
      },
    },
    {
      id: 'greatHall',
      name: 'Great Hall',
      x: 290,
      y: 220,
      w: 230,
      h: 200,
      description: 'Rows of toppled pews and a cracked mosaic floor. Four doorways open off the hall.',
      lesson: 'A hub room: you can retreat here while deciding which way to explore.',
      intel: 'Four doorways lead off the hall. The eastern one is the best preserved and leads toward a shrine.',
      secret: {
        text: 'a vial tucked beneath a loose mosaic tile',
        difficulty: 5,
        reward: { itemId: 'antidote', count: 1 },
      },
      interaction: {
        label: 'Study the cracked mosaic',
        attribute: 'intelligence',
        difficulty: 5,
        success: 'The mosaic is a map of the complex. You commit it to memory: the crypt lies at the far east end.',
        failure: 'The tiles are too broken to make out a pattern.',
      },
    },
    {
      id: 'barracks',
      name: 'Watch Room',
      x: 310,
      y: 30,
      w: 190,
      h: 130,
      description: 'Rotted bunks and a rusted weapon rack. Someone left in a hurry.',
      lesson: 'Dim light is enough to move through a room, but not to notice detail.',
      intel: 'The bunks were abandoned in a hurry, and the door to the east is barred from this side.',
      secret: {
        text: 'a roll of clean bandages under a mouldering pillow',
        difficulty: 5,
        reward: { itemId: 'bandage', count: 2 },
      },
      interaction: {
        label: 'Heave the rusted weapon rack aside',
        attribute: 'strength',
        difficulty: 5,
        success: 'The rack topples with a crash, revealing a smoke bomb stashed in the wall behind it.',
        failure: 'The rack is rusted fast to the wall and will not budge.',
        reward: { itemId: 'smokeBomb', count: 1 },
      },
    },
    {
      id: 'storeroom',
      name: 'Storeroom',
      x: 310,
      y: 480,
      w: 190,
      h: 120,
      description: 'Crates swollen with damp. Most of the stores are ruined, a few are not.',
      lesson: 'Supplies matter: torches and rations only help if you carry enough of them.',
      intel: 'Something has been dragging crates across the floor. A draught blows from behind the western shelves.',
      secret: {
        text: 'a crate of dry torches at the back of the room',
        difficulty: 5,
        reward: { itemId: 'torch', count: 2 },
      },
      interaction: {
        label: 'Pry open a sealed crate',
        attribute: 'strength',
        difficulty: 5,
        success: 'The lid splinters open. Inside are well-wrapped rations.',
        failure: 'The crate is nailed shut and the lid holds.',
        reward: { itemId: 'ration', count: 2 },
      },
    },
    {
      id: 'library',
      name: 'Reliquary Library',
      x: 600,
      y: 25,
      w: 200,
      h: 140,
      description: 'Shelves of waterlogged scrolls and a reading desk beneath a cracked skylight.',
      lesson: 'Keep a spare torch ready before you wander far from the entrance.',
      intel: 'Most of the scrolls are pulp, but the reading desk has been used recently.',
      secret: {
        text: 'a healing potion hidden in a hollowed-out book',
        difficulty: 6,
        reward: { itemId: 'healingPotion', count: 1 },
      },
      interaction: {
        label: 'Decipher the waterlogged scrolls',
        attribute: 'intelligence',
        difficulty: 5,
        success: 'You piece together a founder\u2019s diary. It describes a vault sealed with protective runes.',
        failure: 'The ink has run to nothing but grey smears.',
      },
      magic: {
        detect: 'The scrolls on the desk shimmer faintly: a lingering ward against fire.',
        identify: 'The ward is a preservation spell. It has kept one shelf of scrolls dry for centuries.',
        dispelDifficulty: 5,
        dispelled: 'The ward fades, and the preserved scrolls crumble to dust.',
      },
    },
    {
      id: 'shrine',
      name: 'Shrine of Embers',
      x: 600,
      y: 250,
      w: 200,
      h: 140,
      description: 'A stone altar with a ring of cold braziers. The air smells faintly of smoke.',
      lesson: 'A quiet room is a good place to light a fresh torch before pressing on.',
      intel: 'The braziers are cold, but the altar stone is warm to the touch.',
      secret: {
        text: 'a small offering bowl holding old coins and a spare torch',
        difficulty: 5,
        reward: { itemId: 'torch', count: 1 },
      },
      interaction: {
        label: 'Kneel and pray at the altar',
        attribute: 'charisma',
        difficulty: 4,
        success: 'A gentle warmth spreads through you. The shrine accepts the party\u2019s respect.',
        failure: 'The altar stays cold and silent.',
      },
      magic: {
        detect: 'A slow pulse of warm magic beats beneath the altar, like a banked fire.',
        identify: 'The altar holds a blessing of rest, long dormant but not yet gone.',
        dispelDifficulty: 6,
        dispelled: 'The pulse stills. The altar goes cold.',
      },
    },
    {
      id: 'cistern',
      name: 'Flooded Cistern',
      x: 600,
      y: 465,
      w: 200,
      h: 150,
      description: 'Black water laps at a narrow walkway. Something ripples just out of sight.',
      lesson: 'Dark rooms hide their exits. Light decides how far ahead you can see.',
      intel: 'The walkway is slick but sound. The ripples come from something small and shy.',
      secret: {
        text: 'a glass vial glinting in the shallows',
        difficulty: 5,
        reward: { itemId: 'antidote', count: 1 },
      },
      interaction: {
        label: 'Balance along the slick walkway to its end',
        attribute: 'agility',
        difficulty: 5,
        success: 'You reach the far end without a splash and find a ration sack lashed to a post.',
        failure: 'You slip and retreat, soaked and embarrassed.',
        reward: { itemId: 'ration', count: 1 },
      },
    },
    {
      id: 'crypt',
      name: 'Founders\u2019 Crypt',
      x: 850,
      y: 245,
      w: 140,
      h: 150,
      description: 'A sealed vault lined with sarcophagi. The deepest room of the Sunken Crypt.',
      lesson: 'The end of the delve. Plan your torches so you can also get back out.',
      intel: 'The sarcophagi are sealed. Faint runes circle the floor around the central tomb.',
      secret: {
        text: 'a tarnished locket in a cracked sarcophagus',
        difficulty: 6,
        reward: { itemId: 'healingPotion', count: 1 },
      },
      interaction: {
        label: 'Study the runes on the floor',
        attribute: 'intelligence',
        difficulty: 6,
        success: 'The runes are a lullaby for the dead. You read it aloud, and the room settles.',
        failure: 'The runes swim before your eyes. You cannot make sense of them.',
      },
      magic: {
        detect: 'Wards ring the central tomb, humming with cold, old magic.',
        identify: 'The wards are binding runes meant to keep the sleepers undisturbed.',
        dispelDifficulty: 7,
        dispelled: 'The runes flicker out, and the hum stops.',
      },
    },
  ],
  links: [
    { from: 'entrance', to: 'greatHall' },
    { from: 'greatHall', to: 'barracks' },
    { from: 'greatHall', to: 'storeroom' },
    { from: 'greatHall', to: 'shrine' },
    { from: 'barracks', to: 'library' },
    { from: 'library', to: 'shrine' },
    { from: 'storeroom', to: 'cistern' },
    { from: 'cistern', to: 'shrine' },
    { from: 'shrine', to: 'crypt' },
    {
      from: 'entrance',
      to: 'storeroom',
      hidden: { discovery: 'a servants\u2019 passage, hidden behind a loose panel, running from the entrance down to the storeroom' },
    },
  ],
  patrol: {
    arrivesAtInterval: 4,
    enemyIds: ['goblin', 'goblin', 'troll'],
    warning: 'Boots scrape and something heavy drags along the stone. A patrol is close.',
    arrival: 'A goblin patrol led by a cave troll stumbles into the party!',
  },
}
