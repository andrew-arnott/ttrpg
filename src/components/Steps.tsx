import { useState } from 'react'
import { BACKGROUNDS } from '../data/backgrounds'
import { PROFESSIONS } from '../data/professions'
import { SPECIES } from '../data/species'
import { TOKENS } from '../data/tokens'
import {
  SPECIAL_ARRAY,
  SPECIAL_KEYS,
  SPECIAL_LABELS,
  SPECIAL_USES,
  type Profession,
  type SpecialKey,
} from '../data/types'
import { ITEMS, STARTING_COINS } from '../data/items'
import { portraitOptions } from '../data/portraits'
import { isBuiltInPortrait, isUploadedPortrait } from '../lib/art'
import { imageToPortrait } from '../lib/portraitUpload'
import { HAND_ITEMS, HAND_ITEMS_BY_ID, type Hands } from '../data/weapons'
import {
  allAbilities,
  suggestedSpecialAssignment,
  type BuiltCharacter,
  type CharacterDraft,
} from '../lib/buildCharacter'
import { CharacterPortrait } from './CharacterPortrait'
import { Portrait } from './Portrait'

interface StepProps {
  draft: CharacterDraft
  built: BuiltCharacter
  update: (patch: Partial<CharacterDraft>) => void
}

function CardHead({ step, title, hint }: { step: string; title: string; hint?: string }) {
  return (
    <div className="card-head">
      <span className="step-index">{step}</span>
      <h2>{title}</h2>
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}

// --- Step 1: Profession ------------------------------------------------

export function StepProfession({ draft, update }: StepProps) {
  const choose = (p: Profession) => {
    if (!p.defined) return
    // Ability and token picks belong to the old profession; drop them.
    update({ professionId: p.id, abilityIds: [], tokenChoices: {} })
  }

  return (
    <section className="card">
      <CardHead
        step="Step 1"
        title="Choose a profession"
        hint="Determines your adventuring abilities, starting HP, and profession tokens."
      />
      <div className="options two">
        {PROFESSIONS.map((p) => (
          <button
            key={p.id}
            className="option with-art"
            aria-pressed={draft.professionId === p.id}
            disabled={!p.defined}
            onClick={() => choose(p)}
          >
            <Portrait kind="profession" id={p.id} />
            <span className="name">
              {p.name}
              {p.defined ? (
                <span className="tag">{p.startingHp} HP</span>
              ) : (
                <span className="tag warn">Not yet defined</span>
              )}
            </span>
            <span className="desc">{p.focus}</span>
            <span className="meta">
              Suggested: {p.importantSpecial.map((k) => SPECIAL_LABELS[k]).join(', ')}
            </span>
          </button>
        ))}
      </div>
      <p className="hint" style={{ marginTop: 12 }}>
        Suggested attributes are recommendations, not requirements. Ranger and Berserker are listed
        as TBD in the Player&rsquo;s Guide, so they cannot be built yet.
      </p>
    </section>
  )
}

// --- Step 4: SPECIAL ---------------------------------------------------

export function StepSpecial({ draft, built, update }: StepProps) {
  const assignment = draft.specialAssignment
  const usedIndices = new Set(Object.values(assignment).filter((v) => v !== undefined))

  const setAttr = (key: SpecialKey, value: string) => {
    const next = { ...assignment }
    if (value === '') delete next[key]
    else next[key] = Number(value)
    update({ specialAssignment: next })
  }

  const autoAssign = () => {
    update({ specialAssignment: suggestedSpecialAssignment(built.profession) })
  }

  return (
    <section className="card">
      <CardHead
        step="Step 4"
        title="Assign SPECIAL"
        hint="Distribute each value from the array exactly once. Species and background bonuses are added on top."
      />

      <div className="array-pool">
        <span>Array:</span>
        {SPECIAL_ARRAY.map((v, i) => (
          <span key={i} className={`pip${usedIndices.has(i) ? ' used' : ''}`}>
            {v}
          </span>
        ))}
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={autoAssign}>
          Suggest spread
        </button>
      </div>

      {SPECIAL_KEYS.map((key) => {
        const bonusList = built.bonuses[key] ?? []
        const bonusTotal = bonusList.reduce((a, b) => a + b.amount, 0)
        return (
          <div className="special-row" key={key}>
            <div>
              <div className="label">
                {SPECIAL_LABELS[key]}
                {built.profession?.importantSpecial.includes(key) && (
                  <span className="tag" style={{ marginLeft: 8 }}>
                    Suggested
                  </span>
                )}
              </div>
              <div className="use">{SPECIAL_USES[key]}</div>
            </div>
            <select
              aria-label={`${SPECIAL_LABELS[key]} value`}
              value={assignment[key] ?? ''}
              onChange={(e) => setAttr(key, e.target.value)}
            >
              <option value="">—</option>
              {SPECIAL_ARRAY.map((v, i) => (
                <option key={i} value={i} disabled={usedIndices.has(i) && assignment[key] !== i}>
                  {v}
                </option>
              ))}
            </select>
            <div>
              <div className="total">{built.special[key]}</div>
              {bonusTotal > 0 && (
                <div className="bonus">+{bonusTotal} {bonusList.map((b) => b.from).join(', ')}</div>
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}

// --- Step 2: Species ---------------------------------------------------

export function StepSpecies({ draft, update }: StepProps) {
  return (
    <section className="card">
      <CardHead
        step="Step 2"
        title="Choose a species"
        hint="Grants an attribute bonus, natural traits, and changes to your token bag."
      />
      <div className="options two">
        {SPECIES.map((s) => (
          <button
            key={s.id}
            className="option with-art"
            aria-pressed={draft.speciesId === s.id}
            onClick={() => update({ speciesId: s.id })}
          >
            <Portrait kind="species" id={s.id} />
            <span className="name">
              {s.name}
              <span className="tag">
                {s.attributeBonus ? `+1 ${SPECIAL_LABELS[s.attributeBonus]}` : 'No attribute bonus'}
              </span>
            </span>
            <span className="desc">{s.blurb}</span>
            {s.traits.map((t) => (
              <span className="trait" key={t.name}>
                <b>{t.name}.</b> {t.text}
              </span>
            ))}
          </button>
        ))}
      </div>
    </section>
  )
}

// --- Step 3: Background ------------------------------------------------

export function StepBackground({ draft, update }: StepProps) {
  return (
    <section className="card">
      <CardHead
        step="Step 3"
        title="Choose a background"
        hint="Your life before adventuring. Grants +1 to an attribute and a passive ability."
      />
      {SPECIAL_KEYS.map((key) => {
        const group = BACKGROUNDS.filter((b) => b.attributeBonus === key)
        if (group.length === 0) return null
        return (
          <div key={key} style={{ marginBottom: 14 }}>
            <div className="step-index">+1 {SPECIAL_LABELS[key]}</div>
            <div className="options two">
              {group.map((b) => (
                <button
                  key={b.id}
                  className="option with-art"
                  aria-pressed={draft.backgroundId === b.id}
                  onClick={() => update({ backgroundId: b.id })}
                >
                  <Portrait kind="bg" id={b.id} size="sm" />
                  <span className="name">{b.name}</span>
                  <span className="desc">{b.blurb}</span>
                  <span className="trait">
                    <b>{b.ability.name}.</b> {b.ability.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}

// --- Step 5: Profession tokens & abilities -----------------------------

export function StepProfessionDetail({ draft, built, update }: StepProps) {
  const profession = built.profession
  if (!profession || !profession.defined) return null

  const setChoice = (choiceId: string, tokenId: string, delta: number) => {
    const choice = profession.tokenChoices.find((c) => c.id === choiceId)
    if (!choice) return
    const current = draft.tokenChoices[choiceId] ?? {}
    const allocated = Object.values(current).reduce((a, b) => a + b, 0)
    const next = Math.max(0, (current[tokenId] ?? 0) + delta)
    if (delta > 0 && allocated >= choice.total) return
    update({
      tokenChoices: { ...draft.tokenChoices, [choiceId]: { ...current, [tokenId]: next } },
    })
  }

  const pool = allAbilities(profession)

  const toggleAbility = (id: string) => {
    const has = draft.abilityIds.includes(id)
    if (has) {
      update({ abilityIds: draft.abilityIds.filter((a) => a !== id) })
    } else if (draft.abilityIds.length < profession.abilityPicks) {
      update({ abilityIds: [...draft.abilityIds, id] })
    }
  }

  return (
    <section className="card">
      <CardHead
        step="Step 5"
        title={`${profession.name} tokens and abilities`}
        hint={`Starting resources, plus ${profession.abilityPicks} abilities of your choice.`}
      />

      <h3 style={{ fontSize: 14, marginBottom: 8 }}>Starting resources</h3>
      <div className="tokens" style={{ marginTop: 0, marginBottom: 14 }}>
        {profession.fixedStartingTokens.map((s) => (
          <span className="chip" key={s.tokenId}>
            <span className="count">{s.count}×</span>
            {TOKENS[s.tokenId]?.name}
          </span>
        ))}
      </div>

      {profession.tokenChoices.map((choice) => {
        const current = draft.tokenChoices[choice.id] ?? {}
        const allocated = Object.values(current).reduce((a, b) => a + b, 0)
        return (
          <div key={choice.id} style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, marginBottom: 4 }}>{choice.prompt}</h3>
            <p className="hint" style={{ marginBottom: 10 }}>
              {allocated} of {choice.total} allocated
            </p>
            <div className="options two">
              {choice.options.map((tokenId) => {
                const def = TOKENS[tokenId]
                const n = current[tokenId] ?? 0
                return (
                  <div className="option" key={tokenId} style={{ cursor: 'default' }}>
                    <span className="name">{def?.name}</span>
                    <span className="desc">{def?.effect}</span>
                    <div className="counter" style={{ marginTop: 6 }}>
                      <button
                        onClick={() => setChoice(choice.id, tokenId, -1)}
                        disabled={n === 0}
                        aria-label={`Remove one ${def?.name}`}
                      >
                        −
                      </button>
                      <span className="n">{n}</span>
                      <button
                        onClick={() => setChoice(choice.id, tokenId, 1)}
                        disabled={allocated >= choice.total}
                        aria-label={`Add one ${def?.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <h3 style={{ fontSize: 14, margin: '18px 0 4px' }}>
        Abilities — choose {profession.abilityPicks}
      </h3>
      <p className="hint" style={{ marginBottom: 10 }}>
        Combat and exploration abilities draw from the same pool.{' '}
        {draft.abilityIds.length} of {profession.abilityPicks} chosen
      </p>
      <div className="options">
        {pool.map((a) => {
          const selected = draft.abilityIds.includes(a.id)
          const atLimit = !selected && draft.abilityIds.length >= profession.abilityPicks
          const isExploration = profession.explorationAbilities.some((e) => e.id === a.id)
          return (
            <button
              key={a.id}
              className="option"
              aria-pressed={selected}
              disabled={atLimit}
              onClick={() => toggleAbility(a.id)}
            >
              <span className="ability-head">
                <span className="nm">{a.name}</span>
                <span className="tag">{a.types.join(' + ')}</span>
                {!isExploration && <span className="tag">{a.cost}</span>}
              </span>
              <span className="desc">{a.text}</span>
            </button>
          )
        })}
      </div>

      {profession.notes.length > 0 && (
        <ul className="notes">
          {profession.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

// --- Step 6: Equipment -------------------------------------------------

/** Puts an item in a hand. A two-handed item goes in the main hand and empties the other. */
function setHand(hands: Hands, slot: 'main' | 'off', id: string | null): Hands {
  if (id && HAND_ITEMS_BY_ID[id]?.hands === 2) return { main: id, off: null }
  if (slot === 'off' && hands.main && HAND_ITEMS_BY_ID[hands.main]?.hands === 2) return { main: null, off: id }
  return { ...hands, [slot]: id }
}

export function StepEquipment({ draft, built, update }: StepProps) {
  /** Whether there are coins for it, counting what it would replace in the hands as refunded. */
  const canAfford = (item: (typeof HAND_ITEMS)[number], slot: 'main' | 'off') => {
    const held = (id: string | null) => (id ? (HAND_ITEMS_BY_ID[id]?.cost ?? 0) : 0)
    const replaced = item.hands === 2 ? held(draft.hands.main) + held(draft.hands.off) : held(draft.hands[slot])
    return item.cost <= built.coinsLeft + replaced
  }

  const setCount = (itemId: string, delta: number) => {
    const current = draft.equipment[itemId] ?? 0
    const next = Math.max(0, current + delta)
    const equipment = { ...draft.equipment, [itemId]: next }
    if (next === 0) delete equipment[itemId]
    update({ equipment })
  }

  return (
    <section className="card">
      <CardHead
        step="Step 6"
        title="Buy equipment"
        hint="Spend your starting coins on what to hold and on basic supplies. Armor is not available yet. Unspent coins are kept."
      />

      <div className="coin-purse" aria-live="polite">
        <span className="coin" aria-hidden="true" />
        <span>
          <b>{built.coinsLeft}</b> of {STARTING_COINS} coins left
        </span>
      </div>

      <h3 className="section-title">Hands</h3>
      <p className="hint">
        Two hand slots, bought with your starting coins. Your weapon decides what an attack tests. A two-handed weapon takes both hands
        and does 1 extra damage. A ranged weapon can attack enemies you are not engaged with, but is at -2 against
        ones you are. A shield adds 2 Shield tokens to your bag.
      </p>
      <div className="hands">
        {(['main', 'off'] as const).map((slot) => {
          const blocked = slot === 'off' && Boolean(draft.hands.main && HAND_ITEMS_BY_ID[draft.hands.main]?.hands === 2)
          return (
            <label className="prompt-target" key={slot}>
              <span className="step-index">{slot === 'main' ? 'Main hand' : 'Off hand'}</span>
              <select
                value={blocked ? '' : (draft.hands[slot] ?? '')}
                disabled={blocked}
                onChange={(e) => update({ hands: setHand(draft.hands, slot, e.target.value || null) })}
              >
                <option value="">{blocked ? 'Held by a two-handed weapon' : 'Empty'}</option>
                {HAND_ITEMS.map((item) => (
                  <option key={item.id} value={item.id} disabled={!canAfford(item, slot)}>
                    {item.name}
                    {item.hands === 2 ? ' (two-handed)' : ''} - {item.cost} {item.cost === 1 ? 'coin' : 'coins'}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>
      <ul className="notes">
        {built.held.map((item) => (
          <li key={item.id}>
            <b>{item.name}.</b> {item.description}
          </li>
        ))}
      </ul>

      <h3 className="section-title">Supplies</h3>
      <div className="options">
        {ITEMS.map((item) => {
          const n = draft.equipment[item.id] ?? 0
          return (
            <div className="option with-art" key={item.id} style={{ cursor: 'default' }}>
              <Portrait kind="item" id={item.id} size="sm" />
              <span className="name">
                {item.name}
                <span className="tag">
                  {item.cost} {item.cost === 1 ? 'coin' : 'coins'}
                </span>
              </span>
              <span className="desc">{item.description}</span>
              <div className="counter" style={{ marginTop: 6 }}>
                <button
                  onClick={() => setCount(item.id, -1)}
                  disabled={n === 0}
                  aria-label={`Remove one ${item.name}`}
                >
                  −
                </button>
                <span className="n" aria-label={`${item.name} owned`}>
                  {n}
                </span>
                <button
                  onClick={() => setCount(item.id, 1)}
                  disabled={item.cost > built.coinsLeft}
                  aria-label={`Buy one ${item.name}`}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// --- Step 7: Portrait ----------------------------------------------------

export function StepPortrait({ draft, built, update }: StepProps) {
  const [error, setError] = useState<string | null>(null)
  const professionId = built.profession?.id
  const chosen = draft.portrait
  const uploaded = isUploadedPortrait(chosen)
  const current = !chosen || !isBuiltInPortrait(chosen) ? (professionId ? `${professionId}-1` : null) : chosen

  const upload = async (file: File | undefined) => {
    if (!file) return
    try {
      update({ portrait: await imageToPortrait(file) })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That picture could not be used.')
    }
  }

  return (
    <section className="card">
      <CardHead
        step="Step 7"
        title="Choose a portrait"
        hint="Pick one of the portraits for your profession, or upload your own picture."
      />
      {!professionId ? (
        <p className="blocker-text">Choose a profession first to see its portraits.</p>
      ) : (
        <div className="options three">
          {portraitOptions(professionId).map((id, i) => (
            <button
              key={id}
              className="option with-art portrait-option"
              aria-pressed={!uploaded && current === id}
              onClick={() => update({ portrait: id })}
            >
              <CharacterPortrait professionId={professionId} portrait={id} size="xl" />
              <span className="name">Portrait {i + 1}</span>
            </button>
          ))}
          <label className={`option with-art portrait-option${uploaded ? ' selected' : ''}`} aria-pressed={uploaded}>
            {uploaded ? (
              <CharacterPortrait professionId={professionId} portrait={chosen} size="xl" />
            ) : (
              <span className="upload-slot">+</span>
            )}
            <span className="name">{uploaded ? 'Your picture' : 'Upload your own'}</span>
            <input
              type="file"
              accept="image/*"
              className="visually-hidden"
              aria-label="Upload a portrait"
              onChange={(e) => {
                void upload(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
        </div>
      )}
      {error && (
        <p className="blocker-text" role="alert">
          {error}
        </p>
      )}
      {uploaded && (
        <div className="review-actions">
          <button className="btn" onClick={() => update({ portrait: null })}>
            Remove uploaded picture
          </button>
        </div>
      )}
    </section>
  )
}
