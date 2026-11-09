import { useMemo, useReducer, useState } from 'react'
import { SUNKEN_CRYPT, trapFlag } from '../data/dungeon'
import { ITEMS, ITEMS_BY_ID } from '../data/items'
import { TUTORIAL_GOAL, TUTORIAL_INTRO, TUTORIAL_OUTRO } from '../data/tutorial'
import { TOKENS } from '../data/tokens'
import { buildCharacter } from '../lib/buildCharacter'
import {
  adjacentRoomIds,
  createDungeonState,
  dungeonReducer,
  limitTorches,
  lockedExits,
  PARTY_TORCH_LIMIT,
  passagesOf,
  roomById,
  sealStatuses,
  type DungeonState,
} from '../lib/dungeonState'
import { resolveInterval, respondToIntervalReaction, type InteractionPlan } from '../lib/intervalActions'
import type { ReactionAnswer } from '../lib/reactionTypes'
import { AVATAR_COLORS } from '../lib/partyColors'
import { createPartyMember } from '../lib/partyMember'
import type { ResolutionStep } from '../lib/resolution'
import type { RosterEntry } from '../lib/roster'
import { torchAdvice, torchOutPopup, torchLevel, TORCH_LEVEL_LABEL, totalIntervals, type TorchState } from '../lib/torch'
import { BagDialog } from './BagDialog'
import { BattleView } from './BattleView'
import { ReactionPrompt } from './ReactionPrompt'
import { RuleHelpDialog } from './RuleHelpDialog'
import { Tip } from './Tip'
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
  const chosenTorches = chosenKeys.reduce((n, key) => {
    const entry = roster.find((r) => r.key === key)
    const owned = entry ? buildCharacter(entry.draft).inventory.find((e) => e.item.id === 'torch')?.count : 0
    return n + (owned ?? 0)
  }, 0)

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

      <p className="hint">
        The party can carry only {PARTY_TORCH_LIMIT} spare torches between them. {chosenTorches > PARTY_TORCH_LIMIT ? `${chosenTorches - PARTY_TORCH_LIMIT} will be left behind.` : `${chosenTorches} chosen so far.`}
      </p>

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
  const [bagOf, setBagOf] = useState<string | null>(null)
  const onShowBag = setBagOf
  const bagOwner = state.party.find((m) => m.key === bagOf)
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
                {Object.entries(member.resources)
                  .filter(([, count]) => count > 0)
                  .map(([tokenId, count]) => (
                    <Tip key={tokenId} content={TOKENS[tokenId]?.effect ?? TOKENS[tokenId]?.name}>
                      <span className="chip">
                        <span className="count">{count}×</span>
                        {TOKENS[tokenId]?.name ?? tokenId}
                      </span>
                    </Tip>
                  ))}
                <button className="link-button" onClick={() => onShowBag(member.key)}>
                  Bag
                </button>
              </div>
              {owned.length === 0 ? (
                <p className="hint">Empty pack.</p>
              ) : (
                <div className="inventory">
                  {owned.map((item) => {
                    const count = member.inventory[item.id]
                    const isTorch = item.id === 'torch'
                    return (
                      <Tip
                        key={item.id}
                        content={
                          <>
                            <b className="tip-name">
                              {item.name} {'\u00d7'}
                              {count}
                            </b>
                            {ITEMS_BY_ID[item.id].description}
                            {isTorch && ' Right-click to light a new torch.'}
                          </>
                        }
                      >
                      <button
                        className={`inv-slot${isTorch ? ' torch' : ''}`}
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
                      </Tip>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {bagOwner && (
        <BagDialog
          name={bagOwner.name}
          bag={bagOwner.bag}
          inPlay={bagOwner.resources}
          sealed={(bagOwner.sealedConditions ?? []).map((c) => c.tokenId)}
          shieldsInPlay={bagOwner.shieldsInPlay}
          onClose={() => setBagOf(null)}
        />
      )}
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

function reactorOf(state: DungeonState, key: string) {
  const index = state.party.findIndex((m) => m.key === key)
  const member = state.party[index]
  return member ? { name: member.name, professionId: member.professionId, colorIndex: index } : undefined
}

interface PendingResolution {
  next: DungeonState
  steps: ResolutionStep[]
}

function Dungeon({ initial, onLeave }: { initial: DungeonState; onLeave: () => void }) {
  const [state, dispatch] = useReducer(dungeonReducer, initial)
  const [plan, setPlan] = useState<InteractionPlan>({})
  const [pending, setPending] = useState<PendingResolution | null>(null)
  const [darkSeen, setDarkSeen] = useState(false)

  const level = torchLevel(state.torch)
  const room = roomById(state.dungeon, state.roomId)
  const passages = passagesOf(state)
  const exits = adjacentRoomIds(state.dungeon, state.roomId, passages).map((id) => roomById(state.dungeon, id))
  const locked = lockedExits(state.dungeon, state.roomId, passages)
  const spareTorches = state.party.reduce((n, m) => n + (m.inventory.torch ?? 0), 0)
  const advice = torchAdvice(level, spareTorches)
  const darkPopup = level === 'out' && !darkSeen && !pending && !state.battle
  const preparations = state.prepared[state.roomId] ?? []
  const move = (roomId: string) => dispatch({ type: 'moveTo', roomId, rng: Math.random })

  const play = (next: DungeonState, steps: ResolutionStep[]) => {
    if (steps.length === 0) dispatch({ type: 'replace', state: next })
    else setPending({ next, steps })
  }

  const resolve = () => {
    const result = resolveInterval(state, plan, Math.random)
    play(result.state, result.steps)
  }

  const answerReaction = (answer: ReactionAnswer) => {
    const result = respondToIntervalReaction(state, answer, Math.random)
    play(result.state, result.steps)
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
          {advice && <p className="blocker-text">{advice}</p>}
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

          {state.pending ? (
            !pending && (
              <ReactionPrompt
                request={state.pending.request}
                reactor={reactorOf(state, state.pending.request.reactorKey)}
                onAnswer={answerReaction}
              />
            )
          ) : (
            <IntervalPlanner state={state} plan={plan} onChange={setPlan} onResolve={resolve} />
          )}

          <section className="card">
            <div className="card-head">
              <span className="step-index">{state.dungeon.name}</span>
              <h2>{room.name}</h2>
              <p className="hint">{room.description}</p>
            </div>
            <p className="trait">
              <b>Tip.</b> {room.lesson}
            </p>
            {room.optional && (
              <div className="tokens">
                <span className="chip">Can be bypassed</span>
              </div>
            )}
            {room.trap &&
              state.done.includes(trapFlag(room.id, 'found')) &&
              !state.done.includes(trapFlag(room.id, 'spent')) && (
                <p className="trait">
                  <b>Trap: {room.trap.name}.</b> {room.trap.hint}
                </p>
              )}
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

      {darkPopup && (
        <RuleHelpDialog
          label="Uh oh..."
          title="The torch has gone out"
          paragraphs={torchOutPopup(spareTorches)}
          onClose={() => setDarkSeen(true)}
        />
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
      setInitial(createDungeonState(SUNKEN_CRYPT, limitTorches(chosen.map((e) => createPartyMember(e.key, e.draft)))))
      setRunId((n) => n + 1)
    },
    [],
  )

  if (!initial) return <PartySetup roster={roster} onStart={start} />
  return <Dungeon key={runId} initial={initial} onLeave={() => setInitial(null)} />
}
