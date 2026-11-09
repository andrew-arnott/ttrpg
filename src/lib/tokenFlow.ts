import type { TokenStack } from '../data/types'

/** Anything with a bag and tokens in play: a party member or a combatant. */
export interface TokenHolder {
  bag: TokenStack[]
  resources: Record<string, number>
}

export const countInBag = (bag: TokenStack[], tokenId: string): number =>
  bag.find((s) => s.tokenId === tokenId)?.count ?? 0

export function adjustBag(bag: TokenStack[], tokenId: string, delta: number): TokenStack[] {
  const existing = bag.find((s) => s.tokenId === tokenId)
  if (!existing) return delta > 0 ? [...bag, { tokenId, count: delta }] : bag
  return bag
    .map((s) => (s.tokenId === tokenId ? { ...s, count: s.count + delta } : s))
    .filter((s) => s.count > 0)
}

/** Recover: moves one token from the bag straight into play. Returns false if the bag has none. */
export function recoverToken(holder: TokenHolder, tokenId: string): boolean {
  if (countInBag(holder.bag, tokenId) <= 0) return false
  holder.bag = adjustBag(holder.bag, tokenId, -1)
  holder.resources = { ...holder.resources, [tokenId]: (holder.resources[tokenId] ?? 0) + 1 }
  return true
}

/** Resource tokens a rest can recover, best match first: the profession's own, then Expertise, then a Critical Success. */
export const restCandidates = (professionResource: string): string[] => [
  professionResource,
  'expertise',
  'critSuccess',
]

export function recoverForRest(holder: TokenHolder, professionResource: string): string | null {
  return restCandidates(professionResource).find((id) => recoverToken(holder, id)) ?? null
}

export const canRest = (holder: TokenHolder, professionResource: string): boolean =>
  restCandidates(professionResource).some((id) => countInBag(holder.bag, id) > 0)

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

const inPlay = (p: TokenHolder, tokenId: string) => p.resources[tokenId] ?? 0

export const commitmentValue = (c: Commitment) => c.tokens.reduce((sum, t) => sum + t.value, 0)

/** How much of a resource the holder can pay: its own tokens plus the Expertise and Critical Success in play. */
export function resourceAvailable(p: TokenHolder, resourceId: string): number {
  return STAND_INS.reduce((sum, s) => sum + inPlay(p, s.tokenId) * s.value, inPlay(p, resourceId))
}

/**
 * Takes `amount` of a resource out of play, using its own tokens first and then Expertise and
 * Critical Success tokens. A Critical Success is spent whole, so it can overpay. Returns null
 * when it cannot be afforded.
 */
export function commitResource(p: TokenHolder, resourceId: string, amount: number): Commitment | null {
  if (resourceAvailable(p, resourceId) < amount) return null
  const tokens: CommittedToken[] = []
  let need = amount
  for (const { tokenId, value } of [{ tokenId: resourceId, value: 1 }, ...STAND_INS]) {
    while (need > 0 && inPlay(p, tokenId) > 0) {
      p.resources = { ...p.resources, [tokenId]: inPlay(p, tokenId) - 1 }
      tokens.push({ tokenId, value, sealed: false })
      need -= value
    }
  }
  return { resourceId, tokens }
}

/** Unsealed committed tokens return to the bag. */
export function releaseCommitment(p: TokenHolder, c: Commitment) {
  for (const t of c.tokens) if (!t.sealed) p.bag = adjustBag(p.bag, t.tokenId, 1)
}

