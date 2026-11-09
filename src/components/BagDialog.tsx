import { useEffect } from 'react'
import { TOKENS } from '../data/tokens'
import type { TokenStack } from '../data/types'
import { sortStacks } from '../lib/tokenGroups'
import { Tip } from './Tip'
import { TokenCoin } from './TokenCoin'

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

function Coin({ tokenId, caption }: { tokenId: string; caption?: string }) {
  const def = TOKENS[tokenId]
  const detail = [def?.modifier == null ? null : def.modifier > 0 ? `+${def.modifier}` : `${def.modifier}`, def?.keywords.join(', ')]
    .filter(Boolean)
    .join(' · ')
  return (
    <Tip
      content={
        <>
          <b className="tip-name">{def?.name ?? tokenId}</b>
          {detail && <span className="hint">{detail}. </span>}
          {def?.effect}
        </>
      }
    >
      <div className="drawn still" tabIndex={0}>
        <TokenCoin tokenId={tokenId} titled={false} />
        <span className="drawn-name">{def?.name ?? tokenId}</span>
        {caption ? <span className="drawn-chain">{caption}</span> : def?.keywords.includes('chain') && <span className="drawn-chain">chain</span>}
      </div>
    </Tip>
  )
}

/** The tokens in a character's bag laid out the way they look when drawn, and what has been taken out. */
export function BagDialog({ name, bag, inPlay, sealed = [], shieldsInPlay = 0, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const inBag = sortStacks(bag).flatMap((s) => Array.from({ length: s.count }, () => s.tokenId))
  const outside = [
    ...Object.entries(inPlay).flatMap(([id, n]) => Array.from({ length: Math.max(0, n) }, () => ({ id, caption: 'in play' }))),
    ...Array.from({ length: shieldsInPlay }, () => ({ id: 'shield', caption: 'in play' })),
    ...sealed.map((id) => ({ id, caption: 'sealed' })),
  ]

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="bag-title">
        <div className="card-head">
          <span className="step-index">Token bag</span>
          <h2 id="bag-title">{name}&rsquo;s bag</h2>
          <p className="hint">{inBag.length} tokens in the bag right now. Hover one to read it.</p>
        </div>

        <div className="table-felt bag-felt">
          {inBag.length === 0 && <span className="hint">The bag is empty.</span>}
          {inBag.map((id, i) => (
            <Coin key={`${id}-${i}`} tokenId={id} />
          ))}
        </div>

        {outside.length > 0 && (
          <>
            <h3 className="section-title">Out of the bag</h3>
            <div className="table-felt bag-felt">
              {outside.map((t, i) => (
                <Coin key={`${t.id}-${i}`} tokenId={t.id} caption={t.caption} />
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
