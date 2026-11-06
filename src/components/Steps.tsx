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
import { allAbilities, type BuiltCharacter, type CharacterDraft } from '../lib/buildCharacter'

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
            className="option"
            aria-pressed={draft.professionId === p.id}
            disabled={!p.defined}
            onClick={() => choose(p)}
          >
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
    const profession = built.profession
    // Highest values to the profession's suggested attributes, in order.
    const order: SpecialKey[] = [
      ...(profession?.importantSpecial ?? []),
      ...SPECIAL_KEYS.filter((k) => !profession?.importantSpecial.includes(k)),
    ]
    // Indices sorted by descending value.
    const byValue = SPECIAL_ARRAY.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v)
    const next: Partial<Record<SpecialKey, number>> = {}
    order.forEach((key, idx) => {
      next[key] = byValue[idx].i
    })
    update({ specialAssignment: next })
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
            className="option"
            aria-pressed={draft.speciesId === s.id}
            onClick={() => update({ speciesId: s.id })}
          >
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
                  className="option"
                  aria-pressed={draft.backgroundId === b.id}
                  onClick={() => update({ backgroundId: b.id })}
                >
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
