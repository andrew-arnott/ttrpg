import { attackEnemy } from './effects'
import { canReact, payForReaction } from '../reactorRules'
import {
  enemiesInGroup,
  enemyById,
  groupOf,
  livingPlayers,
  playerByKey,
  type Defeat,
  type Engine,
} from './state'
import { enemyTargets } from './targets'
import { releaseCommitment } from './tokens'
import type { BattlePlayer, ReactionRequest } from './types'

const CLEAVE_COST = { tokenId: 'resolve', amount: 1 }
const OPPORTUNIST_COST = { tokenId: 'cunning', amount: 1 }

function offerExtraAttack(
  engine: Engine,
  reactor: BattlePlayer,
  defeat: Defeat,
  spec: { abilityId: string; title: string; cost: { tokenId: string; amount: number }; costLabel: string; prompt: string },
) {
  const { b } = engine
  const defeated = enemyById(b, defeat.enemyId)
  const targets = enemiesInGroup(b, groupOf(b, reactor.key))
  if (!canReact(reactor, spec.abilityId, spec.cost) || targets.length === 0) return
  const request: ReactionRequest = {
    abilityId: spec.abilityId,
    reactorKey: reactor.key,
    title: spec.title,
    prompt: spec.prompt.replace('{enemy}', defeated?.name ?? 'the enemy'),
    cost: spec.costLabel,
    targets: enemyTargets(targets),
  }
  const answer = engine.ask(request)
  const target = targets.find((e) => e.id === answer.targetId) ?? targets[0]
  if (!answer.use || !target) return
  const commit = payForReaction(reactor, spec.cost)
  attackEnemy(engine, reactor, target, {
    title: spec.title,
    intro: `${reactor.name} follows through with ${spec.title}.`,
  })
  releaseCommitment(reactor, commit)
}

/**
 * Offers Cleave and Opportunist for every enemy defeated during the action, as soon as
 * the action ends. A follow-up attack that defeats another enemy raises its own offers.
 */
export function offerFollowUps(engine: Engine) {
  while (engine.defeats.length > 0 && engine.b.result === 'ongoing') {
    const defeat = engine.defeats.shift()!
    const killer = playerByKey(engine.b, defeat.byKey)
    if (killer && defeat.viaAttack) {
      offerExtraAttack(engine, killer, defeat, {
        abilityId: 'cleave',
        title: 'Cleave',
        cost: CLEAVE_COST,
        costLabel: '1 Resolve',
        prompt: `{enemy} falls to ${killer.name}. Cleave spends 1 Resolve to attack another enemy straight away.`,
      })
    }
    for (const ally of livingPlayers(engine.b)) {
      if (ally.key === defeat.byKey || groupOf(engine.b, ally.key) !== defeat.groupId) continue
      offerExtraAttack(engine, ally, defeat, {
        abilityId: 'opportunist',
        title: 'Opportunist',
        cost: OPPORTUNIST_COST,
        costLabel: '1 Cunning',
        prompt: `{enemy} falls beside ${ally.name}. Opportunist spends 1 Cunning to attack another enemy in the group straight away.`,
      })
    }
  }
}
