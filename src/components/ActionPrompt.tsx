import { useState } from 'react'
import {
  ACTIONS_PER_TURN,
  availableCombatActions,
  describeGroup,
  suggestedAction,
  type BattlePlayer,
  type BattleState,
  type CombatOption,
  type PlannedCombat,
} from '../lib/battle'
import { AVATAR_COLORS } from '../lib/partyColors'
import { Portrait } from './Portrait'

const BASIC = ['attack', 'defend', 'engage']

interface Props {
  battle: BattleState
  player: BattlePlayer
  onAct: (planned: PlannedCombat | null) => void
  onEndTurn: () => void
}

/** Asks one question at a time: what should this character do with their next action? */
export function ActionPrompt({ battle, player, onAct, onEndTurn }: Props) {
  const options = availableCombatActions(battle, player)
  const [choice, setChoice] = useState<PlannedCombat>(() => suggestedAction(battle, player))

  const selected = options.find((o) => o.id === choice.actionId)
  const targetId = selected?.targets?.find((t) => t.id === choice.targetId)?.id ?? selected?.targets?.[0]?.id
  const canConfirm = Boolean(selected) && !selected?.disabledReason

  const pick = (option: CombatOption) =>
    setChoice({ actionId: option.id, targetId: option.targets?.[0]?.id })

  const groups: { title: string; options: CombatOption[] }[] = [
    { title: 'Actions', options: options.filter((o) => o.slot === 'action' && BASIC.includes(o.id)) },
    {
      title: 'Class abilities',
      options: options.filter((o) => o.slot === 'action' && !BASIC.includes(o.id)),
    },
    { title: 'Free (Fast): does not use an action', options: options.filter((o) => o.slot === 'fast') },
  ].filter((g) => g.options.length > 0)

  const group = describeGroup(battle, battle.groups[player.key])

  return (
    <section className="card">
      <div className="card-head">
        <span className="step-index">Round {battle.round}</span>
        <div className="resolution-actor">
          <span className="party-avatar" style={{ borderColor: AVATAR_COLORS[player.colorIndex % AVATAR_COLORS.length] }}>
            <Portrait kind="profession" id={player.professionId} size="md" />
          </span>
          <div>
            <h2>
              {player.name}&rsquo;s action {Math.min(battle.actionsUsed + 1, ACTIONS_PER_TURN)} of {ACTIONS_PER_TURN}:
              what should they do?
            </h2>
            <p className="hint">
              {player.hp}/{player.maxHp} HP · Defense {player.defense} · In: {group}
            </p>
          </div>
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.title} className="prompt-group">
          <h3 className="section-title" style={{ marginTop: 14 }}>
            {g.title}
          </h3>
          <div className="options two">
            {g.options.map((o) => (
              <button
                key={o.id}
                className="option"
                aria-pressed={choice.actionId === o.id}
                disabled={Boolean(o.disabledReason)}
                onClick={() => pick(o)}
              >
                <span className="name">
                  {o.label}
                  {o.slot === 'fast' && <span className="tag">Free</span>}
                  {o.disabledReason && <span className="tag warn">{o.disabledReason}</span>}
                </span>
                <span className="desc">{o.description}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {selected?.targets && selected.targets.length > 0 && (
        <label className="prompt-target">
          <span className="step-index">Target</span>
          <select
            value={targetId}
            onChange={(e) => setChoice({ actionId: selected.id, targetId: e.target.value })}
          >
            {selected.targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="review-actions prompt-actions">
        <button className="btn" onClick={onEndTurn}>
          End turn
        </button>
        <button className="btn" onClick={() => onAct(null)}>
          Skip this action
        </button>
        <button
          className="btn primary"
          disabled={!canConfirm}
          onClick={() => onAct({ actionId: choice.actionId, targetId })}
        >
          {selected?.slot === 'fast' ? 'Use it (free)' : 'Do it'}
        </button>
      </div>
    </section>
  )
}
