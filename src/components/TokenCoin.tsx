import { CONDITION_TOKEN_IDS, TOKENS } from '../data/tokens'
import { GROUP_META, groupOf, tokenGlyph } from '../lib/tokenGroups'

interface Props {
  tokenId: string
  size?: 'sm' | 'md'
  className?: string
  /** Show the browser's own hover text. Turn off when a Tip already explains the token. */
  titled?: boolean
}

/** Critical Failure shares the Criticals family but reads as bad news at a glance. */
function coinColor(tokenId: string): string {
  return tokenId === 'critFailure' || CONDITION_TOKEN_IDS.includes(tokenId) ? 'var(--danger)' : GROUP_META[groupOf(tokenId)].cssVar
}

export function TokenCoin({ tokenId, size = 'md', className = '', titled = true }: Props) {
  const def = TOKENS[tokenId]
  const name = def?.name ?? tokenId
  return (
    <span
      className={`coin-token ${size} ${className}`.trim()}
      style={{ background: coinColor(tokenId) }}
      title={titled ? (def?.effect ? `${name}: ${def.effect}` : name) : undefined}
    >
      <span className="glyph">{tokenGlyph(tokenId, name)}</span>
    </span>
  )
}
