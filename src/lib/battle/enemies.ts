import { ENEMIES_BY_ID } from '../../data/enemies'
import { strikePlayer } from './effects'
import { groupOf, livingEnemies, livingPlayers, moveToGroup, pick, playerByKey, playersInGroup, shuffled, type Engine } from './state'
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
    strikePlayer(engine, e, attack, engaged.target, intro)
  }
}

export function resetRoundState(b: BattleState) {
  b.players.forEach((p) => {
    p.defense = 0
  })
  b.enemies.forEach((e) => {
    e.empowered = 0
  })
}

export function enemyActions(engine: Engine) {
  const { b, rng } = engine
  for (const e of shuffled(livingEnemies(b), rng)) {
    if (b.result !== 'ongoing') break
    if (e.hp > 0) enemyTurn(engine, e)
  }
}
