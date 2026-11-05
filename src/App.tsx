import { useMemo, useRef, useState } from 'react'
import { Summary } from './components/Summary'
import {
  StepBackground,
  StepProfession,
  StepProfessionDetail,
  StepSpecial,
  StepSpecies,
} from './components/Steps'
import { buildCharacter, emptyDraft, type CharacterDraft } from './lib/buildCharacter'

const EXPORT_VERSION = 1

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Accepts only the fields we know about, so a hand-edited or stale file cannot
 * inject arbitrary keys into the draft.
 */
function parseDraft(raw: unknown): CharacterDraft | string {
  if (typeof raw !== 'object' || raw === null) return 'File is not a character object.'
  const o = raw as Record<string, unknown>
  const draft = o.draft && typeof o.draft === 'object' ? (o.draft as Record<string, unknown>) : o
  const base = emptyDraft()
  return {
    name: typeof draft.name === 'string' ? draft.name : base.name,
    professionId: typeof draft.professionId === 'string' ? draft.professionId : null,
    specialAssignment:
      typeof draft.specialAssignment === 'object' && draft.specialAssignment !== null
        ? (draft.specialAssignment as CharacterDraft['specialAssignment'])
        : {},
    speciesId: typeof draft.speciesId === 'string' ? draft.speciesId : null,
    backgroundId: typeof draft.backgroundId === 'string' ? draft.backgroundId : null,
    tokenChoices:
      typeof draft.tokenChoices === 'object' && draft.tokenChoices !== null
        ? (draft.tokenChoices as CharacterDraft['tokenChoices'])
        : {},
    abilityIds: Array.isArray(draft.abilityIds)
      ? draft.abilityIds.filter((a): a is string => typeof a === 'string')
      : [],
  }
}

export default function App() {
  const [draft, setDraft] = useState<CharacterDraft>(emptyDraft)
  const [showTable, setShowTable] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const built = useMemo(() => buildCharacter(draft), [draft])
  const update = (patch: Partial<CharacterDraft>) => setDraft((d) => ({ ...d, ...patch }))

  const onExport = () => {
    const payload = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      draft,
      // Denormalised for anyone reading the file by hand. Re-derived on import.
      summary: {
        name: built.name,
        profession: built.profession?.name ?? null,
        species: built.species?.name ?? null,
        background: built.background?.name ?? null,
        startingHp: built.startingHp,
        special: built.special,
        abilities: built.chosenAbilities.map((a) => a.name),
      },
    }
    const slug = (built.name.trim() || 'character').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    download(`${slug}.json`, JSON.stringify(payload, null, 2))
  }

  const onImport = async (file: File) => {
    setImportError(null)
    try {
      const parsed = parseDraft(JSON.parse(await file.text()))
      if (typeof parsed === 'string') setImportError(parsed)
      else setDraft(parsed)
    } catch {
      setImportError('That file is not valid JSON.')
    }
  }

  const stepProps = { draft, built, update }

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <h1>Character Creator</h1>
          <p className="sub">A fantasy tabletop RPG of strategy, exploration, and adventure.</p>
        </div>
        <div className="toolbar">
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImport(f)
              e.target.value = ''
            }}
          />
          <button className="btn" onClick={() => fileInput.current?.click()}>
            Import JSON
          </button>
          <button className="btn primary" onClick={onExport} disabled={!built.complete}>
            Export JSON
          </button>
          <button
            className="btn"
            onClick={() => {
              setDraft(emptyDraft())
              setImportError(null)
            }}
          >
            Reset
          </button>
        </div>
      </header>

      {importError && (
        <p className="hint" style={{ color: 'var(--danger)', marginTop: 8 }} role="alert">
          {importError}
        </p>
      )}

      <div className="layout">
        <main>
          <section className="card">
            <label className="step-index" htmlFor="char-name">
              Name
            </label>
            <input
              id="char-name"
              className="text-input"
              placeholder="Name your adventurer"
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </section>

          <StepProfession {...stepProps} />
          <StepSpecial {...stepProps} />
          <StepSpecies {...stepProps} />
          <StepBackground {...stepProps} />
          <StepProfessionDetail {...stepProps} />
        </main>

        <aside className="sidebar">
          <Summary
            built={built}
            showTable={showTable}
            onToggleTable={() => setShowTable((v) => !v)}
          />
        </aside>
      </div>
    </div>
  )
}
