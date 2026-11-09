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

/** A one-off thing to try in a room, offered as a "Room interaction" action. */
export interface RoomInteraction {
  /** Unique within its room. The completion flag is `interaction:<room>:<id>`. */
  id: string
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

/** What goes wrong when a Complication is drawn on a test in a room, outside of combat. */
export type ComplicationEffect =
  | { kind: 'damage'; amount: number }
  | { kind: 'torch' }
  | { kind: 'noise' }
  | { kind: 'drop'; itemId: string }

export interface RoomComplication {
  text: string
  effect: ComplicationEffect
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
  interactions: RoomInteraction[]
  magic?: RoomMagic
  complication?: RoomComplication
}

export interface LockOption {
  id: 'pick' | 'break'
  label: string
  attribute: SpecialKey
  difficulty: number
  success: string
  failure: string
}

/** A door that can be forced open with tests. Failed attempts can be repeated, at the cost of time. */
export interface DoorLock {
  kind: 'door'
  id: string
  name: string
  description: string
  options: LockOption[]
}

export interface SealRequirement {
  /** A completion flag such as `interaction:library:scrolls`. */
  flag: string
  /** A riddle-like clue shown from the start. */
  hint: string
  /** Shown once the requirement is met. */
  done: string
}

/** A lock that picks and force cannot touch. It opens once everything it requires has been done elsewhere. */
export interface SealLock {
  kind: 'seal'
  id: string
  name: string
  description: string
  requires: SealRequirement[]
  broken: string
}

export type Lock = DoorLock | SealLock

export interface DungeonLink {
  from: string
  to: string
  /** Hidden links are not part of the map until the party discovers them. */
  hidden?: { discovery: string }
  /** Locked links cannot be used, or seen through, until they are unlocked. */
  lock?: Lock
}

/** A group of enemies that finds the party some Intervals after the first door is unlocked. */
export interface Patrol {
  /** Intervals after the first lock is opened. */
  delayAfterUnlock: number
  enemyIds: string[]
  /** Heard by anyone keeping watch in the Interval before the patrol arrives. */
  warning: string
  arrival: string
}

/** The guardian waiting in the final room. */
export interface Boss {
  roomId: string
  enemyIds: string[]
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
  boss: Boss
}

export const linkKey = (link: Pick<DungeonLink, 'from' | 'to'>): string => `${link.from}>${link.to}`

export const interactionFlag = (roomId: string, interactionId: string) => `interaction:${roomId}:${interactionId}`

export const SUNKEN_CRYPT: Dungeon = {
  id: 'sunkenCrypt',
  name: 'The Sunken Crypt',
  blurb:
    'A flooded burial complex beneath an abandoned chapel. A guided first delve for learning how light, time, tests and combat work together.',
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
      description:
        'Cracked steps lead down from the chapel above. A rusted iron door bars the way deeper in. Daylight reaches only the first few feet.',
      lesson:
        'The door is locked. You can pick it or break it down, and you can try again, but every attempt takes an Interval and burns your torch. Torches are a resource.',
      intel: 'The only way on is through the iron door. The hall beyond is the heart of the complex.',
      secret: {
        text: 'a forgotten satchel wedged behind the bottom step',
        difficulty: 4,
        reward: { itemId: 'torch', count: 1 },
      },
      interactions: [
        {
          id: 'inscription',
          label: 'Read the worn inscription over the door',
          attribute: 'intelligence',
          difficulty: 4,
          success:
            'The inscription is a burial rite. It names the founders and says they sleep beyond the Shrine of Embers, behind a seal only their rite can break.',
          failure: 'The letters are too worn and weathered to make sense of.',
        },
      ],
      complication: {
        text: 'The old hinges screech through the whole complex.',
        effect: { kind: 'noise' },
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
        reward: { itemId: 'antivenom', count: 1 },
      },
      interactions: [
        {
          id: 'mosaic',
          label: 'Study the cracked mosaic',
          attribute: 'intelligence',
          difficulty: 5,
          success: 'The mosaic is a map of the complex. You commit it to memory: the crypt lies at the far east end.',
          failure: 'The tiles are too broken to make out a pattern.',
        },
        {
          id: 'candelabra',
          label: 'Scrape tallow from the tarnished candelabra',
          attribute: 'agility',
          difficulty: 5,
          success: 'You work the old tallow loose and roll it into a serviceable torch.',
          failure: 'The candelabra wobbles and the tallow crumbles away.',
          reward: { itemId: 'torch', count: 1 },
        },
      ],
      complication: {
        text: 'A rotted ceiling beam gives way above you.',
        effect: { kind: 'damage', amount: 1 },
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
      intel: 'The bunks were abandoned in a hurry, and a shaft of cold air blows from a crack in the east wall.',
      secret: {
        text: 'a roll of clean bandages under a mouldering pillow',
        difficulty: 5,
        reward: { itemId: 'bandage', count: 2 },
      },
      interactions: [
        {
          id: 'rack',
          label: 'Heave the rusted weapon rack aside',
          attribute: 'strength',
          difficulty: 5,
          success: 'The rack topples with a crash, revealing a smoke bomb stashed in the wall behind it.',
          failure: 'The rack is rusted fast to the wall and will not budge.',
          reward: { itemId: 'smokeBomb', count: 1 },
        },
        {
          id: 'footlockers',
          label: 'Rummage through the footlockers',
          attribute: 'luck',
          difficulty: 5,
          success: 'Under a pile of moth-eaten socks you find a wrapped ration.',
          failure: 'The footlockers hold nothing but dust and old bones.',
          reward: { itemId: 'ration', count: 1 },
        },
      ],
      complication: {
        text: 'A draught from the arrow slits whips at your flame.',
        effect: { kind: 'torch' },
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
      intel: 'Something has been dragging crates across the floor. Most of what is left is spoiled.',
      secret: {
        text: 'a crate of dry torches at the back of the room',
        difficulty: 5,
        reward: { itemId: 'torch', count: 2 },
      },
      interactions: [
        {
          id: 'crate',
          label: 'Pry open a sealed crate',
          attribute: 'strength',
          difficulty: 5,
          success: 'The lid splinters open. Inside are well-wrapped rations.',
          failure: 'The crate is nailed shut and the lid holds.',
          reward: { itemId: 'ration', count: 2 },
        },
        {
          id: 'barrels',
          label: 'Sniff out the least spoiled barrel',
          attribute: 'perception',
          difficulty: 4,
          success: 'One barrel of pickled roots is still good, with a roll of bandages tucked behind it.',
          failure: 'Everything smells equally awful.',
          reward: { itemId: 'bandage', count: 1 },
        },
      ],
      complication: {
        text: 'A stack of crates topples onto you.',
        effect: { kind: 'damage', amount: 1 },
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
      interactions: [
        {
          id: 'scrolls',
          label: 'Decipher the waterlogged scrolls',
          attribute: 'intelligence',
          difficulty: 5,
          success:
            'You piece together the founders\u2019 rite: a few lines of old verse. Reciting it will answer part of the Founders\u2019 Seal.',
          failure: 'The ink has run to nothing but grey smears.',
        },
        {
          id: 'desk',
          label: 'Examine the reading desk',
          attribute: 'perception',
          difficulty: 5,
          success:
            'A marginal note in the founders\u2019 hand reads: "Words, fire and stone. Three keys turn the seal, and none of them are made of iron."',
          failure: 'The desk is covered in fresh scratches, but they tell you nothing.',
        },
      ],
      magic: {
        detect: 'The scrolls on the desk shimmer faintly: a lingering ward against fire.',
        identify: 'The ward is a preservation spell. It has kept one shelf of scrolls dry for centuries.',
        dispelDifficulty: 5,
        dispelled: 'The ward fades, and the preserved scrolls crumble to dust.',
      },
      complication: {
        text: 'A loose page brushes your torch and flares.',
        effect: { kind: 'torch' },
      },
    },
    {
      id: 'shrine',
      name: 'Shrine of Embers',
      x: 600,
      y: 250,
      w: 200,
      h: 140,
      description:
        'A stone altar with a ring of cold braziers. The air smells faintly of smoke. To the east, the crypt door glows with a seal of pale light.',
      lesson: 'The crypt door cannot be picked or broken. Something has to be done elsewhere to break the seal.',
      intel: 'The braziers are cold, but the altar stone is warm to the touch. The seal on the east door hums.',
      secret: {
        text: 'a small offering bowl holding old coins and a spare torch',
        difficulty: 5,
        reward: { itemId: 'torch', count: 1 },
      },
      interactions: [
        {
          id: 'altar',
          label: 'Kneel and pray at the altar',
          attribute: 'charisma',
          difficulty: 4,
          success: 'A gentle warmth spreads through you. The shrine accepts the party\u2019s respect.',
          failure: 'The altar stays cold and silent.',
        },
        {
          id: 'braziers',
          label: 'Rekindle the cold braziers',
          attribute: 'agility',
          difficulty: 5,
          success:
            'One after another, the braziers catch. The altar flares and the seal on the crypt door answers with a deep chime.',
          failure: 'The sparks die in the damp air. The braziers stay cold.',
        },
      ],
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
      description: 'Black water laps at a narrow walkway. A pale carved stone glints beneath the surface.',
      lesson: 'Dark rooms hide their exits. Light decides how far ahead you can see.',
      intel: 'The walkway is slick but sound. The pale stone below the water is carved with the same rune as the crypt seal.',
      secret: {
        text: 'a glass vial glinting in the shallows',
        difficulty: 5,
        reward: { itemId: 'antivenom', count: 1 },
      },
      interactions: [
        {
          id: 'walkway',
          label: 'Balance along the slick walkway to its end',
          attribute: 'agility',
          difficulty: 5,
          success: 'You reach the far end without a splash and find a ration sack lashed to a post.',
          failure: 'You slip and retreat, soaked and embarrassed.',
          reward: { itemId: 'ration', count: 1 },
        },
        {
          id: 'stone',
          label: 'Haul the carved stone out of the water',
          attribute: 'strength',
          difficulty: 6,
          success:
            'With a heave you roll the stone onto the walkway. The rune on it flashes, answering part of the Founders\u2019 Seal.',
          failure: 'The stone is far heavier than it looks, and it slides back under.',
        },
      ],
      complication: {
        text: 'You lose your footing and a spare torch slips out of your pack into the black water.',
        effect: { kind: 'drop', itemId: 'torch' },
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
      lesson: 'The end of the delve. Whatever guards it will not let you leave empty-handed.',
      intel: 'The sarcophagi are sealed. Faint runes circle the floor around the central tomb.',
      secret: {
        text: 'a tarnished locket in a cracked sarcophagus',
        difficulty: 6,
        reward: { itemId: 'healingPotion', count: 1 },
      },
      interactions: [
        {
          id: 'runes',
          label: 'Study the runes on the floor',
          attribute: 'intelligence',
          difficulty: 6,
          success: 'The runes are a lullaby for the dead. You read it aloud, and the room settles.',
          failure: 'The runes swim before your eyes. You cannot make sense of them.',
        },
      ],
      magic: {
        detect: 'Wards ring the central tomb, humming with cold, old magic.',
        identify: 'The wards are binding runes meant to keep the sleepers undisturbed.',
        dispelDifficulty: 7,
        dispelled: 'The runes flicker out, and the hum stops.',
      },
    },
  ],
  links: [
    {
      from: 'entrance',
      to: 'greatHall',
      lock: {
        kind: 'door',
        id: 'entranceDoor',
        name: 'Rusted iron door',
        description: 'A rusted iron door bars the way to the Great Hall. Its lock is old and stiff.',
        options: [
          {
            id: 'pick',
            label: 'Pick the lock',
            attribute: 'agility',
            difficulty: 6,
            success: 'The tumblers click one by one and the door groans open.',
            failure: 'The rusted lock jams your pick and the door stays shut.',
          },
          {
            id: 'break',
            label: 'Break down the door',
            attribute: 'strength',
            difficulty: 7,
            success: 'The door bursts off its hinges with a crash.',
            failure: 'The door shudders in its frame, but holds.',
          },
        ],
      },
    },
    { from: 'greatHall', to: 'barracks' },
    { from: 'greatHall', to: 'storeroom' },
    { from: 'greatHall', to: 'shrine' },
    { from: 'barracks', to: 'library' },
    { from: 'library', to: 'shrine' },
    { from: 'storeroom', to: 'cistern' },
    { from: 'cistern', to: 'shrine' },
    {
      from: 'shrine',
      to: 'crypt',
      lock: {
        kind: 'seal',
        id: 'foundersSeal',
        name: 'Founders\u2019 Seal',
        description:
          'A disc of cold light seals the crypt door. It will not yield to picks or force. The seal answers to three things, and they are not found here.',
        requires: [
          {
            flag: interactionFlag('library', 'scrolls'),
            hint: 'It answers to the founders\u2019 words.',
            done: 'The founders\u2019 rite has been learned.',
          },
          {
            flag: interactionFlag('shrine', 'braziers'),
            hint: 'It answers to fire kindled at the shrine.',
            done: 'The shrine\u2019s braziers have been kindled.',
          },
          {
            flag: interactionFlag('cistern', 'stone'),
            hint: 'It answers to the stone sunk in the dark water.',
            done: 'The carved stone has been raised.',
          },
        ],
        broken: 'With a sound like cracking ice, the Founders\u2019 Seal shatters and the crypt door swings open!',
      },
    },
    {
      from: 'barracks',
      to: 'shrine',
      hidden: {
        discovery:
          'a narrow tunnel behind a crack in the east wall, running from the watch room down to the shrine',
      },
    },
  ],
  patrol: {
    delayAfterUnlock: 4,
    enemyIds: ['goblin', 'goblin', 'troll'],
    warning: 'Boots scrape and something heavy drags along the stone. A patrol is close.',
    arrival: 'A goblin patrol led by a cave troll stumbles into the party!',
  },
  boss: {
    roomId: 'crypt',
    enemyIds: ['warden', 'skeleton', 'skeleton'],
    arrival:
      'The sarcophagi grind open. The Barrow Warden rises from its tomb, its skeletal guard clattering to its feet!',
  },
}
