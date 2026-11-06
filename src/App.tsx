import { useMemo, useRef, useState } from 'react'
import { Review } from './components/Review'
import {
  StepBackground,
  StepProfession,
  StepProfessionDetail,
  StepSpecial,
  StepSpecies,
} from './components/Steps'
import { Summary } from './components/Summary'
import {
  buildCharacter,
  emptyDraft,
  STEP_IDS,
  type BuiltCharacter,
  type CharacterDraft,
  type StepId,
} from './lib/buildCharacter'

const EXPORT_VERSION = 1

/** Wizard order. The review step owns no validation of its own. */
const STEPS: { id: StepId | 'review'; label: string }[] = [
  { id: 'profession', label: 'Profession' },
  { id: 'special', label: 'SPECIAL' },
  { id: 'species', label: 'Species' },
  { id: 'background', label: 'Background' },
  { id: 'abilities', label: 'Abilities' },
  { id: 'review', label: 'Review' },
]

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

/**
 * The furthest step the user may jump to: every step before the first one with
 * outstanding issues, plus that step itself.
 */
function furthestReachable(built: BuiltCharacter): number {
  const firstBlocked = STEP_IDS.findIndex((id) => built.issuesFor(id).length > 0)
  return firstBlocked === -1 ? STEPS.length - 1 : firstBlocked
}

function Stepper({
  current,
  reachable,
  built,
  onGo,
}: {
  current: number
  reachable: number
  built: BuiltCharacter
  onGo: (i: number) => void
}) {
  return (
    <ol className="stepper">
      {STEPS.map((s, i) => {
        const done = s.id !== 'review' && built.issuesFor(s.id).length === 0 && i < reachable + 1
        const state = i === current ? 'current' : done ? 'done' : i <= reachable ? 'open' : 'locked'
        return (
          <li key={s.id} className={`stepper-item ${state}`}>
            <button
              onClick={() => onGo(i)}
              disabled={i > reachable}
              aria-current={i === current ? 'step' : undefined}
            >
              <span className="dot">{done && i !== current ? '✓' : i + 1}</span>
              <span className="lbl">{s.label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export default function App() {
  const [draft, setDraft] = useState<CharacterDraft>(emptyDraft)
  const [stepIndex, setStepIndex] = useState(0)
  const [showTable, setShowTable] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const built = useMemo(() => buildCharacter(draft), [draft])
  const update = (patch: Partial<CharacterDraft>) => setDraft((d) => ({ ...d, ...patch }))

  const reachable = furthestReachable(built)
  // Changing an earlier answer can invalidate a later step; never strand the
  // user on a step they can no longer satisfy.
  const current = Math.min(stepIndex, reachable)
  const step = STEPS[current]
  const stepIssues = step.id === 'review' ? [] : built.issuesFor(step.id)
  const canAdvance = stepIssues.length === 0 && current < STEPS.length - 1

  const goTo = (i: number) => {
    setStepIndex(Math.max(0, Math.min(i, STEPS.length - 1)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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
      if (typeof parsed === 'string') {
        setImportError(parsed)
      } else {
        setDraft(parsed)
        setStepIndex(STEPS.length - 1)
      }
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
          <button
            className="btn"
            onClick={() => {
              setDraft(emptyDraft())
              setStepIndex(0)
              setImportError(null)
            }}
          >
            Start over
          </button>
        </div>
      </header>

      {importError && (
        <p className="hint" style={{ color: 'var(--danger)', marginTop: 8 }} role="alert">
          {importError}
        </p>
      )}

      <Stepper current={current} reachable={reachable} built={built} onGo={goTo} />

      <div className="layout">
        <main>
          {step.id === 'profession' && <StepProfession {...stepProps} />}
          {step.id === 'special' && <StepSpecial {...stepProps} />}
          {step.id === 'species' && <StepSpecies {...stepProps} />}
          {step.id === 'background' && <StepBackground {...stepProps} />}
          {step.id === 'abilities' && <StepProfessionDetail {...stepProps} />}
          {step.id === 'review' && (
            <Review
              draft={draft}
              built={built}
              update={update}
              onExport={onExport}
              showTable={showTable}
              onToggleTable={() => setShowTable((v) => !v)}
            />
          )}

          <nav className="wizard-nav">
            <button className="btn" onClick={() => goTo(current - 1)} disabled={current === 0}>
              ← Back
            </button>

            <span className="wizard-progress">
              {stepIssues.length > 0 ? (
                <span className="blocker">{stepIssues[0]}</span>
              ) : (
                `Step ${current + 1} of ${STEPS.length}`
              )}
            </span>

            {current < STEPS.length - 1 ? (
              <button
                className="btn primary"
                onClick={() => goTo(current + 1)}
                disabled={!canAdvance}
              >
                {current === STEPS.length - 2 ? 'Review →' : 'Next →'}
              </button>
            ) : (
              <button className="btn primary" onClick={onExport} disabled={!built.complete}>
                Export JSON
              </button>
            )}
          </nav>
        </main>

        <aside className="sidebar">
          <Summary built={built} />
        </aside>
      </div>
    </div>
  )
}
