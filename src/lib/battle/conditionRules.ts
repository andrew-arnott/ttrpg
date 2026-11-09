import { sealedOf } from '../conditionRules'
import { ACTIONS_PER_TURN } from './types'
import type { BattlePlayer } from './types'

export * from '../conditionRules'

/**
 * A Fatigue sealed before this round began costs one action at the start of the turn, however many
 * are sealed. One sealed during this round's turn waits for the next.
 */
export const actionsThisTurn = (p: BattlePlayer, round: number) =>
  ACTIONS_PER_TURN - (sealedOf(p).some((c) => c.tokenId === 'fatigue' && c.round < round) ? 1 : 0)

