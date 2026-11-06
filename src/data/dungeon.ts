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
}

/** Rooms are laid out so linked room centres line up, keeping every corridor straight. */
export interface DungeonLink {
  from: string
  to: string
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
}

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
  ],
}

export const DUNGEON_BY_ID: Record<string, Dungeon> = { [SUNKEN_CRYPT.id]: SUNKEN_CRYPT }
