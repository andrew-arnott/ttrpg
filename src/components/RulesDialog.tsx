import { useEffect } from 'react'
import { GUIDE_BLOCKS } from '../lib/rulesGuide'
import { sectionOf } from '../lib/markdown'
import { RulesContent } from './RulesContent'

/** One section of the rules in a popup, so the tutorial can show it without leaving the dungeon. */
export function RulesDialog({ slug, onClose }: { slug: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const blocks = sectionOf(GUIDE_BLOCKS, slug)

  return (
    <div className="modal-backdrop rules-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card rules-dialog" role="dialog" aria-modal="true" aria-label="Rules">
        <div className="card-head">
          <span className="step-index">The rules</span>
        </div>
        {blocks.length > 0 ? <RulesContent blocks={blocks} /> : <p className="hint">That section was not found.</p>}
        <div className="review-actions">
          <button className="btn primary" autoFocus onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
