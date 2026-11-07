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
}

export type TriggerEffect =
  | { kind: 'strike'; attackValue: number; damage: number }
  | { kind: 'empower'; attackBonus: number }

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
      { name: 'Club Smash', attackValue: 6, damage: 2 },
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
]

export const ENEMIES_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]))
