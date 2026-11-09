import { useState } from 'react'
import {
  currentPlayer,
  endTurn,
  respondToReaction,
  runEnemyPhase,
  takeAction,
  type BattleState,
  type PlannedCombat,
  type ReactionAnswer,
} from '../lib/battle'
import { TUTORIAL_OUTRO } from '../data/tutorial'
import { endBattle, type DungeonAction, type DungeonState } from '../lib/dungeonState'
import type { ResolutionStep } from '../lib/resolution'
import { ActionPrompt } from './ActionPrompt'
import { BattleBoard } from './BattleBoard'
import { ReactionPrompt } from './ReactionPrompt'
import { ResolutionOverlay } from './ResolutionOverlay'

interface Props {
  state: DungeonState
  dispatch: (action: DungeonAction) => void
  onLeave: () => void
}

interface Playback {
  id: number
  heading: string
  steps: ResolutionStep[]
  /** Dungeon state to commit once the steps have played. */
  next: DungeonState
}

export function BattleView({ state, dispatch, onLeave }: Props) {
  const battle = state.battle!
  const [playback, setPlayback] = useState<Playback | null>(null)
  const [playbackCount, setPlaybackCount] = useState(0)
  const [engageHelpSeen, setEngageHelpSeen] = useState(false)

  const opening = battle.opening.length > 0 ? battle.opening : null
  const player = currentPlayer(battle)

  const withBattle = (next: BattleState): DungeonState => ({ ...state, battle: next })

  const play = (heading: string, steps: ResolutionStep[], next: DungeonState) => {
    setPlaybackCount((n) => n + 1)
    setPlayback({ id: playbackCount + 1, heading, steps, next })
  }

  /** Once every player has acted the enemies go straight away; otherwise just move on. */
  const settle = (next: DungeonState) => {
    const b = next.battle
    if (b && b.result === 'ongoing' && b.phase === 'enemies' && !b.pending) {
      const result = runEnemyPhase(b, Math.random)
      play(`Round ${b.round} \u00b7 enemy phase`, result.steps, { ...next, battle: result.battle })
    } else {
      setPlayback(null)
      dispatch({ type: 'replace', state: next })
    }
  }

  const act = (planned: PlannedCombat | null) => {
    const result = takeAction(battle, planned, Math.random)
    const next = withBattle(result.battle)
    if (result.steps.length === 0) settle(next)
    else play(`Round ${battle.round}`, result.steps, next)
  }

  const answerReaction = (answer: ReactionAnswer) => {
    const result = respondToReaction(battle, answer, Math.random)
    const next = withBattle(result.battle)
    if (result.steps.length === 0) settle(next)
    else play(`Round ${battle.round}`, result.steps, next)
  }

  const finishOpening = () => {
    const cleared = withBattle({ ...battle, opening: [] })
    settle(cleared)
  }

  return (
    <div className="layout" style={{ marginTop: 20 }}>
      <main>
        <BattleBoard battle={battle} activeKey={player?.key ?? null} />

        {player && !playback && !opening && (
          <ActionPrompt
            key={`${battle.round}-${battle.turnIndex}-${battle.actionsUsed}-${battle.log.length}`}
            battle={battle}
            player={player}
            onAct={act}
            onEndTurn={() => settle(withBattle(endTurn(battle)))}
            engageHelpSeen={engageHelpSeen}
            onEngageHelpSeen={() => setEngageHelpSeen(true)}
          />
        )}

        {battle.pending && !playback && !opening && (
          <ReactionPrompt
            request={battle.pending.request}
            reactor={battle.players.find((p) => p.key === battle.pending!.request.reactorKey)}
            onAnswer={answerReaction}
          />
        )}

        {battle.result === 'victory' && state.battleKind === 'boss' && (
          <section className="card completion">
            <div className="card-head">
              <span className="step-index">Tutorial complete</span>
              <h2>Congratulations!</h2>
            </div>
            {TUTORIAL_OUTRO.map((p) => (
              <p className="trait" key={p} style={{ marginBottom: 8 }}>
                {p}
              </p>
            ))}
            <div className="review-actions">
              <button className="btn primary" onClick={() => dispatch({ type: 'replace', state: endBattle(state) })}>
                Finish tutorial
              </button>
            </div>
          </section>
        )}

        {battle.result === 'victory' && state.battleKind !== 'boss' && (
          <section className="card">
            <div className="card-head">
              <span className="step-index">Battle</span>
              <h2>Victory!</h2>
              <p className="hint">
                The fight is won. Anyone who fell wakes with 1 HP, and sealed tokens return to their owners.
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

      {opening && !playback && (
        <ResolutionOverlay heading="Battle begins" steps={opening} onFinish={finishOpening} />
      )}
      {playback && (
        <ResolutionOverlay
          key={playback.id}
          heading={playback.heading}
          steps={playback.steps}
          onFinish={() => settle(playback.next)}
        />
      )}
    </div>
  )
}
