import { PROFESSIONS } from '../../data/professions'
import { adjustBag } from './state'
import type { BattlePlayer, BoostOption } from './types'

/** Tokens that can be spent in place of a profession resource, and how many it counts for. */
const STAND_INS = [
  { tokenId: 'expertise', value: 1 },
  { tokenId: 'critSuccess', value: 2 },
]

export interface CommittedToken {
  tokenId: string
  value: number
  sealed: boolean
}

/** Tokens taken out of play to pay for something. Whatever is not sealed goes back to the bag afterwards. */
export interface Commitment {
  resourceId: string
  tokens: CommittedToken[]
}

export const noCommitment: Commitment = { resourceId: '', tokens: [] }

const inPlay = (p: BattlePlayer, tokenId: string) => p.resources[tokenId] ?? 0

export const commitmentValue = (c: Commitment) => c.tokens.reduce((sum, t) => sum + t.value, 0)

/** How much of a resource the player can pay: its own tokens plus the Expertise and Critical Success in play. */
export function resourceAvailable(p: BattlePlayer, resourceId: string): number {
  return STAND_INS.reduce((sum, s) => sum + inPlay(p, s.tokenId) * s.value, inPlay(p, resourceId))
}

/**
 * Takes `amount` of a resource out of play, using its own tokens first and then Expertise and
 * Critical Success tokens. A Critical Success is spent whole, so it can overpay. Returns null
 * when the player cannot afford it.
 */
export function commitResource(p: BattlePlayer, resourceId: string, amount: number): Commitment | null {
  if (resourceAvailable(p, resourceId) < amount) return null
  const tokens: CommittedToken[] = []
  let need = amount
  for (const { tokenId, value } of [{ tokenId: resourceId, value: 1 }, ...STAND_INS]) {
    while (need > 0 && inPlay(p, tokenId) > 0) {
      p.resources[tokenId] -= 1
      tokens.push({ tokenId, value, sealed: false })
      need -= value
    }
  }
  return { resourceId, tokens }
}

/** Unsealed committed tokens return to the bag. */
export function releaseCommitment(p: BattlePlayer, c: Commitment) {
  for (const t of c.tokens) if (!t.sealed) p.bag = adjustBag(p.bag, t.tokenId, 1)
}

/** Armor or Power the player can add to a test, if their profession uses it and they have any to spend. */
export function boostOption(p: BattlePlayer, tokenId: BoostOption['tokenId']): BoostOption | undefined {
  const uses = PROFESSIONS.find((prof) => prof.id === p.professionId)?.resources.some((r) => r.tokenId === tokenId)
  const max = resourceAvailable(p, tokenId)
  return uses && max > 0 ? { tokenId, max } : undefined
}
