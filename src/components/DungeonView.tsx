import { useMemo, useReducer, useState } from 'react'
import { SUNKEN_CRYPT } from '../data/dungeon'
import { ITEMS, ITEMS_BY_ID } from '../data/items'
import { TUTORIAL_GOAL, TUTORIAL_INTRO, TUTORIAL_OUTRO } from '../data/tutorial'
import { TOKENS } from '../data/tokens'
import { buildCharacter } from '../lib/buildCharacter'
import {
  adjacentRoomIds,
  createDungeonState,
  dungeonReducer,
  lockedExits,
  passagesOf,
  roomById,
  sealStatuses,
  type DungeonState,
} from '../lib/dungeonState'
import { resolveInterval, type InteractionPlan } from '../lib/intervalActions'
import { AVATAR_COLORS } from '../lib/partyColors'
import { createPartyMember } from '../lib/partyMember'
import type { ResolutionStep } from '../lib/resolution'
import type { RosterEntry } from '../lib/roster'
import { torchLevel, TORCH_LEVEL_LABEL, totalIntervals, type TorchState } from '../lib/torch'
import { BattleView } from './BattleView'
import { DungeonMap } from './DungeonMap'
import { IntervalPlanner } from './IntervalPlanner'
import { ResolutionOverlay } from './ResolutionOverlay'
import { Portrait } from './Portrait'

const MAX_PARTY = 4

function TorchGauge({ torch }: { torch: TorchState }) {
  const total = totalIntervals(torch.spec)
  return (
    <div
      className="torch-gauge"
      role="img"
      aria-label={`${torch.remaining} of ${total} Intervals of burn time left`}
    >
      {Array.from({ length: total }, (_, i) => {
        const level = torchLevel({ spec: torch.spec, remaining: total - i })
        const burnt = i < total - torch.remaining
        return <span key={i} className={`seg ${level}${burnt ? '' : ' on'}`} />
      })}
    </div>
  )
}

function PartySetup({ roster, onStart }: { roster: RosterEntry[]; onStart: (chosen: RosterEntry[]) => void }) {
  const [chosenKeys, setChosenKeys] = useState<string[]>([])
  const full = chosenKeys.length >= MAX_PARTY

  const toggle = (key: string) =>
    setChosenKeys((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]))

  return (
    <section className="card">
      <div className="card-head">
        <span className="step-index">Dungeon simulator</span>
        <h2>{SUNKEN_CRYPT.name}</h2>
        <p className="hint">{SUNKEN_CRYPT.blurb}</p>
      </div>

      <div className="tutorial-intro">
        <h3>How this tutorial works</h3>
        {TUTORIAL_INTRO.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <p className="goal">
          <b>Your goal.</b> {TUTORIAL_GOAL}
        </p>
      </div>

      <h3 className="section-title" style={{ marginTop: 18 }}>
        Choose your party ({chosenKeys.length} of {MAX_PARTY})
      </h3>
      <div className="options two">
        {roster.map((entry) => {
          const built = buildCharacter(entry.draft)
          const selected = chosenKeys.includes(entry.key)
          const slot = chosenKeys.indexOf(entry.key)
          return (
            <button
              key={entry.key}
              className="option with-art"
              aria-pressed={selected}
              disabled={!selected && full}
              onClick={() => toggle(entry.key)}
            >
              <Portrait kind="profession" id={built.profession?.id} />
              <span className="name">
                {entry.label}
                {selected && (
                  <span className="tag" style={{ borderColor: AVATAR_COLORS[slot % AVATAR_COLORS.length] }}>
                    #{slot + 1}
                  </span>
                )}
                {entry.source === 'sample' && <span className="tag">Sample</span>}
              </span>
              <span className="desc">
                {[built.species?.name, built.background?.name, built.profession?.name]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <span className="meta">
                {built.startingHp} HP · {built.inventory.find((e) => e.item.id === 'torch')?.count ?? 0} torches
              </span>
            </button>
          )
        })}
      </div>

      <div className="review-actions">
        <button
          className="btn primary"
          disabled={chosenKeys.length === 0}
          onClick={() =>
            onStart(chosenKeys.flatMap((k) => roster.filter((r) => r.key === k)))
          }
        >
          Enter the dungeon
        </button>
      </div>
    </section>
  )
}

function PartyPanel({
  state,
  onLightTorch,
}: {
  state: DungeonState
  onLightTorch: (memberKey: string) => void
}) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>Party</h2>
        <p className="hint">Right-click a torch in someone&rsquo;s pack to light a new one.</p>
      </div>
      <div className="stack" style={{ gap: 14 }}>
        {state.party.map((member, i) => {
          const owned = ITEMS.filter((item) => (member.inventory[item.id] ?? 0) > 0)
          return (
            <div className="party-member" key={member.key}>
              <div className="party-head">
                <span className="party-avatar" style={{ borderColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                  <Portrait kind="profession" id={member.professionId} size="sm" />
                </span>
                <div>
                  <div className="party-name">
                    {i + 1}. {member.name}
                  </div>
                  <div className="hint">
                    {member.hp}/{member.maxHp} HP
                  </div>
                </div>
              </div>
              <div className="tokens" style={{ marginTop: 0 }}>
                {Object.entries(member.resources).map(([tokenId, count]) => (
                  <span className="chip" key={tokenId} title={TOKENS[tokenId]?.effect}>
                    <span className="count">{count}×</span>
                    {TOKENS[tokenId]?.name ?? tokenId}
                  </span>
                ))}
              </div>
              {owned.length === 0 ? (
                <p className="hint">Empty pack.</p>
              ) : (
                <div className="inventory">
                  {owned.map((item) => {
                    const count = member.inventory[item.id]
                    const isTorch = item.id === 'torch'
                    return (
                      <button
                        key={item.id}
                        className={`inv-slot${isTorch ? ' torch' : ''}`}
                        title={
                          isTorch
                            ? `${item.name} \u00d7${count}. Right-click to light a new torch.`
                            : `${item.name} \u00d7${count}. ${ITEMS_BY_ID[item.id].description}`
                        }
                        aria-label={
                          isTorch
                            ? `${item.name}, ${count} carried. Open the context menu to light a new torch.`
                            : `${item.name}, ${count} carried`
                        }
                        onContextMenu={(e) => {
                          if (!isTorch) return
                          e.preventDefault()
                          onLightTorch(member.key)
                        }}
                      >
                        <Portrait kind="item" id={item.id} size="sm" />
                        <span className="inv-count">{count}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function CompletionCard() {
  return (
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
    </section>
  )
}

/** The tutorial's objectives, ticked off as they happen. */
function GoalCard({ state }: { state: DungeonState }) {
  const { dungeon } = state
  const items = [
    ...dungeon.links.flatMap((l) => {
      const lock = l.lock
      if (!lock) return []
      if (lock.kind === 'door') {
        return [{ label: `Open the ${lock.name.toLowerCase()}`, done: state.unlocked.includes(lock.id) }]
      }
      const met = lock.requires.filter((r) => state.done.includes(r.flag)).length
      return [
        {
          label: `Break the ${lock.name} (${met} of ${lock.requires.length})`,
          done: state.unlocked.includes(lock.id),
        },
      ]
    }),
    { label: `Defeat the guardian in ${roomById(dungeon, dungeon.boss.roomId).name}`, done: state.completed },
  ]
  return (
    <section className="card">
      <div className="card-head">
        <h2>Goal</h2>
        <p className="hint">{TUTORIAL_GOAL}</p>
      </div>
      <ul className="checklist">
        {items.map((item) => (
          <li key={item.label} className={item.done ? 'done' : undefined}>
            <span className="check" aria-hidden="true">
              {item.done ? '\u2713' : ''}
            </span>
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  )
}

interface PendingResolution {
  next: DungeonState
  steps: ResolutionStep[]
}

function Dungeon({ initial, onLeave }: { initial: DungeonState; onLeave: () => void }) {
  const [state, dispatch] = useReducer(dungeonReducer, initial)
  const [plan, setPlan] = useState<InteractionPlan>({})
  const [pending, setPending] = useState<PendingResolution | null>(null)

  const level = torchLevel(state.torch)
  const room = roomById(state.dungeon, state.roomId)
  const passages = passagesOf(state)
  const exits = adjacentRoomIds(state.dungeon, state.roomId, passages).map((id) => roomById(state.dungeon, id))
  const locked = lockedExits(state.dungeon, state.roomId, passages)
  const spareTorches = state.party.reduce((n, m) => n + (m.inventory.torch ?? 0), 0)
  const preparations = state.prepared[state.roomId] ?? []
  const move = (roomId: string) => dispatch({ type: 'moveTo', roomId, rng: Math.random })

  const resolve = () => {
    const { state: next, steps } = resolveInterval(state, plan, Math.random)
    setPending({ next, steps })
  }

  const finishResolution = () => {
    if (pending) dispatch({ type: 'replace', state: pending.next })
    setPending(null)
  }

  return (
    <>
      <section className="card torch-hud">
        <Portrait kind="item" id="torch" size="md" className={`hud-torch ${level}`} />
        <div className="torch-readout">
          <span className="step-index">{state.torch.spec.name}</span>
          <div className="torch-level-row">
            <span className={`torch-level ${level}`}>{TORCH_LEVEL_LABEL[level]}</span>
            <TorchGauge torch={state.torch} />
            <span className="hint">
              {state.torch.remaining} of {totalIntervals(state.torch.spec)} Intervals left
            </span>
          </div>
          {level === 'out' && (
            <p className="blocker-text">
              {spareTorches > 0
                ? 'Right-click a torch in a pack to light it. Tests are harder in the dark.'
                : 'No spare torches left. The party is in the dark.'}
            </p>
          )}
        </div>
        <div className="hud-meta">
          <span className="step-index">Interval</span>
          <b className="interval-count">{state.intervals}</b>
        </div>
        <div className="hud-actions">
          {!state.battle && !state.patrolTriggered && (
            <button className="btn" onClick={() => dispatch({ type: 'startBattle', rng: Math.random })}>
              Start sample battle
            </button>
          )}
          <button className="btn" onClick={onLeave}>
            Leave dungeon
          </button>
        </div>
      </section>

      {state.battle ? (
        <BattleView state={state} dispatch={dispatch} onLeave={onLeave} />
      ) : (
        <>

      <div className="layout" style={{ marginTop: 20 }}>
        <main>
          {state.completed && <CompletionCard />}

          <section className="card map-card">
            <DungeonMap state={state} onMove={move} />
          </section>

          <IntervalPlanner state={state} plan={plan} onChange={setPlan} onResolve={resolve} />

          <section className="card">
            <div className="card-head">
              <span className="step-index">{state.dungeon.name}</span>
              <h2>{room.name}</h2>
              <p className="hint">{room.description}</p>
            </div>
            <p className="trait">
              <b>Tip.</b> {room.lesson}
            </p>
            {preparations.length > 0 && (
              <div className="tokens">
                {preparations.map((p) => (
                  <span className="chip" key={`${p.memberKey}-${p.tag}`}>
                    {p.tag}
                  </span>
                ))}
              </div>
            )}
            {locked.map(({ lock, room: beyond }) => (
              <div className="lock-note" key={lock.id}>
                <p className="trait">
                  <b>{lock.name}.</b> {lock.description}
                </p>
                {lock.kind === 'seal' && (
                  <ul className="notes">
                    {sealStatuses(state)
                      .find((st) => st.lock.id === lock.id)
                      ?.requirements.map((r) => (
                        <li key={r.hint} className={r.met ? 'met' : undefined}>
                          {r.met ? r.done : r.hint}
                        </li>
                      ))}
                  </ul>
                )}
                <span className="hint">Leads to {beyond.name}.</span>
              </div>
            ))}
            <h3 className="section-title">Exits (moving takes an Interval)</h3>
            <div className="exit-buttons">
              {exits.map((exit) => (
                <button key={exit.id} className="btn" onClick={() => move(exit.id)}>
                  {exit.name}
                </button>
              ))}
              {locked.map(({ lock, room: beyond }) => (
                <button key={lock.id} className="btn locked" disabled title={lock.description}>
                  {beyond.name}: {lock.kind === 'seal' ? 'sealed' : 'locked'}
                </button>
              ))}
            </div>
          </section>
        </main>

        <aside className="sidebar">
          <GoalCard state={state} />
          <PartyPanel
            state={state}
            onLightTorch={(memberKey) => dispatch({ type: 'lightTorch', memberKey })}
          />
          <section className="card">
            <div className="card-head">
              <h2>Log</h2>
            </div>
            <ol className="dungeon-log" aria-live="polite">
              {state.log.slice(0, 8).map((line, i) => (
                <li key={`${state.log.length - i}-${line}`}>{line}</li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
        </>
      )}

      {pending && (
        <ResolutionOverlay
          heading={`Interval ${state.intervals + 1}`}
          steps={pending.steps}
          onFinish={finishResolution}
        />
      )}
    </>
  )
}

export function DungeonView({ roster }: { roster: RosterEntry[] }) {
  const [initial, setInitial] = useState<DungeonState | null>(null)
  const [runId, setRunId] = useState(0)

  const start = useMemo(
    () => (chosen: RosterEntry[]) => {
      setInitial(createDungeonState(SUNKEN_CRYPT, chosen.map((e) => createPartyMember(e.key, e.draft))))
      setRunId((n) => n + 1)
    },
    [],
  )

  if (!initial) return <PartySetup roster={roster} onStart={start} />
  return <Dungeon key={runId} initial={initial} onLeave={() => setInitial(null)} />
}
