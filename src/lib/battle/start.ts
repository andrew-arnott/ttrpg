import { ENEMIES_BY_ID, type EnemyDef } from '../../data/enemies'
import type { Rng } from '../drawTest'
import type { PartyMember, Preparation } from '../dungeonState'
import { attackEnemy, playerTest } from './effects'
import { enemyActions, resetRoundState } from './enemies'
import {
  addStep,
  createEngine,
  describeGroup,
  distinctGroupIds,
  enemyActorOf,
  finalStep,
  groupOf,
  livingEnemies,
  livingPlayers,
  moveToGroup,
  newGroup,
  pick,
  playerActorOf,
  playerByKey,
  updateResult,
  type Engine,
} from './state'
import { FORTIFY_DEFENSE } from './types'
import type { TestBonus } from '../skillTest'
import type { BattleEnemy, BattleState, SurpriseCheck } from './types'


function nameEnemies(defs: EnemyDef[]): { id: string; name: string; def: EnemyDef }[] {
  const totals = new Map<string, number>()
  defs.forEach((d) => totals.set(d.id, (totals.get(d.id) ?? 0) + 1))
  const seen = new Map<string, number>()
  return defs.map((def) => {
    const index = seen.get(def.id) ?? 0
    seen.set(def.id, index + 1)
    const many = (totals.get(def.id) ?? 0) > 1
    const letter = String.fromCharCode(65 + index)
    return { id: many ? `${def.id}-${letter}` : def.id, name: many ? `${def.name} ${letter}` : def.name, def }
  })
}

/**
 * Sets up a fight. Each player begins in their own engagement group and every
 * enemy engages a random player. Preparations made in the room beforehand
 * (Fortify, Set an Ambush) play out as the opening steps.
 */
export function startBattle(
  party: PartyMember[],
  prepared: Preparation[],
  enemyIds: string[],
  rng: Rng,
  arrival: string,
  surprise: SurpriseCheck | null,
  options: { unwarded?: boolean; light?: TestBonus | null } = {},
): BattleState {
  const defs = enemyIds.flatMap((id) => (ENEMIES_BY_ID[id] ? [ENEMIES_BY_ID[id]] : []))
  const b: BattleState = {
    round: 1,
    players: party.map((m, i) => ({
      key: m.key,
      name: m.name,
      professionId: m.professionId,
      hp: m.hp,
      maxHp: m.maxHp,
      special: m.special,
      bag: m.bag.map((s) => ({ ...s })),
      resources: { ...m.resources },
      abilityIds: m.abilityIds,
      shieldsInPlay: m.shieldsInPlay,
      hands: m.hands,
      defense: 0,
      colorIndex: i,
    })),
    enemies: nameEnemies(defs).map(({ id, name, def }) => ({
      id,
      defId: def.id,
      name,
      hp: def.hp,
      maxHp: def.hp,
      defense: def.defense,
      sealed: [],
      disabled: false,
      provokedBy: null,
      empowered: 0,
      unwarded: options.unwarded,
    })),
    groups: {},
    nextGroup: 0,
    log: [arrival],
    result: 'ongoing',
    phase: 'players',
    turnIndex: 0,
    actionsUsed: 0,
    opening: [],
    light: options.light ?? null,
  }

  b.players.forEach((p) => moveToGroup(b, p.key, newGroup(b)))
  const targets = livingPlayers(b)
  b.enemies.forEach((e) => moveToGroup(b, e.id, groupOf(b, pick(targets, rng).key)))
  const sticky = b.enemies.find((e) => ENEMIES_BY_ID[e.defId]?.startsEngagedWithAll)
  if (sticky) {
    const shared = newGroup(b)
    b.players.forEach((p) => moveToGroup(b, p.key, shared))
    moveToGroup(b, sticky.id, shared)
  }

  const engine = createEngine(b, rng)
  const engagements = distinctGroupIds(b).map((g) => describeGroup(b, g))
  addStep(engine, {
    actor: null,
    title: 'Battle!',
    intro: arrival,
    outcome: `Engaged: ${engagements.join('; ')}.`,
    tone: 'failure',
  })

  for (const prep of prepared) {
    const p = playerByKey(b, prep.memberKey)
    if (!p) continue
    if (prep.tag === 'Fortified') {
      livingPlayers(b).forEach((ally) => {
        ally.defense += FORTIFY_DEFENSE
      })
      addStep(engine, {
        actor: playerActorOf(p),
        title: 'Fortified',
        intro: `${p.name}'s preparations pay off.`,
        outcome: `Everyone begins combat with +${FORTIFY_DEFENSE} Defense.`,
        tone: 'success',
      })
    } else if (prep.tag === 'Ambush set') {
      const victims = livingEnemies(b)
      if (victims.length > 0) {
        attackEnemy(engine, p, pick(victims, rng), { title: 'Ambush!', intro: `${p.name} springs the ambush.` })
      }
    }
  }

  if (surprise && b.result === 'ongoing') surpriseCheck(engine, surprise)

  updateResult(b)
  finalStep(engine)
  b.turnIndex = Math.max(0, b.players.findIndex((p) => p.hp > 0))
  b.opening = engine.steps
  return b
}

/** The middle notice Difficulty of the enemies; with an even number, the average of the middle two, rounded up. */
export function medianNoticeDifficulty(enemies: BattleEnemy[]): number {
  const sorted = enemies.map((e) => ENEMIES_BY_ID[e.defId].noticeDifficulty).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : Math.ceil((sorted[mid - 1] + sorted[mid]) / 2)
}

/**
 * Each player makes one Perception test against the median notice Difficulty of the enemies. If
 * anyone passes, the party sees the danger coming. If nobody does, the enemies get a surprise
 * round before the players can act. Light and watchfulness help, as they do on every test.
 */
function surpriseCheck(engine: Engine, check: SurpriseCheck) {
  const { b } = engine
  const enemies = livingEnemies(b)
  const difficulty = medianNoticeDifficulty(enemies)
  const bonuses = check.modifiers.map((m) => ({ label: m.label, value: m.value }))
  let spotted = false

  for (const p of livingPlayers(b)) {
    const test = playerTest(engine, p, 'perception', difficulty, bonuses)
    spotted = spotted || test.passed
    addStep(engine, {
      actor: playerActorOf(p),
      title: 'Look out!',
      intro: `${p.name} peers into the shadows for movement.`,
      test,
      testMode: 'check',
      testHeading: `Perception test \u00b7 Difficulty ${difficulty}, the median of the enemies' notice Difficulties`,
      outcome: test.passed ? `${p.name} spots the danger.` : `${p.name} notices nothing.`,
      tone: test.passed ? 'success' : 'failure',
    })
  }

  addStep(engine, {
    actor: spotted ? null : enemyActorOf(enemies[0]),
    title: 'Surprise?',
    intro: 'The party strains to see what is out there.',
    outcome: spotted
      ? 'Someone spotted them in time. Combat begins on even terms.'
      : 'Nobody saw them coming. The enemies strike first!',
    tone: spotted ? 'success' : 'failure',
  })
  if (spotted) return

  addStep(engine, {
    actor: null,
    title: 'Surprise round',
    intro: 'The party is caught flat-footed.',
    outcome: 'The enemies attack before anyone can defend.',
    tone: 'failure',
  })
  enemyActions(engine, enemies)
  resetRoundState(b)
}
