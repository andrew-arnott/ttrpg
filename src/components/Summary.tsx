import { TOKENS } from '../data/tokens'
import { SPECIAL_KEYS, SPECIAL_LABELS } from '../data/types'
import type { BuiltCharacter } from '../lib/buildCharacter'
import { Portrait } from './Portrait'
import { BagStatTiles, TokenBag } from './TokenBag'

/** Live running total beside the wizard. The Review step shows the full sheet. */
export function Summary({ built }: { built: BuiltCharacter }) {
  return (
    <>
      <section className="card">
        <div className="card-head">
          <div className="portrait-row">
            <Portrait kind="species" id={built.species?.id} size="sm" />
            <Portrait kind="bg" id={built.background?.id} size="sm" />
            <Portrait kind="profession" id={built.profession?.id} size="sm" />
          </div>
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
        <div className="summary-line">
          <span className="k">Coins</span>
          <span className="v">{built.coinsLeft}</span>
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
      </section>

      {built.inPlay.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>In play at start</h2>
            <p className="hint">
              Profession resources begin in play, so they do not affect your draw odds until spent.
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
    </>
  )
}
