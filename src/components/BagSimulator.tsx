import { useEffect, useMemo, useRef, useState } from 'react'
import { TOKENS } from '../data/tokens'
import { buildCharacter } from '../lib/buildCharacter'
import { drawTest, simulate, type SimulationSummary, type TestResult } from '../lib/drawTest'
import type { RosterEntry } from '../lib/roster'
import { Portrait } from './Portrait'
import { BagStatTiles, TokenBag } from './TokenBag'
import { TokenCoin } from './TokenCoin'

const REVEAL_MS = 650
const REDUCED_REVEAL_MS = 120
const SHAKE_MS = 700
const SIMULATION_RUNS = 5000
const HISTORY_LIMIT = 12

const fmtSigned = (n: number) => (n > 0 ? `+${n}` : `${n}`)
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

type Phase = 'idle' | 'shaking' | 'revealing' | 'done'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function outcomeText(result: TestResult): string {
  if (result.outcome === 'critical-failure') return 'Critical Failure: the test fails automatically and generates a Complication.'
  if (result.outcome === 'critical-success') return `Critical Success! Total ${fmtSigned(result.total)}.`
  return `Total ${fmtSigned(result.total)}.`
}

export function BagSimulator({ roster }: { roster: RosterEntry[] }) {
  const [selectedKey, setSelectedKey] = useState(roster[0]?.key ?? '')
  const entry = roster.find((r) => r.key === selectedKey) ?? roster[0]
  const built = useMemo(() => (entry ? buildCharacter(entry.draft) : null), [entry])

  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<TestResult | null>(null)
  const [revealed, setRevealed] = useState(0)
  const [history, setHistory] = useState<TestResult[]>([])
  const [summary, setSummary] = useState<SimulationSummary | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (phase === 'shaking') {
      timer.current = window.setTimeout(() => setPhase('revealing'), prefersReducedMotion() ? 0 : SHAKE_MS)
    } else if (phase === 'revealing' && result) {
      const delay = prefersReducedMotion() ? REDUCED_REVEAL_MS : REVEAL_MS
      if (revealed >= result.drawn.length) {
        timer.current = window.setTimeout(() => {
          setHistory((h) => [result, ...h].slice(0, HISTORY_LIMIT))
          setPhase('done')
        }, delay / 2)
      } else {
        timer.current = window.setTimeout(() => setRevealed((n) => n + 1), delay)
      }
    }
    return () => window.clearTimeout(timer.current)
  }, [phase, revealed, result])

  if (!entry || !built) return <p className="hint">No characters available.</p>

  const busy = phase === 'shaking' || phase === 'revealing'
  const shown = result ? result.drawn.slice(0, revealed) : []
  const runningTotal = shown.reduce((sum, d) => sum + (d.modifier ?? 0), 0)

  const draw = () => {
    if (busy) return
    setResult(drawTest(built.bag))
    setRevealed(0)
    setPhase('shaking')
  }

  const pickCharacter = (key: string) => {
    window.clearTimeout(timer.current)
    setSelectedKey(key)
    setPhase('idle')
    setResult(null)
    setRevealed(0)
    setHistory([])
    setSummary(null)
  }

  const remainingInBag = busy ? built.stats.size - shown.length : built.stats.size

  return (
    <div className="layout">
      <main>
        <section className="card">
          <div className="card-head">
            <span className="step-index">Token bag simulator</span>
            <h2>Draw a test</h2>
            <p className="hint">
              Tokens are drawn one at a time until one ends the draw. Chain tokens keep it going, and
              everything drawn adds to the total. All tokens return to the bag afterwards.
            </p>
          </div>

          <div className="roster-pick">
            <Portrait kind="profession" id={built.profession?.id} size="sm" />
            <label>
              <span className="step-index">Character</span>
              <select value={entry.key} onChange={(e) => pickCharacter(e.target.value)}>
                {roster.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                    {r.source === 'sample' ? ' (sample)' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="bag-stage">
            <div className={`bag-holder${phase === 'shaking' ? ' shaking' : ''}`}>
              <Portrait kind="item" id="pouch" size="xl" className="bag-art" />
              <span className="bag-count" aria-live="polite">
                {remainingInBag} in bag
              </span>
            </div>

            <div className="table-felt" aria-live="polite">
              {shown.length === 0 && phase !== 'done' && (
                <span className="hint">
                  {busy ? 'Reaching into the bag…' : 'Draw to see what comes out.'}
                </span>
              )}
              {shown.map((d, i) => (
                <div key={i} className="drawn">
                  <TokenCoin tokenId={d.tokenId} />
                  <span className="drawn-name">{d.name}</span>
                  {d.chain && <span className="drawn-chain">chain</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="draw-controls">
            <button className="btn primary" onClick={draw} disabled={busy}>
              {busy ? 'Drawing…' : phase === 'done' ? 'Draw again' : 'Draw tokens'}
            </button>
            <span className="running-total" aria-live="polite">
              Total <b>{result ? fmtSigned(runningTotal) : '—'}</b>
            </span>
          </div>

          {phase === 'done' && result && (
            <p
              className={`outcome ${result.outcome}`}
              role="status"
            >
              {outcomeText(result)}
              {result.complication && result.outcome !== 'critical-failure' && ' A Complication was drawn.'}
            </p>
          )}

          {phase === 'done' && result && (
            <ul className="notes">
              {[...new Set(result.drawn.map((d) => d.tokenId))]
                .filter((id) => TOKENS[id]?.effect)
                .map((id) => (
                  <li key={id}>
                    <b>{TOKENS[id].name}:</b> {TOKENS[id].effect}
                  </li>
                ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Recent draws</h2>
            <p className="hint">
              Newest first.{' '}
              {history.length === 0 ? 'Nothing drawn yet.' : `Showing the last ${history.length}.`}
            </p>
          </div>
          <div className="history">
            {history.map((h, i) => (
              <div className="history-row" key={i}>
                <span className="history-total">{h.outcome === 'critical-failure' ? 'FAIL' : fmtSigned(h.total)}</span>
                <span className="history-tokens">
                  {h.drawn.map((d, j) => (
                    <TokenCoin key={j} tokenId={d.tokenId} size="sm" />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <aside className="sidebar">
        <section className="card">
          <div className="card-head">
            <h2>{built.name.trim() || 'Unnamed adventurer'}</h2>
            <p className="hint">
              {[built.species?.name, built.background?.name, built.profession?.name]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <TokenBag bag={built.bag} stats={built.stats} />
          <div style={{ marginTop: 14 }}>
            <BagStatTiles stats={built.stats} />
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Check the maths</h2>
            <p className="hint">
              Run {SIMULATION_RUNS.toLocaleString()} tests at once and compare with the exact odds above.
            </p>
          </div>
          <button className="btn" onClick={() => setSummary(simulate(built.bag, SIMULATION_RUNS))}>
            Run {SIMULATION_RUNS.toLocaleString()} tests
          </button>
          {summary && (
            <table className="tokens-table">
              <thead>
                <tr>
                  <th />
                  <th className="num">Simulated</th>
                  <th className="num">Exact</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Critical success</td>
                  <td className="num">{pct(summary.criticalSuccessRate)}</td>
                  <td className="num">{pct(built.stats.critSuccessChance)}</td>
                </tr>
                <tr>
                  <td>Critical failure</td>
                  <td className="num">{pct(summary.criticalFailureRate)}</td>
                  <td className="num">{pct(built.stats.critFailureChance)}</td>
                </tr>
                <tr>
                  <td>Complication</td>
                  <td className="num">{pct(summary.complicationRate)}</td>
                  <td className="num">{pct(built.stats.complicationChance)}</td>
                </tr>
                <tr>
                  <td>Tokens per test</td>
                  <td className="num">{summary.averageTokensDrawn.toFixed(2)}</td>
                  <td className="num">{built.stats.expectedTokensDrawn.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </section>
      </aside>
    </div>
  )
}
