import { useState } from 'react'
import type { ReactionAnswer, ReactionRequest } from '../lib/reactionTypes'
import { AVATAR_COLORS } from '../lib/partyColors'
import { RULES_LINKS } from '../data/rulesLinks'
import { RulesLink } from './RulesLink'
import { CharacterPortrait } from './CharacterPortrait'

interface Props {
  request: ReactionRequest
  reactor?: { name: string; professionId: string; portrait?: string | null; colorIndex: number }
  onAnswer: (answer: ReactionAnswer) => void
}

/** Asks whether a character wants to use a Triggered ability that has just come up. */
export function ReactionPrompt({ request, reactor, onAnswer }: Props) {
  const [targetId, setTargetId] = useState(request.targets?.[0]?.id)

  return (
    <section className="card" aria-live="polite">
      <div className="card-head">
        <span className="step-index">{request.required ? 'Choice' : 'Triggered ability'}</span>
        <div className="resolution-actor">
          {reactor && (
            <span
              className="party-avatar"
              style={{ borderColor: AVATAR_COLORS[reactor.colorIndex % AVATAR_COLORS.length] }}
            >
              <CharacterPortrait professionId={reactor.professionId} portrait={reactor.portrait} size="md" />
            </span>
          )}
          <div>
            <h2>
              {request.required ? `${reactor?.name}: ${request.title.toLowerCase()}` : `${reactor?.name}: use ${request.title}?`}
            </h2>
            <p className="hint">
              {request.required ? 'Required: choose one.' : `Costs ${request.cost}. It does not use an action.`}{' '}
              <RulesLink
                slug={
                  request.abilityId === 'returnToken'
                    ? RULES_LINKS.complications
                    : request.required
                      ? RULES_LINKS.conditions
                      : RULES_LINKS.abilityTypes
                }
              >
                Rules
              </RulesLink>
            </p>
          </div>
        </div>
      </div>

      <p className="trait" style={{ marginTop: 12 }}>
        {request.prompt}
      </p>

      {request.targets && request.targets.length > 0 && (
        <label className="prompt-target">
          <span className="step-index">{request.required ? 'Which one?' : 'Attack which enemy?'}</span>
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
        {!request.required && (
          <button className="btn" onClick={() => onAnswer({ use: false })}>
            No thanks
          </button>
        )}
        <button className="btn primary" onClick={() => onAnswer({ use: true, targetId })}>
          {request.required ? (request.confirmLabel ?? 'Choose') : `Use ${request.title}`}
        </button>
      </div>
    </section>
  )
}
