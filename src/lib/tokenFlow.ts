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
