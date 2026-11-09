import { ENEMIES_BY_ID } from '../../data/enemies'
import { BACKSTAB_DAMAGE, MAX_FIREBALL_MANA, SMITE_BONUS_DAMAGE } from './types'
import type { BattleEnemy, BattlePlayer, BattleState, CombatOption } from './types'
import { attackEnemy, blessAlly, changeEngagement, defend, fireball, healAlly, magicMissile, sealOn } from './effects'
import { arcaneFocus, chainLightning, transpose } from './spells'
import {
  distinctGroupIds,
  describeGroup,
  enemiesInGroup,
  enemyDefense,
  engagedEnemies,
  groupOf,
  livingEnemies,
  addStep,
  livingPlayers,
  moveToGroup,
  playerActorOf,
  type Engine,
} from './state'
import { resourceAvailable, type Commitment } from './tokens'
import { cleanse } from './conditions'
import { allyTargets, enemyTargets, groupTargets } from './targets'

const UNSUPPORTED = 'Not in the sample battle yet'
const NO_ENEMY = 'No enemy to target'

type OptionBase = Pick<CombatOption, 'slot' | 'label' | 'description'>

export interface OptionContext {
  b: BattleState
  p: BattlePlayer
  id: string
  base: OptionBase
  /** Why the ability's cost cannot be paid, if it cannot. */
  gate?: string
}

export interface PerformContext {
  engine: Engine
  p: BattlePlayer
  target: string
  /** Anything after the ability id in the option id, such as the Mana a Fireball spends. */
  extra?: string
  enemy?: BattleEnemy
  ally?: BattlePlayer
  /** The tokens paid for the ability. Sealing one keeps it from returning to the bag. */
  commit: Commitment
  /** Power committed to an attack, or Armor to a Defend. */
  boost: number
}

export interface AbilityHandler {
  options(ctx: OptionContext): CombatOption[]
  perform(ctx: PerformContext): void
  /** The cost when it depends on the option chosen, such as the Mana a Fireball spends. */
  costOf?(extra: string | undefined): { tokenId: string; amount: number }
}

const enemyFightOptions = ({ b, p, id, base, gate }: OptionContext): CombatOption[] => {
  const living = livingEnemies(b)
  return [
    {
      ...base,
      id,
      targets: enemyTargets(living, engagedEnemies(b, p)),
      requiresEngaged: true,
      disabledReason: gate ?? (living.length === 0 ? NO_ENEMY : undefined),
    },
  ]
}

const allyOptions = ({ b, id, base, gate }: OptionContext): CombatOption[] => [
  { ...base, id, targets: allyTargets(b), disabledReason: gate },
]

export const unsupportedAbility: AbilityHandler = {
  options: ({ id, base }) => [{ ...base, id, disabledReason: UNSUPPORTED }],
  perform: () => {},
}

export const ABILITY_HANDLERS: Record<string, AbilityHandler> = {
  provoke: {
    options: enemyFightOptions,
    perform: ({ engine, p, enemy, commit, boost }) => {
      if (!enemy) return
      attackEnemy(engine, p, enemy, {
        title: 'Provoke',
        power: boost,
        onHit: (e) => {
          e.provokedBy = p.key
          moveToGroup(engine.b, e.id, groupOf(engine.b, p.key))
          return `${sealOn(p, e, commit)} ${e.name} is Provoked and engages ${p.name}.`
        },
      })
    },
  },
  disable: {
    options: enemyFightOptions,
    perform: ({ engine, p, enemy, commit, boost }) => {
      if (!enemy) return
      attackEnemy(engine, p, enemy, {
        title: 'Disable',
        power: boost,
        onHit: (e) => {
          e.disabled = true
          return `${sealOn(p, e, commit)} Its damage is reduced for each Resolve sealed.`
        },
      })
    },
  },
  cheapShot: {
    options: enemyFightOptions,
    perform: ({ engine, p, enemy, commit, boost }) => {
      if (!enemy) return
      attackEnemy(engine, p, enemy, {
        title: 'Cheap Shot',
        power: boost,
        onHit: (e) => `${sealOn(p, e, commit)} ${e.name} is Exposed: Defense ${enemyDefense(e)}.`,
      })
    },
  },
  smite: {
    options: enemyFightOptions,
    perform: ({ engine, p, enemy, boost }) => {
      if (!enemy) return
      const smitten = ENEMIES_BY_ID[enemy.defId]?.supernatural
      attackEnemy(engine, p, enemy, {
        title: 'Smite',
        power: boost,
        bonusDamage: smitten ? SMITE_BONUS_DAMAGE : 0,
        onHit: () => (smitten ? `Divine power burns the ${enemy.name.toLowerCase()} for ${SMITE_BONUS_DAMAGE} extra.` : ''),
      })
    },
  },
  backstab: {
    options: ({ b, p, id, base, gate }) => [
      {
        ...base,
        id,
        targets: enemyTargets(livingEnemies(b)),
        disabledReason: gate ?? (engagedEnemies(b, p).length > 0 ? 'You must not be engaged' : undefined),
      },
    ],
    perform: ({ engine, p, enemy, boost }) => {
      if (!enemy) return
      moveToGroup(engine.b, p.key, groupOf(engine.b, enemy.id))
      attackEnemy(engine, p, enemy, {
        title: 'Backstab',
        power: boost,
        intro: `${p.name} slips behind ${enemy.name} and strikes.`,
        bonusDamage: BACKSTAB_DAMAGE,
      })
    },
  },
  slipAway: {
    options: ({ b, p, id, base, gate }) => [{ ...base, id, targets: groupTargets(b, p, false), disabledReason: gate }],
    perform: ({ engine, p, target }) => changeEngagement(engine, p, target, false),
  },
  heal: {
    options: allyOptions,
    perform: ({ engine, p, ally }) => {
      if (ally) healAlly(engine, p, ally)
    },
  },
  cleanse: {
    options: allyOptions,
    perform: ({ engine, p, ally }) => {
      if (!ally) return
      const released = cleanse(ally)
      addStep(engine, {
        actor: playerActorOf(p),
        title: 'Cleanse',
        intro: `${p.name} washes the taint from ${ally.name}.`,
        outcome: released > 0 ? `${released} sealed condition${released === 1 ? '' : 's'} returned to ${ally.name}'s bag.` : `${ally.name} has nothing sealed.`,
        tone: released > 0 ? 'success' : 'neutral',
      })
    },
  },
  shieldWall: {
    options: ({ id, base, gate }) => [{ ...base, id, disabledReason: gate }],
    perform: ({ engine, p, boost }) => {
      defend(engine, p, boost, 'Shield Wall')
      p.shieldWall = true
    },
  },
  chainLightning: {
    costOf: () => ({ tokenId: 'mana', amount: 1 }),
    options: ({ b, p, id, base, gate }) => {
      const living = livingEnemies(b)
      return [
        {
          ...base,
          id,
          targets: enemyTargets(living),
          disabledReason:
            gate ??
            (resourceAvailable(p, 'mana') < 1 ? 'Needs 1 Mana' : living.length === 0 ? NO_ENEMY : undefined),
        },
      ]
    },
    perform: ({ engine, p, enemy }) => {
      if (enemy) chainLightning(engine, p, enemy)
    },
  },
  transpose: {
    options: ({ b, p, id, base, gate }) => {
      const others = [
        ...livingPlayers(b).filter((a) => a.key !== p.key).map((a) => ({ id: a.key, label: `${a.name} (${describeGroup(b, groupOf(b, a.key))})` })),
        ...livingEnemies(b).map((e) => ({ id: e.id, label: `${e.name} (${describeGroup(b, groupOf(b, e.id))})` })),
      ]
      return [{ ...base, id, targets: others, disabledReason: gate ?? (others.length === 0 ? 'Nobody to swap with' : undefined) }]
    },
    perform: ({ engine, p, target, enemy, ally }) => {
      const name = enemy?.name ?? ally?.name
      if (name) transpose(engine, p, target, name)
    },
  },
  arcaneFocus: {
    options: ({ id, base, gate }) => [{ ...base, id, disabledReason: gate }],
    perform: ({ engine, p }) => arcaneFocus(engine, p),
  },
  blessAbility: {
    options: allyOptions,
    perform: ({ engine, p, ally }) => {
      if (ally) blessAlly(engine, p, ally)
    },
  },
  magicMissile: {
    options: ({ b, p, id, base, gate }) => {
      const engaged = engagedEnemies(b, p)
      const outside = livingEnemies(b).filter((e) => !engaged.includes(e))
      return [
        {
          ...base,
          id,
          targets: enemyTargets(outside),
          disabledReason: gate ?? (outside.length === 0 ? 'No enemy outside your engagement group' : undefined),
        },
      ]
    },
    perform: ({ engine, p, enemy }) => {
      if (enemy) magicMissile(engine, p, enemy)
    },
  },
  fireball: {
    costOf: (extra) => ({ tokenId: 'mana', amount: Number(extra) }),
    options: ({ b, p, id, base }) => {
      const groups = distinctGroupIds(b)
        .filter((g) => enemiesInGroup(b, g).length > 0)
        .map((g) => ({ id: g, label: describeGroup(b, g) }))
      const mana = resourceAvailable(p, 'mana')
      return Array.from({ length: MAX_FIREBALL_MANA }, (_, i) => i + 1).map((x) => ({
        ...base,
        id: `${id}:${x}`,
        label: `Fireball (${x} Mana)`,
        targets: groups,
        disabledReason: mana < x ? `Needs ${x} Mana` : groups.length === 0 ? NO_ENEMY : undefined,
      }))
    },
    perform: ({ engine, p, target, extra }) => fireball(engine, p, target, Number(extra)),
  },
}
