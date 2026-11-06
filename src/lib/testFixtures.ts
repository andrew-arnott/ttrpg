import type { TokenStack } from '../data/types'
import type { PartyMember } from './dungeonState'
import { createPartyMember } from './partyMember'
import { sampleRoster } from './roster'

export function testMember(key: string, torches: number, overrides: Partial<PartyMember> = {}): PartyMember {
  const [sample] = sampleRoster()
  return {
    ...createPartyMember(key, sample.draft),
    name: key,
    inventory: { torch: torches },
    ...overrides,
  }
}

/** A bag that always draws the same single token, so test outcomes are certain. */
export const bagOf = (tokenId: string): TokenStack[] => [{ tokenId, count: 5 }]

export const ALWAYS_PASS = bagOf('critSuccess')
export const ALWAYS_FAIL = bagOf('critFailure')
