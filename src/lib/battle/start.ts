import { ENEMIES_BY_ID, type EnemyDef } from '../../data/enemies'
import { STANDARD_BAG } from '../../data/tokens'
import type { Rng } from '../drawTest'
import type { PartyMember, Preparation } from '../dungeonState'
import { performSkillTest } from '../skillTest'
import { attackEnemy } from './effects'
import { enemyActions, resetRoundState } from './enemies'
import {
  addStep,
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
import { FORTIFY_DEFENSE, SURPRISE_BASE_DIFFICULTY } from './types'
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
      shieldsInPlay: 0,
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

  const engine: Engine = { b, rng, steps: [] }
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
      p.defense += FORTIFY_DEFENSE
      addStep(engine, {
        actor: playerActorOf(p),
        title: 'Fortified',
        intro: `${p.name}'s preparations pay off.`,
        outcome: `${p.name} begins combat with +${FORTIFY_DEFENSE} Defense.`,
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
 * The enemy group makes a Perception test to surprise the party. Stand Watch, Keep Watch
 * and a bright torch make that harder; a dim or dead torch makes it easier. If they
 * succeed they get a full round of attacks before anyone can act.
 */
function surpriseCheck(engine: Engine, check: SurpriseCheck) {
  const { b } = engine
  const difficulty = SURPRISE_BASE_DIFFICULTY + check.modifiers.reduce((sum, m) => sum + m.value, 0)
  const test = performSkillTest(STANDARD_BAG, 'perception', check.perception, difficulty, engine.rng)
  const lead = livingEnemies(b)[0]
  const surprised = test.passed
  const breakdown = [
    `${SURPRISE_BASE_DIFFICULTY} base`,
    ...check.modifiers.map((m) => `${fmtSigned(m.value)} ${m.label}`),
  ].join(', ')

  addStep(engine, {
    actor: lead ? enemyActorOf(lead) : null,
    title: 'Surprise?',
    intro: 'The enemies creep closer, trying to catch the party off guard.',
    test,
    testMode: 'score',
    testHeading: `Enemy Perception test \u00b7 Difficulty ${difficulty} (${breakdown})`,
    bagLabel: "The enemies' bag",
    resultLine: `Tokens ${fmtSigned(test.result.total)} + Perception ${check.perception} = ${test.total} against ${difficulty}: ${
      surprised ? 'the enemies succeed' : 'the party notices them'
    }`,
    outcome: surprised
      ? 'The enemies strike from the shadows! They get a surprise round before anyone can act.'
      : 'The party spots them in time. Combat begins on even terms.',
    tone: surprised ? 'failure' : 'success',
  })
  if (!surprised) return

  addStep(engine, {
    actor: null,
    title: 'Surprise round',
    intro: 'The party is caught flat-footed.',
    outcome: 'The enemies attack before anyone can defend.',
    tone: 'failure',
  })
  enemyActions(engine)
  resetRoundState(b)
}
