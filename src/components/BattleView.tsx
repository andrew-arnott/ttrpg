import { useState } from 'react'
import { defaultTurn, resolveRound, type BattlePlan } from '../lib/battle'
import { endBattle, type DungeonAction, type DungeonState } from '../lib/dungeonState'
import type { ResolutionStep } from '../lib/resolution'
import { BattleBoard } from './BattleBoard'
import { CombatPlanner } from './CombatPlanner'
import { ResolutionOverlay } from './ResolutionOverlay'

interface Props {
  state: DungeonState
  dispatch: (action: DungeonAction) => void
  onLeave: () => void
}

export function BattleView({ state, dispatch, onLeave }: Props) {
  const battle = state.battle!
  const [plan, setPlan] = useState<BattlePlan>({})
  const [pending, setPending] = useState<{ next: DungeonState; steps: ResolutionStep[] } | null>(null)

  const opening = battle.opening.length > 0 ? battle.opening : null

  const finishOpening = () =>
    dispatch({ type: 'replace', state: { ...state, battle: { ...battle, opening: [] } } })

  const resolve = () => {
    const fullPlan: BattlePlan = Object.fromEntries(
      battle.players.map((p) => [p.key, plan[p.key] ?? defaultTurn(battle, p)]),
    )
    const result = resolveRound(battle, fullPlan, Math.random)
    setPending({ next: { ...state, battle: result.battle }, steps: result.steps })
  }

  const finishRound = () => {
    if (pending) dispatch({ type: 'replace', state: pending.next })
    setPending(null)
    setPlan({})
  }

  return (
    <div className="layout" style={{ marginTop: 20 }}>
      <main>
        <BattleBoard battle={battle} />

        {battle.result === 'ongoing' && (
          <CombatPlanner battle={battle} plan={plan} onChange={setPlan} onResolve={resolve} />
        )}

        {battle.result === 'victory' && (
          <section className="card">
            <div className="card-head">
              <span className="step-index">Battle</span>
              <h2>Victory!</h2>
              <p className="hint">
                The patrol is beaten. Anyone who fell wakes with 1 HP, and sealed tokens return to their owners.
              </p>
            </div>
            <div className="review-actions">
              <button className="btn primary" onClick={() => dispatch({ type: 'replace', state: endBattle(state) })}>
                Continue exploring
              </button>
            </div>
          </section>
        )}

        {battle.result === 'defeat' && (
          <section className="card">
            <div className="card-head">
              <span className="step-index">Battle</span>
              <h2>The party has fallen</h2>
              <p className="hint">Every adventurer is down. Leave the dungeon and try again.</p>
            </div>
            <div className="review-actions">
              <button className="btn primary" onClick={onLeave}>
                Leave dungeon
              </button>
            </div>
          </section>
        )}
      </main>

      <aside className="sidebar">
        <section className="card">
          <div className="card-head">
            <h2>Battle log</h2>
          </div>
          <ol className="dungeon-log" aria-live="polite">
            {battle.log.slice(0, 8).map((line, i) => (
              <li key={`${battle.log.length - i}-${line}`}>{line}</li>
            ))}
          </ol>
        </section>
      </aside>

      {opening && !pending && (
        <ResolutionOverlay heading="Battle begins" steps={opening} onFinish={finishOpening} />
      )}
      {pending && (
        <ResolutionOverlay heading={`Round ${battle.round}`} steps={pending.steps} onFinish={finishRound} />
      )}
    </div>
  )
}
