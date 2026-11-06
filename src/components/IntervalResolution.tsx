import { useEffect, useRef, useState } from 'react'
import { SPECIAL_LABELS } from '../data/types'
import type { PartyMember } from '../lib/dungeonState'
import type { ResolutionStep } from '../lib/intervalActions'
import { AVATAR_COLORS } from '../lib/partyColors'
import { useDrawAnimation } from '../lib/useDrawAnimation'
import { DrawStage } from './DrawStage'
import { Portrait } from './Portrait'

const INTRO_MS = 1100
const OUTCOME_MS = 2600
const REDUCED_MS = 400

const fmtSigned = (n: number) => (n > 0 ? `+${n}` : `${n}`)

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

type Stage = 'intro' | 'drawing' | 'outcome'

const TONE_LABEL = { success: 'Success', failure: 'Failure', neutral: '' } as const

function testBadge(step: ResolutionStep): string {
  const outcome = step.test?.result.outcome
  if (outcome === 'critical-success') return 'Critical Success'
  if (outcome === 'critical-failure') return 'Critical Failure'
  return step.test?.passed ? 'Success' : 'Failure'
}

function StepSummary({ step }: { step: ResolutionStep }) {
  return (
    <li className={`resolution-line ${step.tone}`}>
      <b>{step.title}.</b> {step.intro} {step.outcome}
      {step.test && <span className="tag">{testBadge(step)}</span>}
    </li>
  )
}

interface Props {
  steps: ResolutionStep[]
  party: PartyMember[]
  interval: number
  onFinish: () => void
}

export function IntervalResolution({ steps, party, interval, onFinish }: Props) {
  const [index, setIndex] = useState(0)
  const [stage, setStage] = useState<Stage>('intro')
  const [finished, setFinished] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const animation = useDrawAnimation(() => setStage('outcome'))
  const { start, reset } = animation

  const step = steps[index]
  const isLast = index >= steps.length - 1
  const memberIndex = party.findIndex((m) => m.key === step.memberKey)
  const member = memberIndex >= 0 ? party[memberIndex] : null

  const advance = () => {
    window.clearTimeout(timer.current)
    if (isLast) {
      setFinished(true)
      return
    }
    reset()
    setIndex((i) => i + 1)
    setStage('intro')
  }

  const beginStep = () => {
    window.clearTimeout(timer.current)
    if (step.test) {
      start(step.test.result)
      setStage('drawing')
    } else {
      setStage('outcome')
    }
  }

  const latest = useRef({ beginStep, advance })
  useEffect(() => {
    latest.current = { beginStep, advance }
  })

  useEffect(() => {
    if (finished) return
    const slow = !reducedMotion()
    if (stage === 'intro') {
      timer.current = window.setTimeout(() => latest.current.beginStep(), slow ? INTRO_MS : REDUCED_MS)
    } else if (stage === 'outcome') {
      timer.current = window.setTimeout(() => latest.current.advance(), slow ? OUTCOME_MS : REDUCED_MS * 2)
    }
    return () => window.clearTimeout(timer.current)
  }, [stage, index, finished])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFinished(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const test = step.test
  const tokensTotal = animation.shown.reduce((sum, d) => sum + (d.modifier ?? 0), 0)
  const drawnAll = animation.phase === 'done'

  return (
    <div className="modal-backdrop">
      <div className="modal card resolution" role="dialog" aria-modal="true" aria-labelledby="resolution-title">
        {finished ? (
          <>
            <div className="card-head">
              <span className="step-index">Interval {interval}</span>
              <h2 id="resolution-title">What happened</h2>
            </div>
            <ul className="resolution-list">
              {steps.map((s, i) => (
                <StepSummary key={i} step={s} />
              ))}
            </ul>
            <div className="review-actions">
              <button className="btn primary" onClick={onFinish} autoFocus>
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="card-head">
              <span className="step-index">
                Interval {interval} · Step {index + 1} of {steps.length}
              </span>
              <div className="resolution-actor">
                {member ? (
                  <span
                    className="party-avatar"
                    style={{ borderColor: AVATAR_COLORS[memberIndex % AVATAR_COLORS.length] }}
                  >
                    <Portrait kind="profession" id={member.professionId} size="md" />
                  </span>
                ) : (
                  <Portrait kind="item" id="torch" size="md" />
                )}
                <div>
                  <h2 id="resolution-title">{step.title}</h2>
                  <p className="hint">{member ? member.name : 'The party'}</p>
                </div>
              </div>
            </div>

            <p className="resolution-intro">{step.intro}</p>

            {test && (
              <div className="resolution-test">
                <p className="hint">
                  {SPECIAL_LABELS[test.attribute]} test · Difficulty {test.difficulty}
                  {test.penalty > 0 && ` +${test.penalty} for darkness`}
                </p>
                <DrawStage
                  compact
                  shaking={animation.phase === 'shaking'}
                  shown={animation.shown}
                  bagLabel={`${member?.name ?? ''}'s bag`}
                  placeholder="Reaching into the bag…"
                />
                {drawnAll && (
                  <p className={`resolution-math ${step.tone}`}>
                    Tokens {fmtSigned(tokensTotal)} + {SPECIAL_LABELS[test.attribute]} {test.attributeValue} ={' '}
                    <b>{test.total}</b> against {test.difficulty + test.penalty}
                    <span className={`result-badge ${step.tone}`}>{testBadge(step)}</span>
                  </p>
                )}
              </div>
            )}

            {stage === 'outcome' && (
              <p className={`outcome resolution-outcome ${step.tone}`} role="status">
                {step.outcome}
                {!test && TONE_LABEL[step.tone] && <span className="tag">{TONE_LABEL[step.tone]}</span>}
              </p>
            )}

            <div className="review-actions resolution-controls">
              <button className="btn" onClick={() => setFinished(true)}>
                Skip to summary
              </button>
              <button
                className="btn primary"
                onClick={stage === 'intro' ? beginStep : advance}
                disabled={stage === 'drawing'}
              >
                {stage === 'drawing' ? 'Drawing…' : isLast && stage === 'outcome' ? 'Finish' : 'Next'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
