import { useEffect, useRef, useState } from 'react'
import { SPECIAL_LABELS } from '../data/types'
import { AVATAR_COLORS } from '../lib/partyColors'
import type { Clash, ResolutionStep } from '../lib/resolution'
import { useDrawAnimation } from '../lib/useDrawAnimation'
import { DrawStage } from './DrawStage'
import { Portrait } from './Portrait'
import { Typewriter } from './Typewriter'

const AFTER_INTRO_MS = 350
const AFTER_OUTCOME_MS = 1300
const REDUCED_MS = 300
const CLASH_REVEAL_MS = 900
const CLASH_TOTAL_MS = 2000
const ENEMY_COLOR = '#ff6a6a'

const fmtSigned = (n: number) => (n > 0 ? `+${n}` : `${n}`)

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

type Stage = 'intro' | 'drawing' | 'clash' | 'outcome'

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
      {step.test && step.testMode === 'check' && <span className="tag">{testBadge(step)}</span>}
    </li>
  )
}

function actorColor(colorIndex: number): string {
  return colorIndex < 0 ? ENEMY_COLOR : AVATAR_COLORS[colorIndex % AVATAR_COLORS.length]
}

/** An enemy's attack value set against a player's Defense score, then the result. */
function ClashPanel({ clash, onDone }: { clash: Clash; onDone: () => void }) {
  const [resolved, setResolved] = useState(false)
  const done = useRef(onDone)

  useEffect(() => {
    done.current = onDone
  })

  useEffect(() => {
    const quick = reducedMotion()
    const reveal = window.setTimeout(() => setResolved(true), quick ? 0 : CLASH_REVEAL_MS)
    const finish = window.setTimeout(() => done.current(), quick ? REDUCED_MS : CLASH_TOTAL_MS)
    return () => {
      window.clearTimeout(reveal)
      window.clearTimeout(finish)
    }
  }, [])

  const scale = Math.max(clash.defenseBefore, clash.attack, 1)
  const defense = resolved ? clash.defenseAfter : clash.defenseBefore

  return (
    <div className="clash" role="img" aria-label={`Attack ${clash.attack} against Defense ${clash.defenseBefore}`}>
      <div className="clash-side attack">
        <span className="step-index">Attack</span>
        <b className="clash-num">{clash.attack}</b>
      </div>
      <span className="versus" aria-hidden="true">
        vs
      </span>
      <div className="clash-side defense">
        <span className="clash-target">
          <Portrait
            kind={clash.target.artKind}
            id={clash.target.artId}
            size="sm"
            className={resolved && clash.breaks ? 'hit-flash' : ''}
          />
          <span className="step-index">{clash.target.name}&rsquo;s Defense</span>
        </span>
        <b className="clash-num">{defense}</b>
        <span className="clash-bar">
          <span style={{ width: `${(defense / scale) * 100}%` }} />
        </span>
      </div>
      <span
        className={`result-badge clash-badge ${resolved ? (clash.breaks ? 'failure' : 'success') : 'pending'}`}
        aria-live="polite"
      >
        {resolved ? (clash.breaks ? 'Breaks through' : 'Blocked') : '...'}
      </span>
    </div>
  )
}

interface Props {
  /** e.g. "Interval 3" or "Round 2". */
  heading: string
  steps: ResolutionStep[]
  onFinish: () => void
}

export function ResolutionOverlay({ heading, steps, onFinish }: Props) {
  const [index, setIndex] = useState(0)
  const [stage, setStage] = useState<Stage>('intro')
  const [finished, setFinished] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const animation = useDrawAnimation(() => setStage('outcome'))
  const { start, reset } = animation

  const step = steps[index]
  const isLast = index >= steps.length - 1
  const actor = step.actor

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
      setStage(step.clash ? 'clash' : 'outcome')
    }
  }

  const latest = useRef({ beginStep, advance })
  useEffect(() => {
    latest.current = { beginStep, advance }
  })

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const afterIntro = () => {
    timer.current = window.setTimeout(() => latest.current.beginStep(), reducedMotion() ? REDUCED_MS : AFTER_INTRO_MS)
  }

  const afterOutcome = () => {
    timer.current = window.setTimeout(() => latest.current.advance(), reducedMotion() ? REDUCED_MS : AFTER_OUTCOME_MS)
  }

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
  const attacking = Boolean(actor && actor.colorIndex < 0 && step.clash && stage === 'clash')

  const next = () => {
    window.clearTimeout(timer.current)
    if (stage === 'intro') beginStep()
    else if (stage === 'clash') setStage('outcome')
    else advance()
  }

  return (
    <div className="modal-backdrop">
      <div className="modal card resolution" role="dialog" aria-modal="true" aria-labelledby="resolution-title">
        {finished ? (
          <>
            <div className="card-head">
              <span className="step-index">{heading}</span>
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
                {heading} · Step {index + 1} of {steps.length}
              </span>
              <div className="resolution-actor">
                {actor ? (
                  <span
                    className={`party-avatar${attacking ? ' lunge' : ''}`}
                    style={{ borderColor: actorColor(actor.colorIndex) }}
                  >
                    <Portrait kind={actor.artKind} id={actor.artId} size="md" />
                  </span>
                ) : (
                  <Portrait kind="item" id="torch" size="md" />
                )}
                <div>
                  <h2 id="resolution-title">{step.title}</h2>
                  <p className="hint">{actor ? actor.name : 'The party'}</p>
                </div>
              </div>
            </div>

            <p className="resolution-intro">
              {stage === 'intro' ? <Typewriter key={`${index}-intro`} text={step.intro} onDone={afterIntro} /> : step.intro}
            </p>

            {test && (
              <div className="resolution-test">
                <p className="hint">
                  {step.testHeading ??
                    (step.testMode === 'score'
                      ? `${SPECIAL_LABELS[test.attribute]} test \u00b7 the result is added to the score`
                      : `${SPECIAL_LABELS[test.attribute]} test \u00b7 Difficulty ${test.difficulty}${
                          test.penalty > 0 ? ` +${test.penalty} for darkness` : ''
                        }`)}
                </p>
                <DrawStage
                  compact
                  shaking={animation.phase === 'shaking'}
                  shown={animation.shown}
                  bagLabel={step.bagLabel ?? `${actor?.name ?? ''}'s bag`}
                  placeholder="Reaching into the bag…"
                />
                {drawnAll && (
                  <p className={`resolution-math ${step.tone}`}>
                    {step.resultLine ?? (
                      <>
                        Tokens {fmtSigned(tokensTotal)} + {SPECIAL_LABELS[test.attribute]} {test.attributeValue}
                        {test.bonuses.map((b) => ` + ${b.label} ${b.value}`).join('')} ={' '}
                        <b>{test.total}</b> against {test.difficulty + test.penalty}
                      </>
                    )}
                    {step.testMode === 'check' && (
                      <span className={`result-badge ${step.tone}`}>{testBadge(step)}</span>
                    )}
                  </p>
                )}
              </div>
            )}

            {step.clash && (stage === 'clash' || stage === 'outcome') && (
              <ClashPanel key={`${index}-clash`} clash={step.clash} onDone={() => stage === 'clash' && setStage('outcome')} />
            )}

            {stage === 'outcome' && (
              <p className={`outcome resolution-outcome ${step.tone}`} role="status">
                <Typewriter key={`${index}-outcome`} text={step.outcome} onDone={afterOutcome} />
              </p>
            )}

            <div className="review-actions resolution-controls">
              <button className="btn" onClick={() => setFinished(true)}>
                Skip to summary
              </button>
              <button className="btn primary" onClick={next} disabled={stage === 'drawing'}>
                {stage === 'drawing' ? 'Drawing…' : isLast && stage === 'outcome' ? 'Finish' : 'Next'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
