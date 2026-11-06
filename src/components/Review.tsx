import { TOKENS } from '../data/tokens'
import { SPECIAL_KEYS, SPECIAL_LABELS } from '../data/types'
import type { BuiltCharacter, CharacterDraft } from '../lib/buildCharacter'
import { BagStatTiles, TokenBag, TokenTable } from './TokenBag'

export function Review({
  draft,
  built,
  update,
  onExport,
  showTable,
  onToggleTable,
}: {
  draft: CharacterDraft
  built: BuiltCharacter
  update: (patch: Partial<CharacterDraft>) => void
  onExport: () => void
  showTable: boolean
  onToggleTable: () => void
}) {
  const { profession, species, background } = built

  return (
    <section className="card">
      <div className="card-head">
        <span className="step-index">Review</span>
        <h2>{built.name.trim() || 'Unnamed adventurer'}</h2>
        <p className="hint">
          {[species?.name, background?.name, profession?.name].filter(Boolean).join(' · ')}
          {built.startingHp !== null && ` · ${built.startingHp} HP`}
        </p>
      </div>

      <label className="step-index" htmlFor="review-name">
        Name
      </label>
      <input
        id="review-name"
        className="text-input"
        placeholder="Name your adventurer"
        value={draft.name}
        onChange={(e) => update({ name: e.target.value })}
      />

      <h3 className="section-title">SPECIAL</h3>
      <div className="special-grid">
        {SPECIAL_KEYS.map((k) => {
          const bonusList = built.bonuses[k] ?? []
          return (
            <div className="stat" key={k}>
              <div className="k">{SPECIAL_LABELS[k]}</div>
              <div className="v">{built.special[k]}</div>
              {bonusList.length > 0 && (
                <div className="from">
                  {built.baseSpecial[k]} + {bonusList.map((b) => b.from).join(', ')}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <h3 className="section-title">Token bag</h3>
      <TokenBag bag={built.bag} stats={built.stats} />
      <div style={{ marginTop: 14 }}>
        <BagStatTiles stats={built.stats} />
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={onToggleTable}>
        {showTable ? 'Hide' : 'Show'} token table
      </button>
      {showTable && <TokenTable bag={built.bag} />}

      {built.inPlay.length > 0 && (
        <>
          <h3 className="section-title">In play at start</h3>
          <p className="hint">
            Profession resources begin in play rather than in the bag, so they do not affect your
            draw odds until spent.
          </p>
          <div className="tokens">
            {built.inPlay.map((s) => (
              <span className="chip" key={s.tokenId}>
                <span className="count">{s.count}×</span>
                {TOKENS[s.tokenId]?.name}
              </span>
            ))}
          </div>
        </>
      )}

      {species && (
        <>
          <h3 className="section-title">{species.name} traits</h3>
          <div className="stack">
            {species.traits.map((t) => (
              <p className="trait" key={t.name}>
                <b>{t.name}.</b> {t.text}
              </p>
            ))}
          </div>
        </>
      )}

      {background && (
        <>
          <h3 className="section-title">{background.name}</h3>
          <p className="trait">
            <b>{background.ability.name}.</b> {background.ability.text}
          </p>
        </>
      )}

      {built.chosenAbilities.length > 0 && (
        <>
          <h3 className="section-title">Abilities</h3>
          <div className="options">
            {built.chosenAbilities.map((a) => (
              <div className="ability" key={a.id}>
                <div className="ability-head">
                  <span className="nm">{a.name}</span>
                  <span className="tag">{a.types.join(' + ')}</span>
                  {a.cost !== '—' && <span className="tag">{a.cost}</span>}
                </div>
                <div className="text">{a.text}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="review-actions">
        <button className="btn primary" onClick={onExport} disabled={!built.complete}>
          Export JSON
        </button>
      </div>
    </section>
  )
}
