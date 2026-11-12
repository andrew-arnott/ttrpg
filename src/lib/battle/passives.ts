import { recoverToken } from '../tokenFlow'
import { addStep, engagedEnemies, playerActorOf, type Engine } from './state'
import type { BattlePlayer } from './types'

/** Patient Shadow: ending a turn unengaged recovers 1 Cunning from the bag into play. */
function patientShadow(engine: Engine, p: BattlePlayer) {
  if (!p.abilityIds.includes('patientShadow') || engagedEnemies(engine.b, p).length > 0) return
  if (!recoverToken(p, 'cunning')) return
  addStep(engine, {
    actor: playerActorOf(p),
    title: 'Patient Shadow',
    intro: `${p.name} ends their turn unengaged.`,
    outcome: `${p.name} recovers 1 Cunning.`,
    tone: 'success',
  })
}

/** What happens when a player's turn ends. */
export function endOfTurn(engine: Engine, p: BattlePlayer) {
  if (p.hp > 0) patientShadow(engine, p)
}
