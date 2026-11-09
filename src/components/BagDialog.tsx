import { useEffect } from 'react'
import { TOKENS } from '../data/tokens'
import type { TokenStack } from '../data/types'
import { bagStats } from '../lib/buildCharacter'
import { Tip } from './Tip'
import { TokenBag } from './TokenBag'

interface Props {
  name: string
  bag: TokenStack[]
  /** Resource tokens out of the bag and in play, by token id. */
  inPlay: Record<string, number>
  /** Condition tokens sealed on the character. */
  sealed?: string[]
  shieldsInPlay?: number
  onClose: () => void
}

/** What is in a character's bag right now, and what has been taken out of it. */
export function BagDialog({ name, bag, inPlay, sealed = [], shieldsInPlay = 0, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const playing = Object.entries(inPlay).filter(([, n]) => n > 0)

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="bag-title">
        <div className="card-head">
          <span className="step-index">Token bag</span>
          <h2 id="bag-title">{name}&rsquo;s bag</h2>
          <p className="hint">{bag.reduce((n, s) => n + s.count, 0)} tokens in the bag right now.</p>
        </div>

        <TokenBag bag={bag} stats={bagStats(bag)} />

        {(playing.length > 0 || sealed.length > 0 || shieldsInPlay > 0) && (
          <>
            <h3 className="section-title">Out of the bag</h3>
            <div className="tokens">
              {playing.map(([id, n]) => (
                <Tip key={id} content={TOKENS[id]?.effect ?? TOKENS[id]?.name}>
                  <span className="chip">
                    {TOKENS[id]?.name ?? id} <span className="count">{n} in play</span>
                  </span>
                </Tip>
              ))}
              {shieldsInPlay > 0 && (
                <Tip content={TOKENS.shield.effect}>
                  <span className="chip">
                    Shield <span className="count">{shieldsInPlay} in play</span>
                  </span>
                </Tip>
              )}
              {sealed.map((id, i) => (
                <Tip key={`${id}-${i}`} content={TOKENS[id]?.effect}>
                  <span className="chip condition">
                    {TOKENS[id]?.name ?? id} <span className="count">sealed</span>
                  </span>
                </Tip>
              ))}
            </div>
          </>
        )}

        <div className="review-actions">
          <button className="btn primary" autoFocus onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
