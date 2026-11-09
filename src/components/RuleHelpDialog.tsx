import { useEffect } from 'react'

interface Props {
  title: string
  paragraphs: string[]
  /** Small heading above the title. */
  label?: string
  onClose: () => void
}

/** A short rules explanation shown when a player first meets a mechanic. */
export function RuleHelpDialog({ title, paragraphs, label = 'How it works', onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="rule-help-title">
        <div className="card-head">
          <span className="step-index">{label}</span>
          <h2 id="rule-help-title">{title}</h2>
        </div>
        {paragraphs.map((text) => (
          <p className="trait" key={text} style={{ marginBottom: 10 }}>
            {text}
          </p>
        ))}
        <div className="review-actions">
          <button className="btn primary" autoFocus onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
