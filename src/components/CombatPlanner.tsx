import {
  ACTIONS_PER_TURN,
  availableCombatActions,
  defaultTurn,
  type BattlePlan,
  type BattlePlayer,
  type BattleState,
  type CombatOption,
  type PlannedCombat,
  type TurnPlan,
} from '../lib/battle'
import { AVATAR_COLORS } from '../lib/partyColors'
import { Portrait } from './Portrait'

const NOTHING = ''

function SlotPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: CombatOption[]
  value: PlannedCombat | null
  onChange: (next: PlannedCombat | null) => void
}) {
  const selected = options.find((o) => o.id === value?.actionId)
  const basic = options.filter((o) => ['attack', 'defend', 'engage'].includes(o.id))
  const classes = options.filter((o) => o.id.startsWith('ability:'))
  const targetId = selected?.targets?.find((t) => t.id === value?.targetId)?.id ?? selected?.targets?.[0]?.id

  const choose = (id: string) => {
    if (id === NOTHING) return onChange(null)
    const option = options.find((o) => o.id === id)
    onChange({ actionId: id, targetId: option?.targets?.[0]?.id })
  }

  const render = (o: CombatOption) => (
    <option key={o.id} value={o.id} disabled={Boolean(o.disabledReason)}>
      {o.label}
      {o.disabledReason ? ` (${o.disabledReason})` : ''}
    </option>
  )

  return (
    <div className="slot">
      <span className="step-index">{label}</span>
      <select aria-label={label} value={value?.actionId ?? NOTHING} onChange={(e) => choose(e.target.value)}>
        <option value={NOTHING}>Nothing</option>
        {basic.length > 0 && <optgroup label="Basic">{basic.map(render)}</optgroup>}
        {classes.length > 0 && <optgroup label="Class abilities">{classes.map(render)}</optgroup>}
      </select>
      {selected?.targets && selected.targets.length > 0 && (
        <select
          aria-label={`${label} target`}
          value={targetId}
          onChange={(e) => onChange({ actionId: selected.id, targetId: e.target.value })}
        >
          {selected.targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      )}
      {selected && <p className="hint plan-desc">{selected.description}</p>}
    </div>
  )
}

function PlayerRow({
  battle,
  player,
  turn,
  onChange,
}: {
  battle: BattleState
  player: BattlePlayer
  turn: TurnPlan
  onChange: (next: TurnPlan) => void
}) {
  const options = availableCombatActions(battle, player)
  const actionOptions = options.filter((o) => o.slot === 'action')
  const fastOptions = options.filter((o) => o.slot === 'fast')

  return (
    <div className="plan-row battle-row">
      <div className="plan-who">
        <span className="party-avatar" style={{ borderColor: AVATAR_COLORS[player.colorIndex % AVATAR_COLORS.length] }}>
          <Portrait kind="profession" id={player.professionId} size="sm" />
        </span>
        <span className="party-name">{player.name}</span>
      </div>
      <div className="slots">
        {Array.from({ length: ACTIONS_PER_TURN }, (_, i) => (
          <SlotPicker
            key={i}
            label={`${player.name}: action ${i + 1}`}
            options={actionOptions}
            value={turn.actions[i]}
            onChange={(next) => {
              const actions: TurnPlan['actions'] = [...turn.actions]
              actions[i] = next
              onChange({ ...turn, actions })
            }}
          />
        ))}
        {fastOptions.length > 0 && (
          <SlotPicker
            label={`${player.name}: free (Fast)`}
            options={fastOptions}
            value={turn.fast}
            onChange={(next) => onChange({ ...turn, fast: next })}
          />
        )}
      </div>
    </div>
  )
}

interface Props {
  battle: BattleState
  plan: BattlePlan
  onChange: (plan: BattlePlan) => void
  onResolve: () => void
}

export function CombatPlanner({ battle, plan, onChange, onResolve }: Props) {
  return (
    <section className="card">
      <div className="card-head">
        <span className="step-index">Round {battle.round}</span>
        <h2>What does everyone want to do?</h2>
        <p className="hint">
          Each character has {ACTIONS_PER_TURN} actions, plus any Fast abilities for free. Defend adds to your
          Defense score for the round, and enemy attacks wear that score down.
        </p>
      </div>

      <div className="plan-list">
        {battle.players.map((p) =>
          p.hp > 0 ? (
            <PlayerRow
              key={p.key}
              battle={battle}
              player={p}
              turn={plan[p.key] ?? defaultTurn(battle, p)}
              onChange={(next) => onChange({ ...plan, [p.key]: next })}
            />
          ) : (
            <div className="plan-row" key={p.key}>
              <div className="plan-who">
                <span className="party-name">{p.name}</span>
              </div>
              <span className="hint">Down, and out of the fight.</span>
            </div>
          ),
        )}
      </div>

      <div className="review-actions">
        <button className="btn primary" onClick={onResolve}>
          Resolve round
        </button>
      </div>
    </section>
  )
}
