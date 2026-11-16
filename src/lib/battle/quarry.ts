import type { BattleEnemy, BattlePlayer } from './types'

/** The Focus a Ranger has sealed on an enemy. */
export const focusSealedBy = (e: BattleEnemy, p: BattlePlayer) =>
  e.sealed.filter((s) => s.byKey === p.key && (s.as ?? s.tokenId) === 'focus')

/** The enemy carrying the Ranger's sealed Focus is their Quarry. */
export const isQuarry = (e: BattleEnemy, p: BattlePlayer) => e.hp > 0 && focusSealedBy(e, p).length > 0
