import { TOKENS } from '../data/tokens'
import { SPECIAL_KEYS, SPECIAL_LABELS } from '../data/types'
import type { BuiltCharacter } from '../lib/buildCharacter'
import { BagStatTiles, TokenBag, TokenTable } from './TokenBag'

export function Summary({ built, showTable, onToggleTable }: {
  built: BuiltCharacter
  showTable: boolean
  onToggleTable: () => void
}) {
  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>{built.name.trim() || 'Unnamed adventurer'}</h2>
          <p className="hint">
            {[built.species?.name, built.background?.name, built.profession?.name]
              .filter(Boolean)
              .join(' · ') || 'Nothing chosen yet'}
          </p>
        </div>

        <div className="summary-line">
          <span className="k">Starting HP</span>
          <span className="v">{built.startingHp ?? '—'}</span>
        </div>
        {SPECIAL_KEYS.map((k) => (
          <div className="summary-line" key={k}>
            <span className="k">{SPECIAL_LABELS[k]}</span>
            <span className="v">{built.special[k]}</span>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Token bag</h2>
          <p className="hint">
            {built.species
              ? `Standard 15 tokens with ${built.species.name} modifications.`
              : 'Standard 15 tokens. Choose a species to see its modifications.'}
          </p>
        </div>

        <TokenBag bag={built.bag} stats={built.stats} />

        <div style={{ marginTop: 14 }}>
          <BagStatTiles stats={built.stats} />
        </div>

        <button className="btn" style={{ marginTop: 12 }} onClick={onToggleTable}>
          {showTable ? 'Hide' : 'Show'} token table
        </button>
        {showTable && <TokenTable bag={built.bag} />}

        <p className="hint" style={{ marginTop: 12 }}>
          Averages assume a single test drawn from a full bag. Chain tokens keep the draw going, so
          a test averages {built.stats.expectedTokensDrawn.toFixed(2)} tokens.
        </p>
      </section>

      {built.inPlay.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>In play at start</h2>
            <p className="hint">
              Profession resources begin in play rather than in the bag, so they do not affect your
              draw odds until they are spent.
            </p>
          </div>
          <div className="tokens" style={{ marginTop: 0 }}>
            {built.inPlay.map((s) => (
              <span className="chip" key={s.tokenId}>
                <span className="count">{s.count}×</span>
                {TOKENS[s.tokenId]?.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {built.issues.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>To finish</h2>
          </div>
          <ul className="issues">
            {built.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
