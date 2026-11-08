import { useState } from 'react'
import type { BattleState, ReactionAnswer } from '../lib/battle'
import { AVATAR_COLORS } from '../lib/partyColors'
import { Portrait } from './Portrait'

interface Props {
  battle: BattleState
  onAnswer: (answer: ReactionAnswer) => void
}

/** Asks whether a character wants to use a Triggered ability that has just come up. */
export function ReactionPrompt({ battle, onAnswer }: Props) {
  const request = battle.pending!.request
  const reactor = battle.players.find((p) => p.key === request.reactorKey)
  const [targetId, setTargetId] = useState(request.targets?.[0]?.id)

  return (
    <section className="card" aria-live="polite">
      <div className="card-head">
        <span className="step-index">Triggered ability</span>
        <div className="resolution-actor">
          {reactor && (
            <span
              className="party-avatar"
              style={{ borderColor: AVATAR_COLORS[reactor.colorIndex % AVATAR_COLORS.length] }}
            >
              <Portrait kind="profession" id={reactor.professionId} size="md" />
            </span>
          )}
          <div>
            <h2>
              {reactor?.name}: use {request.title}?
            </h2>
            <p className="hint">Costs {request.cost}. It does not use an action.</p>
          </div>
        </div>
      </div>

      <p className="trait" style={{ marginTop: 12 }}>
        {request.prompt}
      </p>

      {request.targets && request.targets.length > 0 && (
        <label className="prompt-target">
          <span className="step-index">Attack which enemy?</span>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            {request.targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="review-actions prompt-actions">
        <button className="btn" onClick={() => onAnswer({ use: false })}>
          No thanks
        </button>
        <button className="btn primary" onClick={() => onAnswer({ use: true, targetId })}>
          Use {request.title}
        </button>
      </div>
    </section>
  )
}
