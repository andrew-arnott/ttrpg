import { useState } from 'react'
import { TOKENS } from '../data/tokens'
import { HAND_ITEMS_BY_ID } from '../data/weapons'
import { SPECIAL_KEYS, SPECIAL_LABELS } from '../data/types'
import { buildCharacter, type BuiltCharacter, type CharacterDraft } from '../lib/buildCharacter'
import type { SavedCharacter } from '../lib/savedCharacters'
import { groupOf, GROUP_META } from '../lib/tokenGroups'
import { CharacterPortrait } from './CharacterPortrait'
import { Portrait } from './Portrait'

const handName = (id: string | null) => (id ? (HAND_ITEMS_BY_ID[id]?.name ?? 'empty') : 'empty')

const fmtMod = (m: number | null) => (m === null ? '—' : m > 0 ? `+${m}` : `${m}`)
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

function SheetPaper({ built }: { built: BuiltCharacter }) {
  const { profession, species, background } = built
  const bagRows = [...built.bag].sort(
    (a, b) => (TOKENS[a.tokenId]?.modifier ?? -99) - (TOKENS[b.tokenId]?.modifier ?? -99),
  )

  return (
    <article className="sheet">
      <header className="sheet-head">
        <div className="sheet-portraits">
          <CharacterPortrait professionId={profession?.id} portrait={built.portrait} size="lg" />
        </div>
        <div className="sheet-title">
          <h2>{built.name.trim() || 'Unnamed adventurer'}</h2>
          <p>
            {[species?.name, background?.name, profession?.name].filter(Boolean).join(' · ') ||
              'Nothing chosen yet'}
          </p>
          <dl className="sheet-vitals">
            <div>
              <dt>Starting HP</dt>
              <dd>{built.startingHp ?? '—'}</dd>
            </div>
            <div>
              <dt>Coins</dt>
              <dd>{built.coinsLeft}</dd>
            </div>
            <div>
              <dt>Bag</dt>
              <dd>{built.stats.size}</dd>
            </div>
          </dl>
        </div>
      </header>

      {built.startingHp !== null && (
        <div className="sheet-block">
          <h3>Hit points</h3>
          <div className="hp-boxes" aria-label={`${built.startingHp} hit point boxes`}>
            {Array.from({ length: built.startingHp }, (_, i) => (
              <span key={i} className="hp-box" />
            ))}
          </div>
        </div>
      )}

      <div className="sheet-block">
        <h3>SPECIAL</h3>
        <div className="sheet-special">
          {SPECIAL_KEYS.map((k) => {
            const bonuses = built.bonuses[k] ?? []
            return (
              <div className="sheet-stat" key={k}>
                <span className="k">{SPECIAL_LABELS[k]}</span>
                <span className="v">{built.special[k]}</span>
                <span className="from">
                  {bonuses.length > 0
                    ? `${built.baseSpecial[k]} + ${bonuses.map((b) => b.from).join(', ')}`
                    : ' '}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="sheet-columns">
        <div className="sheet-block">
          <h3>Token bag</h3>
          <table className="sheet-table">
            <tbody>
              {bagRows.map((s) => {
                const def = TOKENS[s.tokenId]
                return (
                  <tr key={s.tokenId}>
                    <td className="num">{s.count}×</td>
                    <td>
                      <span
                        className="sheet-swatch"
                        style={{ background: GROUP_META[groupOf(s.tokenId)].cssVar }}
                      />
                      {def?.name ?? s.tokenId}
                    </td>
                    <td className="num">{fmtMod(def?.modifier ?? null)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="sheet-note">
            Avg. modifier {built.stats.expectedModifier >= 0 ? '+' : ''}
            {built.stats.expectedModifier.toFixed(2)} · Crit success {pct(built.stats.critSuccessChance)} ·
            Crit failure {pct(built.stats.critFailureChance)}
          </p>
        </div>

        <div className="sheet-block">
          <h3>In play at start</h3>
          {built.inPlay.length === 0 ? (
            <p className="sheet-note">None.</p>
          ) : (
            <table className="sheet-table">
              <tbody>
                {built.inPlay.map((s) => (
                  <tr key={s.tokenId}>
                    <td className="num">{s.count}×</td>
                    <td>{TOKENS[s.tokenId]?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 className="sheet-gap">Hands</h3>
          <p className="sheet-note">
            Main hand: {handName(built.hands.main)}. Off hand: {handName(built.hands.off)}.
          </p>

          <h3 className="sheet-gap">Equipment</h3>
          {built.inventory.length === 0 ? (
            <p className="sheet-note">Nothing bought.</p>
          ) : (
            <table className="sheet-table">
              <tbody>
                {built.inventory.map(({ item, count }) => (
                  <tr key={item.id}>
                    <td className="num">{count}×</td>
                    <td>
                      <Portrait kind="item" id={item.id} size="xs" /> {item.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="sheet-note">{built.coinsLeft} coins remaining.</p>
        </div>
      </div>

      {species && (
        <div className="sheet-block">
          <h3>{species.name} traits</h3>
          {species.traits.map((t) => (
            <p key={t.name} className="sheet-text">
              <b>{t.name}.</b> {t.text}
            </p>
          ))}
        </div>
      )}

      {background && (
        <div className="sheet-block">
          <h3>{background.name}</h3>
          <p className="sheet-text">
            <b>{background.ability.name}.</b> {background.ability.text}
          </p>
        </div>
      )}

      {built.chosenAbilities.length > 0 && (
        <div className="sheet-block">
          <h3>Abilities</h3>
          {built.chosenAbilities.map((a) => (
            <p key={a.id} className="sheet-text sheet-ability">
              <b>{a.name}</b> <span className="sheet-tags">{a.types.join(' + ')}</span>
              {a.cost !== '—' && <span className="sheet-tags">{a.cost}</span>}
              <br />
              {a.text}
            </p>
          ))}
        </div>
      )}

      <div className="sheet-block">
        <h3>Notes</h3>
        <div className="sheet-lines" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      </div>
    </article>
  )
}

interface Props {
  current: CharacterDraft
  saved: SavedCharacter[]
}

export function SheetView({ current, saved }: Props) {
  const [selected, setSelected] = useState('current')
  const savedChoice = saved.find((c) => `saved:${c.id}` === selected)
  const draft = savedChoice ? savedChoice.draft : current

  return (
    <div className="sheet-view">
      <div className="sheet-toolbar no-print card">
        <label>
          <span className="step-index">Character</span>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="current">{current.name.trim() || 'Unnamed adventurer'} (editing)</option>
            {saved.map((c) => (
              <option key={c.id} value={`saved:${c.id}`}>
                {c.draft.name.trim() || 'Unnamed adventurer'} (saved)
              </option>
            ))}
          </select>
        </label>
        <button className="btn primary" onClick={() => window.print()}>
          Print sheet
        </button>
      </div>
      <SheetPaper built={buildCharacter(draft)} />
    </div>
  )
}
