import { PROFESSIONS } from '../../data/professions'
import { resourceAvailable } from '../tokenFlow'
import type { BattlePlayer, BoostOption } from './types'

export {
  commitResource,
  commitmentValue,
  noCommitment,
  releaseCommitment,
  resourceAvailable,
  type Commitment,
  type CommittedToken,
} from '../tokenFlow'

/** Armor or Power the player can add to a test, if their profession uses it and they have any to spend. */
export function boostOption(p: BattlePlayer, tokenId: BoostOption['tokenId']): BoostOption | undefined {
  const uses = PROFESSIONS.find((prof) => prof.id === p.professionId)?.resources.some((r) => r.tokenId === tokenId)
  const max = resourceAvailable(p, tokenId)
  return uses && max > 0 ? { tokenId, max } : undefined
}
