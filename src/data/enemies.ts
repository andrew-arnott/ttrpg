/**
 * Enemies do not use the player rules. They have a Defense score that players test
 * against, HP, attacks that resolve after every player has acted, and triggered
 * abilities that usually fire when a Complication is drawn.
 */

/** One blow, whether it is an attack made after the players act or a lunge set off by a trigger. */
export interface StrikeStats {
  /** Subtracted from the target's Defense score. Damage lands only if it exceeds the score. */
  attackValue: number
  damage: number
  /** Hits every player in the room, unless the enemy is Provoked. */
  area?: boolean
  /** A condition token the target gains in their bag when the blow hits. */
  condition?: string
}

export interface EnemyAttack extends StrikeStats {
  name: string
}

export type TriggerEffect =
  | ({ kind: 'strike' } & StrikeStats)
  | { kind: 'empower'; attackBonus: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'condition'; conditionId: string }

export interface EnemyTrigger {
  name: string
  text: string
  effect: TriggerEffect
  /** Fires for a Complication drawn anywhere in the room. Otherwise only for a character engaged with this enemy. */
  global?: boolean
}

export interface EnemyDef {
  id: string
  name: string
  blurb: string
  hp: number
  defense: number
  /** The Perception Difficulty for a character to spot this enemy before it strikes. */
  noticeDifficulty: number
  /** Undead or otherwise vulnerable to divine power, which Smite hits harder. */
  supernatural?: boolean
  attacks: EnemyAttack[]
  /** Fires when a Complication is drawn (including from a Critical Failure). */
  triggers: EnemyTrigger[]
}

export const ENEMIES: EnemyDef[] = [
  {
    id: 'goblin',
    name: 'Goblin Scout',
    blurb: 'A skulking scavenger that darts in whenever someone slips up.',
    hp: 3,
    defense: 3,
    noticeDifficulty: 6,
    attacks: [{ name: 'Rusty Knife', attackValue: 4, damage: 1 }],
    triggers: [
      {
        name: 'Opportunist',
        text: 'When a character engaged with it draws a Complication, lunges at them.',
        effect: { kind: 'strike', attackValue: 4, damage: 1 },
      },
      {
        name: 'Poisoned Blade',
        text: 'When an engaged character draws a Complication, they gain 1 Poison token.',
        effect: { kind: 'condition', conditionId: 'poison' },
      },
    ],
  },
  {
    id: 'troll',
    name: 'Cave Troll',
    blurb: 'A hulking brute that swings wildly at anything in reach.',
    hp: 4,
    defense: 5,
    noticeDifficulty: 3,
    attacks: [
      { name: 'Club Smash', attackValue: 6, damage: 2, condition: 'wound' },
      { name: 'Ground Slam', attackValue: 3, damage: 1, area: true },
    ],
    triggers: [
      {
        name: 'Bellow',
        text: 'When a character engaged with it draws a Complication, flies into a rage: +2 attack value until the end of the round.',
        effect: { kind: 'empower', attackBonus: 2 },
      },
    ],
  },
  {
    id: 'skeleton',
    name: 'Skeleton Guard',
    blurb: 'A rattling sentinel that has stood watch for centuries.',
    hp: 2,
    defense: 3,
    noticeDifficulty: 6,
    supernatural: true,
    attacks: [{ name: 'Bone Claws', attackValue: 4, damage: 1 }],
    triggers: [
      {
        name: 'Clatter',
        text: 'When a character engaged with it draws a Complication, its bones rattle in fury: +1 attack value until the end of the round.',
        effect: { kind: 'empower', attackBonus: 1 },
      },
    ],
  },
  {
    id: 'warden',
    name: 'Barrow Warden',
    blurb: 'The undead guardian of the Founders\u2019 Crypt, bound to its post by the seal you broke.',
    hp: 7,
    defense: 5,
    noticeDifficulty: 5,
    supernatural: true,
    attacks: [
      { name: 'Rusted Greatsword', attackValue: 6, damage: 2 },
      { name: 'Grave Chill', attackValue: 3, damage: 1, area: true, condition: 'fear' },
    ],
    triggers: [
      {
        name: 'Undying',
        text: 'When anyone in the room draws a Complication, the Warden knits itself back together and regains 1 HP.',
        effect: { kind: 'heal', amount: 1 },
        global: true,
      },
    ],
  },
]

export const ENEMIES_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]))
