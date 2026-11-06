import { TOKENS } from '../data/tokens'
import { GROUP_META, groupOf, tokenGlyph } from '../lib/tokenGroups'

interface Props {
  tokenId: string
  size?: 'sm' | 'md'
  className?: string
}

/** Critical Failure shares the Criticals family but reads as bad news at a glance. */
function coinColor(tokenId: string): string {
  return tokenId === 'critFailure' ? 'var(--danger)' : GROUP_META[groupOf(tokenId)].cssVar
}

export function TokenCoin({ tokenId, size = 'md', className = '' }: Props) {
  const def = TOKENS[tokenId]
  const name = def?.name ?? tokenId
  return (
    <span
      className={`coin-token ${size} ${className}`.trim()}
      style={{ background: coinColor(tokenId) }}
      title={def?.effect ? `${name}: ${def.effect}` : name}
    >
      <span className="glyph">{tokenGlyph(tokenId, name)}</span>
    </span>
  )
}
