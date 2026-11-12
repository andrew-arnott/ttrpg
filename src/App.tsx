import { useEffect, useMemo, useRef, useState } from 'react'
import { BagSimulator } from './components/BagSimulator'
import { SheetView } from './components/CharacterSheet'
import { DungeonView } from './components/DungeonView'
import { Review } from './components/Review'
import { SavedCharactersDialog } from './components/SavedCharactersDialog'
import {
  StepBackground,
  StepEquipment,
  StepPortrait,
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
import { parseDraft } from './lib/draftIO'
import { buildRoster } from './lib/roster'
import type { SavedCharacter } from './lib/savedCharacters'
import { useSavedCharacters } from './lib/useSavedCharacters'
import { HomeView } from './components/HomeView'
import { RulesView } from './components/RulesView'
import { useView, VIEWS } from './lib/useView'

const EXPORT_VERSION = 1

/** Wizard order. The review step owns no validation of its own. */
const STEPS: { id: StepId | 'review'; label: string }[] = [
  { id: 'profession', label: 'Profession' },
  { id: 'species', label: 'Species' },
  { id: 'background', label: 'Background' },
  { id: 'special', label: 'SPECIAL' },
  { id: 'abilities', label: 'Abilities' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'portrait', label: 'Portrait' },
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
  const [savedId, setSavedId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const [view, setView] = useView()
  const { saved, save, remove } = useSavedCharacters()

  const built = useMemo(() => buildCharacter(draft), [draft])
  const roster = useMemo(() => buildRoster(draft, savedId, saved), [draft, savedId, saved])
  const update = (patch: Partial<CharacterDraft>) => setDraft((d) => ({ ...d, ...patch }))

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 3500)
    return () => window.clearTimeout(timer)
  }, [notice])

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

  const displayName = built.name.trim() || 'Unnamed adventurer'

  const onSave = (asNew: boolean) => {
    const entry = save(draft, asNew ? null : savedId)
    setSavedId(entry.id)
    setNotice(`Saved ${displayName}.`)
  }

  const onLoadSaved = (character: SavedCharacter) => {
    setDraft(character.draft)
    setSavedId(character.id)
    setStepIndex(STEPS.length - 1)
    setImportError(null)
    setDialogOpen(false)
    setView('creator')
    setNotice(`Loaded ${character.draft.name.trim() || 'Unnamed adventurer'}.`)
  }

  const onDeleteSaved = (id: string) => {
    remove(id)
    if (id === savedId) setSavedId(null)
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
        equipment: built.inventory.map((e) => `${e.count}x ${e.item.name}`),
        coins: built.coinsLeft,
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
        setSavedId(null)
        setStepIndex(STEPS.length - 1)
        setView('creator')
      }
    } catch {
      setImportError('That file is not valid JSON.')
    }
  }

  const stepProps = { draft, built, update }

  return (
    <div className="app">
      <header className="masthead no-print">
        <div>
          <h1>
            <a href="#/home">Fantasy TTRPG</a>
          </h1>
          <p className="sub">A fantasy tabletop RPG of strategy, exploration, and adventure.</p>
        </div>
        <div className="toolbar" hidden={view === 'home' || view === 'rules'}>
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
          <button className="btn" onClick={() => onSave(false)}>
            {savedId ? 'Update save' : 'Save'}
          </button>
          <button className="btn" onClick={() => setDialogOpen(true)}>
            Characters ({saved.length})
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            Import JSON
          </button>
          <button
            className="btn"
            onClick={() => {
              setDraft(emptyDraft())
              setSavedId(null)
              setStepIndex(0)
              setImportError(null)
              setView('creator')
            }}
          >
            Start over
          </button>
        </div>
      </header>

      <nav className="view-tabs no-print" aria-label="Sections">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            className={`view-tab${view === v.id ? ' active' : ''}`}
            aria-current={view === v.id ? 'page' : undefined}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {notice && (
        <p className="notice no-print" role="status">
          {notice}
        </p>
      )}

      {importError && (
        <p className="hint no-print" style={{ color: 'var(--danger)', marginTop: 8 }} role="alert">
          {importError}
        </p>
      )}

      {view === 'home' && (
        <HomeView
          savedCount={saved.length}
          onGo={setView}
          onOpenCharacters={() => setDialogOpen(true)}
        />
      )}

      {view === 'creator' && (
        <>
          <Stepper current={current} reachable={reachable} built={built} onGo={goTo} />

          <div className="layout">
            <main>
              {step.id === 'profession' && <StepProfession {...stepProps} />}
              {step.id === 'species' && <StepSpecies {...stepProps} />}
              {step.id === 'background' && <StepBackground {...stepProps} />}
              {step.id === 'special' && <StepSpecial {...stepProps} />}
              {step.id === 'abilities' && <StepProfessionDetail {...stepProps} />}
              {step.id === 'equipment' && <StepEquipment {...stepProps} />}
              {step.id === 'portrait' && <StepPortrait {...stepProps} />}
              {step.id === 'review' && (
                <Review
                  draft={draft}
                  built={built}
                  update={update}
                  onExport={onExport}
                  onOpenSheet={() => setView('sheet')}
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
        </>
      )}

      {view === 'sheet' && <SheetView current={draft} saved={saved} />}
      {view === 'bag' && <BagSimulator roster={roster} />}
      {view === 'dungeon' && <DungeonView roster={roster} />}
      {view === 'rules' && <RulesView />}

      {dialogOpen && (
        <SavedCharactersDialog
          saved={saved}
          currentSavedId={savedId}
          onSave={onSave}
          onLoad={onLoadSaved}
          onDelete={onDeleteSaved}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  )
}
