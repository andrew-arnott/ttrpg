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
  fmtSigned,
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
import type { BattleState, SurpriseCheck } from './types'


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
    })),
    groups: {},
    nextGroup: 0,
    log: [arrival],
    result: 'ongoing',
    phase: 'players',
    turnIndex: 0,
    actionsUsed: 0,
    opening: [],
  }

  b.players.forEach((p) => moveToGroup(b, p.key, newGroup(b)))
  const targets = livingPlayers(b)
  b.enemies.forEach((e) => moveToGroup(b, e.id, groupOf(b, pick(targets, rng).key)))

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

/**
 * Each player makes a Perception test, and every enemy whose notice Difficulty that result meets is
 * spotted. Light and watchfulness help. Enemies nobody spotted get a surprise round before the
 * players can act; enemies that were spotted hold back.
 */
function surpriseCheck(engine: Engine, check: SurpriseCheck) {
  const { b } = engine
  const enemies = livingEnemies(b)
  const bonuses = check.modifiers.map((m) => ({ label: m.label, value: m.value }))
  const spotted = new Set<string>()

  for (const p of livingPlayers(b)) {
    const test = playerTest(engine, p, 'perception', 0, bonuses)
    const result = test.result.outcome
    const score = result === 'critical-success' ? Infinity : result === 'critical-failure' ? -Infinity : test.total
    const seen = enemies.filter((e) => ENEMIES_BY_ID[e.defId].noticeDifficulty <= score)
    seen.forEach((e) => spotted.add(e.id))
    const names = seen.map((e) => e.name).join(', ')
    addStep(engine, {
      actor: playerActorOf(p),
      title: 'Look out!',
      intro: `${p.name} peers into the shadows for movement.`,
      test,
      testMode: 'score',
      resultLine: `Tokens ${fmtSigned(test.result.total)} + Perception ${test.attributeValue}${bonuses
        .map((x) => ` ${x.value < 0 ? '-' : '+'} ${x.label} ${Math.abs(x.value)}`)
        .join('')} = ${test.total}`,
      testHeading: `Perception test against each enemy's notice Difficulty (${enemies
        .map((e) => `${e.name} ${ENEMIES_BY_ID[e.defId].noticeDifficulty}`)
        .join(', ')})`,
      outcome: seen.length > 0 ? `${p.name} spots ${names}.` : `${p.name} notices nothing.`,
      tone: seen.length === enemies.length ? 'success' : seen.length > 0 ? 'neutral' : 'failure',
    })
  }

  const ambushers = enemies.filter((e) => !spotted.has(e.id))
  const modifiers =
    check.modifiers.length > 0 ? ` (${check.modifiers.map((m) => `${fmtSigned(m.value)} ${m.label}`).join(', ')})` : ''
  addStep(engine, {
    actor: ambushers[0] ? enemyActorOf(ambushers[0]) : null,
    title: 'Surprise?',
    intro: `The party's eyes against the dark${modifiers}.`,
    outcome:
      ambushers.length === 0
        ? 'Everything was spotted in time. Combat begins on even terms.'
        : `${ambushers.map((e) => e.name).join(', ')} ${ambushers.length === 1 ? 'was' : 'were'} not spotted and strike${ambushers.length === 1 ? 's' : ''} first.`,
    tone: ambushers.length === 0 ? 'success' : 'failure',
  })
  if (ambushers.length === 0) return

  addStep(engine, {
    actor: null,
    title: 'Surprise round',
    intro: 'The party is caught flat-footed.',
    outcome: 'The unspotted enemies attack before anyone can defend.',
    tone: 'failure',
  })
  enemyActions(engine, ambushers)
  resetRoundState(b)
}
