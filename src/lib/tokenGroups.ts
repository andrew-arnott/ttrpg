import { TOKENS } from '../data/tokens'
import type { TokenStack } from '../data/types'

/**
 * Tokens are grouped into four families for charts and coins. Per-token
 * colouring would need more categorical slots than the palette safely offers,
 * and the families are what actually shape a bag's behaviour.
 */
export type TokenGroup = 'numeric' | 'chain' | 'critical' | 'species'

const GROUP_OF: Record<string, TokenGroup> = {
  plus0: 'numeric',
  plus1: 'numeric',
  plus2: 'numeric',
  plus3: 'numeric',
  plus4: 'numeric',
  critSuccess: 'critical',
  critFailure: 'critical',
  opportunity: 'chain',
  expertise: 'chain',
  complication: 'chain',
  shield: 'species',
  might: 'species',
  bless: 'chain',
}

export const GROUP_META: Record<TokenGroup, { label: string; cssVar: string }> = {
  numeric: { label: 'Numeric', cssVar: 'var(--series-numeric)' },
  chain: { label: 'Chain', cssVar: 'var(--series-chain)' },
  critical: { label: 'Criticals', cssVar: 'var(--series-critical)' },
  species: { label: 'Species', cssVar: 'var(--series-species)' },
}

export const GROUP_ORDER: TokenGroup[] = ['numeric', 'chain', 'critical', 'species']

export const groupOf = (tokenId: string): TokenGroup => GROUP_OF[tokenId] ?? 'chain'

/** Short label that fits on a token coin. */
const GLYPHS: Record<string, string> = {
  critSuccess: 'CS',
  critFailure: 'CF',
  opportunity: 'OP',
  expertise: 'EX',
  complication: 'CO',
  shield: 'SH',
  might: 'MI',
  bless: 'BL',
  resolve: 'RE',
  armor: 'AR',
  power: 'PW',
  cunning: 'CN',
  faith: 'FA',
  mana: 'MA',
  wound: 'WO',
  poison: 'PO',
  insanity: 'IN',
  curse: 'CR',
  fatigue: 'FT',
  fear: 'FE',
}

export function tokenGlyph(tokenId: string, name: string): string {
  return GLYPHS[tokenId] ?? name
}

/** Stacks ordered by family, then by modifier, the way a bag is laid out. */
export function sortStacks(bag: TokenStack[]): TokenStack[] {
  return [...bag].sort((a, b) => {
    const ga = GROUP_ORDER.indexOf(groupOf(a.tokenId))
    const gb = GROUP_ORDER.indexOf(groupOf(b.tokenId))
    if (ga !== gb) return ga - gb
    return (TOKENS[a.tokenId]?.modifier ?? -99) - (TOKENS[b.tokenId]?.modifier ?? -99)
  })
}
