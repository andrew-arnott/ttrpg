/**
 * Enemies do not use the player rules. They have a Defense score that players test
 * against, HP, attacks that resolve after every player has acted, and triggered
 * abilities that usually fire when a Complication is drawn.
 */

export interface EnemyAttack {
  name: string
  /** Subtracted from the target's Defense score. Damage lands only if it exceeds the score. */
  attackValue: number
  damage: number
  /** Hits every player in the room, unless the enemy is Provoked. */
  area?: boolean
  /** A condition token the target gains in their bag when the attack hits. */
  condition?: string
}

export type TriggerEffect =
  | { kind: 'strike'; attackValue: number; damage: number }
  | { kind: 'empower'; attackBonus: number }
  | { kind: 'heal'; amount: number }

export interface EnemyTrigger {
  name: string
  text: string
  effect: TriggerEffect
}

export interface EnemyDef {
  id: string
  name: string
  blurb: string
  hp: number
  defense: number
  attacks: EnemyAttack[]
  /** Fires whenever a Complication is drawn (including from a Critical Failure). */
  triggers: EnemyTrigger[]
}

export const ENEMIES: EnemyDef[] = [
  {
    id: 'goblin',
    name: 'Goblin Scout',
    blurb: 'A skulking scavenger that darts in whenever someone slips up.',
    hp: 3,
    defense: 3,
    attacks: [{ name: 'Rusty Knife', attackValue: 4, damage: 1 }],
    triggers: [
      {
        name: 'Opportunist',
        text: 'When a Complication is drawn, lunges at the character who drew it.',
        effect: { kind: 'strike', attackValue: 4, damage: 1 },
      },
    ],
  },
  {
    id: 'troll',
    name: 'Cave Troll',
    blurb: 'A hulking brute that swings wildly at anything in reach.',
    hp: 4,
    defense: 5,
    attacks: [
      { name: 'Club Smash', attackValue: 6, damage: 2, condition: 'wound' },
      { name: 'Ground Slam', attackValue: 3, damage: 1, area: true },
    ],
    triggers: [
      {
        name: 'Bellow',
        text: 'When a Complication is drawn, flies into a rage: +2 attack value until the end of the round.',
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
    attacks: [{ name: 'Bone Claws', attackValue: 4, damage: 1 }],
    triggers: [
      {
        name: 'Clatter',
        text: 'When a Complication is drawn, its bones rattle in fury: +1 attack value until the end of the round.',
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
    attacks: [
      { name: 'Rusted Greatsword', attackValue: 6, damage: 2 },
      { name: 'Grave Chill', attackValue: 3, damage: 1, area: true, condition: 'fear' },
    ],
    triggers: [
      {
        name: 'Undying',
        text: 'When a Complication is drawn, the Warden knits itself back together and regains 1 HP.',
        effect: { kind: 'heal', amount: 1 },
      },
    ],
  },
]

export const ENEMIES_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]))
