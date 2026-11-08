import { BACKSTAB_DAMAGE, MAX_FIREBALL_MANA } from './types'
import type { BattleEnemy, BattlePlayer, BattleState, CombatOption } from './types'
import { attackEnemy, blessAlly, changeEngagement, fireball, healAlly, magicMissile, sealOn } from './effects'
import {
  distinctGroupIds,
  describeGroup,
  enemiesInGroup,
  enemyDefense,
  engagedEnemies,
  groupOf,
  livingEnemies,
  moveToGroup,
  spend,
  type Engine,
} from './state'
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
}

export interface AbilityHandler {
  options(ctx: OptionContext): CombatOption[]
  perform(ctx: PerformContext): void
  /** The handler pays its own cost, because the amount is chosen with the option. */
  paysOwnCost?: boolean
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
    perform: ({ engine, p, enemy }) => {
      if (!enemy) return
      attackEnemy(engine, p, enemy, {
        title: 'Provoke',
        onHit: (e) => {
          e.provokedBy = p.key
          moveToGroup(engine.b, e.id, groupOf(engine.b, p.key))
          return `${sealOn(p, e, 'resolve')} ${e.name} is Provoked and engages ${p.name}.`
        },
      })
    },
  },
  disable: {
    options: enemyFightOptions,
    perform: ({ engine, p, enemy }) => {
      if (!enemy) return
      attackEnemy(engine, p, enemy, {
        title: 'Disable',
        onHit: (e) => {
          e.disabled = true
          return `${sealOn(p, e, 'resolve')} Its damage is reduced for each Resolve sealed.`
        },
      })
    },
  },
  cheapShot: {
    options: enemyFightOptions,
    perform: ({ engine, p, enemy }) => {
      if (!enemy) return
      attackEnemy(engine, p, enemy, {
        title: 'Cheap Shot',
        onHit: (e) => `${sealOn(p, e, 'cunning')} ${e.name} is Exposed: Defense ${enemyDefense(e)}.`,
      })
    },
  },
  smite: {
    options: enemyFightOptions,
    perform: ({ engine, p, enemy }) => {
      if (enemy) attackEnemy(engine, p, enemy, { title: 'Smite' })
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
    perform: ({ engine, p, enemy }) => {
      if (!enemy) return
      moveToGroup(engine.b, p.key, groupOf(engine.b, enemy.id))
      attackEnemy(engine, p, enemy, {
        title: 'Backstab',
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
    paysOwnCost: true,
    options: ({ b, p, id, base }) => {
      const groups = distinctGroupIds(b)
        .filter((g) => enemiesInGroup(b, g).length > 0)
        .map((g) => ({ id: g, label: describeGroup(b, g) }))
      const mana = p.resources.mana ?? 0
      return Array.from({ length: MAX_FIREBALL_MANA }, (_, i) => i + 1).map((x) => ({
        ...base,
        id: `${id}:${x}`,
        label: `Fireball (${x} Mana)`,
        targets: groups,
        disabledReason: mana < x ? `Needs ${x} Mana` : groups.length === 0 ? NO_ENEMY : undefined,
      }))
    },
    perform: ({ engine, p, target, extra }) => {
      const mana = Number(extra)
      spend(p, 'mana', mana)
      fireball(engine, p, target, mana)
    },
  },
}
