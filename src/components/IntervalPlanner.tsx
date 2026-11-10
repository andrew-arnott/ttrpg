import type { DungeonState, PartyMember } from '../lib/dungeonState'
import {
  availableActions,
  DEFAULT_ACTION,
  type ActionGroup,
  type ActionOption,
  type InteractionPlan,
  type PlannedAction,
} from '../lib/intervalActions'
import { AVATAR_COLORS } from '../lib/partyColors'
import { CharacterPortrait } from './CharacterPortrait'

const GROUP_ORDER: ActionGroup[] = ['Basic', 'Room', 'Class']

/** What will actually happen for a member: their choice if it is still possible, otherwise Keep watch. */
function effectiveChoice(options: ActionOption[], planned: PlannedAction | undefined): {
  option: ActionOption
  planned: PlannedAction
} {
  const wanted = options.find((o) => o.id === planned?.actionId && !o.disabledReason)
  if (wanted && planned) return { option: wanted, planned }
  const fallback = options.find((o) => o.id === DEFAULT_ACTION.actionId) ?? options[0]
  return { option: fallback, planned: DEFAULT_ACTION }
}

function MemberRow({
  state,
  member,
  index,
  planned,
  onChange,
}: {
  state: DungeonState
  member: PartyMember
  index: number
  planned: PlannedAction | undefined
  onChange: (next: PlannedAction) => void
}) {
  const options = availableActions(state, member)
  const choice = effectiveChoice(options, planned)
  const targets = choice.option.targets
  const targetId = targets?.find((t) => t.id === choice.planned.targetRoomId)?.id ?? targets?.[0]?.id

  return (
    <div className="plan-row">
      <div className="plan-who">
        <span className="party-avatar" style={{ borderColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }}>
          <CharacterPortrait professionId={member.professionId} portrait={member.portrait} size="sm" />
        </span>
        <span className="party-name">
          {index + 1}. {member.name}
        </span>
      </div>

      <div className="plan-choice">
        <label className="sr-only" htmlFor={`action-${member.key}`}>
          Action for {member.name}
        </label>
        <select
          id={`action-${member.key}`}
          value={choice.option.id}
          onChange={(e) => onChange({ actionId: e.target.value as ActionOption['id'] })}
        >
          {GROUP_ORDER.map((group) => {
            const inGroup = options.filter((o) => o.group === group)
            if (inGroup.length === 0) return null
            return (
              <optgroup key={group} label={group === 'Class' ? 'Class abilities' : group}>
                {inGroup.map((o) => (
                  <option key={o.id} value={o.id} disabled={Boolean(o.disabledReason)}>
                    {o.label}
                    {o.disabledReason ? ` (${o.disabledReason})` : ''}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>

        {targets && targets.length > 0 && (
          <select
            aria-label={`Target for ${member.name}`}
            value={targetId}
            onChange={(e) => onChange({ actionId: choice.option.id, targetRoomId: e.target.value })}
          >
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <p className="hint plan-desc">{choice.option.description}</p>
      </div>
    </div>
  )
}

interface Props {
  state: DungeonState
  plan: InteractionPlan
  onChange: (plan: InteractionPlan) => void
  onResolve: () => void
}

export function IntervalPlanner({ state, plan, onChange, onResolve }: Props) {
  return (
    <section className="card">
      <div className="card-head">
        <span className="step-index">Interval {state.intervals + 1}</span>
        <h2>What does everyone want to do?</h2>
        <p className="hint">
          Each character picks an action. They resolve in order, and then the torch burns down. Moving to
          another room also takes an Interval.
        </p>
      </div>

      <div className="plan-list">
        {state.party.map((member, i) => (
          <MemberRow
            key={member.key}
            state={state}
            member={member}
            index={i}
            planned={plan[member.key]}
            onChange={(next) => onChange({ ...plan, [member.key]: next })}
          />
        ))}
      </div>

      <div className="review-actions">
        <button className="btn primary" onClick={onResolve}>
          Resolve Interval
        </button>
      </div>
    </section>
  )
}
