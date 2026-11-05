import { TOKENS } from '../data/tokens'
import type { TokenStack } from '../data/types'
import type { BagStats } from '../lib/buildCharacter'

/**
 * Tokens are grouped into four families for the composition bar. Per-token
 * colouring would need more categorical slots than the palette safely offers,
 * and the families are what actually shape a bag's behaviour.
 */
type Group = 'numeric' | 'chain' | 'critical' | 'species'

const GROUP_OF: Record<string, Group> = {
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

const GROUP_META: Record<Group, { label: string; cssVar: string }> = {
  numeric: { label: 'Numeric', cssVar: 'var(--series-numeric)' },
  chain: { label: 'Chain', cssVar: 'var(--series-chain)' },
  critical: { label: 'Criticals', cssVar: 'var(--series-critical)' },
  species: { label: 'Species', cssVar: 'var(--series-species)' },
}

const GROUP_ORDER: Group[] = ['numeric', 'chain', 'critical', 'species']

const groupOf = (tokenId: string): Group => GROUP_OF[tokenId] ?? 'chain'

const fmtMod = (m: number | null) => (m === null ? '—' : m > 0 ? `+${m}` : `${m}`)
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

function sortStacks(bag: TokenStack[]): TokenStack[] {
  return [...bag].sort((a, b) => {
    const ga = GROUP_ORDER.indexOf(groupOf(a.tokenId))
    const gb = GROUP_ORDER.indexOf(groupOf(b.tokenId))
    if (ga !== gb) return ga - gb
    return (TOKENS[a.tokenId]?.modifier ?? -99) - (TOKENS[b.tokenId]?.modifier ?? -99)
  })
}

export function TokenBag({ bag, stats }: { bag: TokenStack[]; stats: BagStats }) {
  const sorted = sortStacks(bag)

  const totals = GROUP_ORDER.map((g) => ({
    group: g,
    count: bag.filter((s) => groupOf(s.tokenId) === g).reduce((a, s) => a + s.count, 0),
  })).filter((t) => t.count > 0)

  return (
    <>
      <div className="bagbar" role="img" aria-label={`Bag composition: ${totals.map((t) => `${GROUP_META[t.group].label} ${t.count}`).join(', ')}`}>
        {totals.map((t) => (
          <div
            key={t.group}
            className="seg"
            style={{ flexGrow: t.count, background: GROUP_META[t.group].cssVar }}
            title={`${GROUP_META[t.group].label}: ${t.count} of ${stats.size}`}
          />
        ))}
      </div>

      {/* Direct-labelled legend. Required relief for the low-contrast light
          steps, and it keeps identity off colour alone. */}
      <div className="legend">
        {totals.map((t) => (
          <span className="item" key={t.group}>
            <span className="swatch" style={{ background: GROUP_META[t.group].cssVar }} />
            {GROUP_META[t.group].label} <span className="n">{t.count}</span>
          </span>
        ))}
      </div>

      <div className="tokens">
        {sorted.map((s) => {
          const def = TOKENS[s.tokenId]
          if (!def) return null
          return (
            <span
              key={s.tokenId}
              className="chip"
              style={{ borderLeftColor: GROUP_META[groupOf(s.tokenId)].cssVar }}
              title={def.effect ?? ''}
            >
              <span className="count">{s.count}×</span>
              {def.name}
              {/* Plain numeric tokens are named after their modifier; don't repeat it. */}
              {groupOf(s.tokenId) !== 'numeric' && (
                <span className="mod">{fmtMod(def.modifier)}</span>
              )}
            </span>
          )
        })}
      </div>
    </>
  )
}

export function BagStatTiles({ stats }: { stats: BagStats }) {
  return (
    <div className="tiles">
      <div className="tile">
        <div className="k">Bag size</div>
        <div className="v">{stats.size}</div>
      </div>
      <div className="tile">
        <div className="k">Avg. modifier</div>
        <div className="v">
          {stats.expectedModifier >= 0 ? '+' : ''}
          {stats.expectedModifier.toFixed(2)}
        </div>
      </div>
      <div className="tile">
        <div className="k">Critical success</div>
        <div className="v">
          {pct(stats.critSuccessChance)}
        </div>
      </div>
      <div className="tile">
        <div className="k">Critical failure</div>
        <div className="v">{pct(stats.critFailureChance)}</div>
      </div>
      <div className="tile">
        <div className="k">Complication</div>
        <div className="v">{pct(stats.complicationChance)}</div>
      </div>
      <div className="tile">
        <div className="k">Tokens per test</div>
        <div className="v">
          {stats.expectedTokensDrawn.toFixed(2)} <small>avg</small>
        </div>
      </div>
    </div>
  )
}

/** Table view of the bag — the accessible alternative to the composition bar. */
export function TokenTable({ bag }: { bag: TokenStack[] }) {
  return (
    <table className="tokens-table">
      <thead>
        <tr>
          <th>Token</th>
          <th>Group</th>
          <th className="num">Modifier</th>
          <th className="num">Count</th>
        </tr>
      </thead>
      <tbody>
        {sortStacks(bag).map((s) => {
          const def = TOKENS[s.tokenId]
          if (!def) return null
          return (
            <tr key={s.tokenId}>
              <td>{def.name}</td>
              <td>{GROUP_META[groupOf(s.tokenId)].label}</td>
              <td className="num">{fmtMod(def.modifier)}</td>
              <td className="num">{s.count}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
