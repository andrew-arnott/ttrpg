import { useEffect, useState } from 'react'
import { buildCharacter } from '../lib/buildCharacter'
import type { SavedCharacter } from '../lib/savedCharacters'
import { Portrait } from './Portrait'

interface Props {
  saved: SavedCharacter[]
  currentSavedId: string | null
  onSave: (asNew: boolean) => void
  onLoad: (character: SavedCharacter) => void
  onDelete: (id: string) => void
  onClose: () => void
}

const formatSavedAt = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export function SavedCharactersDialog({ saved, currentSavedId, onSave, onLoad, onDelete, onClose }: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="saved-title">
        <div className="card-head">
          <h2 id="saved-title">Saved characters</h2>
          <p className="hint">Stored in this browser only. Export JSON to move a character elsewhere.</p>
        </div>

        <div className="modal-actions">
          <button className="btn primary" onClick={() => onSave(false)}>
            {currentSavedId ? 'Update saved copy' : 'Save current'}
          </button>
          {currentSavedId && (
            <button className="btn" onClick={() => onSave(true)}>
              Save as new
            </button>
          )}
        </div>

        {saved.length === 0 ? (
          <p className="hint" style={{ margin: '14px 0' }}>
            Nothing saved yet. Save the character you are building to keep it for later.
          </p>
        ) : (
          <ul className="saved-list">
            {saved.map((c) => {
              const built = buildCharacter(c.draft)
              const isCurrent = c.id === currentSavedId
              return (
                <li key={c.id} className={`saved-item${isCurrent ? ' current' : ''}`}>
                  <Portrait kind="profession" id={c.draft.professionId} size="sm" />
                  <div className="saved-meta">
                    <span className="saved-name">
                      {c.draft.name.trim() || 'Unnamed adventurer'}
                      {isCurrent && <span className="tag">Editing</span>}
                      {!built.complete && <span className="tag warn">Unfinished</span>}
                    </span>
                    <span className="hint">
                      {[built.species?.name, built.background?.name, built.profession?.name]
                        .filter(Boolean)
                        .join(' · ') || 'Nothing chosen yet'}
                    </span>
                    <span className="hint">{formatSavedAt(c.savedAt)}</span>
                  </div>
                  <div className="saved-buttons">
                    <button className="btn" onClick={() => onLoad(c)}>
                      Load
                    </button>
                    {confirmingDelete === c.id ? (
                      <button
                        className="btn danger"
                        onClick={() => {
                          onDelete(c.id)
                          setConfirmingDelete(null)
                        }}
                        onBlur={() => setConfirmingDelete(null)}
                        autoFocus
                      >
                        Sure?
                      </button>
                    ) : (
                      <button className="btn" onClick={() => setConfirmingDelete(c.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div className="review-actions">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
