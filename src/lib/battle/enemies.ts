import { ENEMIES_BY_ID } from '../../data/enemies'
import { strikePlayer } from './effects'
import { addStep, enemyActorOf, groupOf, livingEnemies, livingPlayers, moveToGroup, pick, playerByKey, playersInGroup, shuffled, type Engine } from './state'
import type { BattleEnemy, BattlePlayer, BattleState } from './types'

export function ensureEngaged(engine: Engine, e: BattleEnemy): { target: BattlePlayer; closedIn: boolean } | null {
  const { b, rng } = engine
  const inGroup = playersInGroup(b, groupOf(b, e.id))
  if (inGroup.length > 0) return { target: pick(inGroup, rng), closedIn: false }
  const players = livingPlayers(b)
  if (players.length === 0) return null
  const target = pick(players, rng)
  moveToGroup(b, e.id, groupOf(b, target.key))
  return { target, closedIn: true }
}

export function enemyTurn(engine: Engine, e: BattleEnemy) {
  makeAttacks(engine, e)
  const { b } = engine
  if (!ENEMIES_BY_ID[e.defId]?.pullsEveryoneIn || e.hp <= 0 || b.result !== 'ongoing') return
  const group = groupOf(b, e.id)
  const dragged = livingPlayers(b).filter((p) => groupOf(b, p.key) !== group)
  if (dragged.length === 0) return
  dragged.forEach((p) => moveToGroup(b, p.key, group))
  addStep(engine, {
    actor: enemyActorOf(e),
    title: 'Inescapable',
    intro: `${e.name} reaches out with a grinding arm.`,
    outcome: `${dragged.map((p) => p.name).join(', ')} ${dragged.length === 1 ? 'is' : 'are'} dragged back into its reach.`,
    tone: 'failure',
  })
}

function makeAttacks(engine: Engine, e: BattleEnemy) {
  const { b } = engine
  const def = ENEMIES_BY_ID[e.defId]
  for (const attack of def?.attacks ?? []) {
    if (b.result !== 'ongoing' || e.hp <= 0) return
    if (attack.area) {
      const provoker = e.provokedBy ? playerByKey(b, e.provokedBy) : undefined
      const victims = provoker && provoker.hp > 0 ? [provoker] : livingPlayers(b)
      victims.forEach((victim, i) => {
        if (b.result !== 'ongoing' || victim.hp <= 0) return
        const intro =
          i === 0
            ? `${e.name} uses ${attack.name}${provoker ? `, but Provoked, can only hit ${provoker.name}` : ', sweeping the whole room'}.`
            : `${attack.name} catches ${victim.name}.`
        strikePlayer(engine, e, attack, victim, intro)
      })
      continue
    }
    const engaged = ensureEngaged(engine, e)
    if (!engaged) return
    const intro = engaged.closedIn
      ? `${e.name} closes in on ${engaged.target.name} and strikes with ${attack.name}.`
      : `${e.name} attacks ${engaged.target.name} with ${attack.name}.`
    strikePlayer(engine, e, attack, engaged.target, intro, { interceptable: true })
  }
}

export function resetRoundState(b: BattleState) {
  b.players.forEach((p) => {
    p.defense = 0
    p.usedThisRound = []
    p.shieldWall = false
  })
  b.enemies.forEach((e) => {
    e.empowered = 0
  })
}

/** The enemies take their turns in random order. A surprise round lets only some of them act. */
export function enemyActions(engine: Engine, acting: BattleEnemy[] = livingEnemies(engine.b)) {
  const { b, rng } = engine
  for (const e of shuffled(acting.filter((a) => a.hp > 0), rng)) {
    if (b.result !== 'ongoing') break
    if (e.hp > 0) enemyTurn(engine, e)
  }
}
