import type { DungeonState } from '../dungeonState'
import { adjustBag } from '../tokenFlow'
import { updateMember } from './context'

/** Takes a condition token out of the patient's bag for good. */
export function removeConditionToken(state: DungeonState, patientKey: string, tokenId: string): DungeonState {
  return updateMember(state, patientKey, (m) => ({ ...m, bag: adjustBag(m.bag, tokenId, -1) }))
}
