import type { DrawnToken } from '../lib/drawTest'
import { Portrait } from './Portrait'
import { TokenCoin } from './TokenCoin'

interface Props {
  shaking: boolean
  shown: DrawnToken[]
  /** Text for the empty table, e.g. "Draw to see what comes out." */
  placeholder: string
  /** Shown under the pouch, e.g. "17 in bag". */
  bagLabel: string
  compact?: boolean
}

/** The pouch and the table the drawn tokens land on. */
export function DrawStage({ shaking, shown, placeholder, bagLabel, compact = false }: Props) {
  return (
    <div className={`bag-stage${compact ? ' compact' : ''}`}>
      <div className={`bag-holder${shaking ? ' shaking' : ''}`}>
        <Portrait kind="item" id="pouch" size={compact ? 'lg' : 'xl'} className="bag-art" />
        <span className="bag-count" aria-live="polite">
          {bagLabel}
        </span>
      </div>

      <div className="table-felt" aria-live="polite">
        {shown.length === 0 && <span className="hint">{placeholder}</span>}
        {shown.map((d, i) => (
          <div key={i} className="drawn">
            <TokenCoin tokenId={d.tokenId} />
            <span className="drawn-name">{d.name}</span>
            {d.chain && <span className="drawn-chain">chain</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
