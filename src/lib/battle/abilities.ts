import { BACKSTAB_DAMAGE, DIVINE_JUDGMENT_DAMAGE, MAX_FIREBALL_MANA } from './types'
import type { BattleEnemy, BattlePlayer, BattleState, CombatOption } from './types'
import {
  attackEnemy,
  blessAlly,
  changeEngagement,
  defend,
  empowerStrike,
  fireball,
  healAlly,
  inspiringCommand,
  magicMissile,
  moveAsOne,
  offerHealerRelease,
  sealOn,
  sweepingBlow,
} from './effects'
import { arcaneFocus, chainLightning, dissonantPulse, gravityWell, transpose } from './spells'
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
  newGroup,
  playerActorOf,
  playerByKey,
  type Engine,
} from './state'
import { resourceAvailable, type Commitment } from './tokens'
import { cleanse } from './conditions'
import { allyTargets, ENGAGED, enemyTargets, groupTargets, onlyEngaged } from './targets'
import { canAttack } from './conditionRules'
import { attackProfile } from '../../data/weapons'

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

/** A Fight option against enemies. Most can only reach the enemies the player is engaged with. */
const enemyFightOptions =
  (reach: 'engaged' | 'room') =>
  ({ b, p, id, base, gate }: OptionContext): CombatOption[] => {
    const living = livingEnemies(b)
    return [
      {
        ...base,
        id,
        targets: enemyTargets(living, reach === 'engaged' ? onlyEngaged(b, p) : undefined),
        disabledReason: gate ?? (living.length === 0 ? NO_ENEMY : undefined),
      },
    ]
  }

/** Which enemies a character's ordinary attack can reach: only those they are engaged with, unless their weapon is ranged. */
const attackReach = (b: BattleState, ally: BattlePlayer) =>
  attackProfile(ally.hands).ranged ? undefined : onlyEngaged(b, ally)

const allyOptions = ({ b, id, base, gate }: OptionContext): CombatOption[] => [
  { ...base, id, targets: allyTargets(b), disabledReason: gate },
]

export const unsupportedAbility: AbilityHandler = {
  options: ({ id, base }) => [{ ...base, id, disabledReason: UNSUPPORTED }],
  perform: () => {},
}

export const ABILITY_HANDLERS: Record<string, AbilityHandler> = {
  provoke: {
    options: enemyFightOptions('room'),
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
    options: enemyFightOptions('engaged'),
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
  shieldBash: {
    options: enemyFightOptions('engaged'),
    perform: ({ engine, p, enemy, boost }) => {
      if (!enemy) return
      attackEnemy(engine, p, enemy, {
        title: 'Shield Bash',
        power: boost,
        onHit: (e) => {
          e.shovedBy = p.key
          moveToGroup(engine.b, e.id, newGroup(engine.b))
          return `${e.name} is knocked out of the fight. It is no longer engaged, so on its turn it can only close in.`
        },
      })
    },
  },
  sweepingBlow: {
    options: ({ b, p, id, base, gate }) => [
      {
        ...base,
        id,
        disabledReason: gate ?? (engagedEnemies(b, p).length === 0 ? 'No enemy you are engaged with' : undefined),
      },
    ],
    perform: ({ engine, p, boost }) => sweepingBlow(engine, p, boost),
  },
  cheapShot: {
    options: enemyFightOptions('engaged'),
    perform: ({ engine, p, enemy, commit, boost }) => {
      if (!enemy) return
      attackEnemy(engine, p, enemy, {
        title: 'Cheap Shot',
        power: boost,
        onHit: (e) => `${sealOn(p, e, commit)} ${e.name} is Exposed: Defense ${enemyDefense(e)}.`,
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
    perform: ({ engine, p, ally, commit }) => {
      if (ally) healAlly(engine, p, ally, commit)
    },
  },
  cleanse: {
    options: allyOptions,
    perform: ({ engine, p, ally }) => {
      if (!ally) return
      const released = cleanse(ally)
      const healer = released > 0 ? offerHealerRelease(engine, ally, 'had conditions removed') : ''
      addStep(engine, {
        actor: playerActorOf(p),
        title: 'Cleanse',
        intro: `${p.name} washes the taint from ${ally.name}.`,
        outcome: `${released > 0 ? `${released} sealed condition${released === 1 ? '' : 's'} returned to ${ally.name}'s bag.` : `${ally.name} has nothing sealed.`}${healer}`,
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
  gravityWell: {
    options: ({ b, id, base, gate }) => {
      const groups = distinctGroupIds(b)
      const pairs = groups.flatMap((a, i) =>
        groups.slice(i + 1).map((c) => ({ id: `${a}|${c}`, label: `${describeGroup(b, a)} with ${describeGroup(b, c)}` })),
      )
      return [{ ...base, id, targets: pairs, disabledReason: gate ?? (pairs.length === 0 ? 'Needs two engagement groups' : undefined) }]
    },
    perform: ({ engine, p, target }) => {
      const [first, second] = target.split('|')
      if (first && second) gravityWell(engine, p, first, second)
    },
  },
  dissonantPulse: {
    options: ({ b, id, base, gate }) => {
      const groups = distinctGroupIds(b)
        .filter((g) => enemiesInGroup(b, g).length > 0)
        .map((g) => ({ id: g, label: describeGroup(b, g) }))
      return [{ ...base, id, targets: groups, disabledReason: gate ?? (groups.length === 0 ? NO_ENEMY : undefined) }]
    },
    perform: ({ engine, p, target, commit }) => dissonantPulse(engine, p, target, commit),
  },
  arcaneFocus: {
    options: ({ id, base, gate }) => [{ ...base, id, disabledReason: gate }],
    perform: ({ engine, p }) => arcaneFocus(engine, p),
  },
  blessAbility: {
    options: allyOptions,
    perform: ({ engine, p, ally, commit }) => {
      if (ally) blessAlly(engine, p, ally, commit)
    },
  },
  empowerTheStrike: {
    options: allyOptions,
    perform: ({ engine, p, ally, commit }) => {
      if (ally) empowerStrike(engine, p, ally, commit)
    },
  },
  inspiringCommand: {
    options: ({ b, id, base, gate }) =>
      livingPlayers(b).map((ally) => ({
        ...base,
        id: `${id}:${ally.key}`,
        label: `Inspiring Command: ${ally.name}`,
        targets: enemyTargets(livingEnemies(b), attackReach(b, ally)),
        disabledReason: gate ?? (canAttack(ally) ? undefined : `${ally.name} cannot attack`),
      })),
    perform: ({ engine, p, enemy, extra, commit }) => {
      const ally = extra ? playerByKey(engine.b, extra) : undefined
      if (ally && enemy) inspiringCommand(engine, p, ally, enemy, commit)
    },
  },
  moveAsOne: {
    options: ({ b, id, base, gate }) =>
      livingPlayers(b).map((ally) => ({
        ...base,
        id: `${id}:${ally.key}`,
        label: `Move as One: ${ally.name}`,
        targets: groupTargets(b, ally, false),
        disabledReason: gate,
      })),
    perform: ({ engine, p, target, extra, commit }) => {
      const ally = extra ? playerByKey(engine.b, extra) : undefined
      if (ally) moveAsOne(engine, p, ally, target, commit)
    },
  },
  divineJudgment: {
    options: enemyFightOptions('engaged'),
    perform: ({ engine, p, enemy, boost }) => {
      if (!enemy) return
      attackEnemy(engine, p, enemy, {
        title: 'Divine Judgment',
        power: boost,
        totalDamage: DIVINE_JUDGMENT_DAMAGE,
        intro: `${p.name} calls down divine judgment on ${enemy.name}.`,
      })
    },
  },
  magicMissile: {
    options: ({ b, p, id, base, gate }) => {
      const engaged = engagedEnemies(b, p)
      const living = livingEnemies(b)
      return [
        {
          ...base,
          id,
          targets: enemyTargets(living, (e) => (engaged.includes(e) ? ENGAGED : undefined)),
          disabledReason: gate ?? (living.length === 0 ? NO_ENEMY : undefined),
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
