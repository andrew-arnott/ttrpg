import { TOKENS } from '../data/tokens'
import type { TokenStack } from '../data/types'
import type { BagStats } from '../lib/buildCharacter'
import { Tip } from './Tip'
import { GROUP_META, GROUP_ORDER, groupOf, sortStacks } from '../lib/tokenGroups'

const fmtMod = (m: number | null) => (m === null ? '—' : m > 0 ? `+${m}` : `${m}`)
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

function tokenTip(name: string, modifier: number | null, keywords: string[], effect?: string) {
  return (
    <>
      <b className="tip-name">
        {name} {fmtMod(modifier)}
      </b>
      {keywords.length > 0 && <span className="hint">{keywords.join(', ')}. </span>}
      {effect}
    </>
  )
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
            <Tip key={s.tokenId} content={tokenTip(def.name, def.modifier, def.keywords, def.effect)}>
              <span className="chip" style={{ borderLeftColor: GROUP_META[groupOf(s.tokenId)].cssVar }}>
                <span className="count">{s.count}×</span>
                {def.name}
                {/* Plain numeric tokens are named after their modifier; don't repeat it. */}
                {groupOf(s.tokenId) !== 'numeric' && <span className="mod">{fmtMod(def.modifier)}</span>}
              </span>
            </Tip>
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
