import { useState } from 'react'
import {
  actionsThisTurn,
  availableCombatActions,
  describeGroup,
  engageBreakdown,
  engageDifficulty,
  needsEngageTest,
  suggestedAction,
  type BattlePlayer,
  type BattleState,
  type CombatOption,
  type PlannedCombat,
} from '../lib/battle'
import { AVATAR_COLORS } from '../lib/partyColors'
import { RULES_LINKS } from '../data/rulesLinks'
import { RulesLink } from './RulesLink'
import { ENGAGE_HELP } from '../data/tutorial'
import { TOKENS } from '../data/tokens'
import { CharacterPortrait } from './CharacterPortrait'
import { RuleHelpDialog } from './RuleHelpDialog'

const firstUsable = (option: CombatOption | undefined) => option?.targets?.find((t) => !t.disabledReason)?.id

const BASIC = ['attack', 'defend', 'engage']

interface Props {
  battle: BattleState
  player: BattlePlayer
  onAct: (planned: PlannedCombat | null) => void
  onEndTurn: () => void
  /** Whether the Engage explanation has already been shown in this battle. */
  engageHelpSeen: boolean
  onEngageHelpSeen: () => void
}

/** Asks one question at a time: what should this character do with their next action? */
export function ActionPrompt({ battle, player, onAct, onEndTurn, engageHelpSeen, onEngageHelpSeen }: Props) {
  const options = availableCombatActions(battle, player)
  const actionLimit = actionsThisTurn(player, battle.round)
  const [choice, setChoice] = useState<PlannedCombat>(() => suggestedAction(battle, player))
  const [helpOpen, setHelpOpen] = useState(false)

  const selected = options.find((o) => o.id === choice.actionId)
  const targetId =
    selected?.targets?.find((t) => t.id === choice.targetId && !t.disabledReason)?.id ?? firstUsable(selected)
  const canConfirm = Boolean(selected) && !selected?.disabledReason

  const boost = Math.min(choice.boost ?? 0, selected?.boost?.max ?? 0)

  const pick = (option: CombatOption) => {
    setChoice({ actionId: option.id, targetId: firstUsable(option) })
    if (option.id === 'engage' && !engageHelpSeen) setHelpOpen(true)
  }

  const closeHelp = () => {
    setHelpOpen(false)
    onEngageHelpSeen()
  }
  const engagePreview =
    selected?.id === 'engage' && targetId && needsEngageTest(battle, player)
      ? engageBreakdown(engageDifficulty(battle, player, targetId))
      : null
  const freeMove = selected?.id === 'engage' && !needsEngageTest(battle, player)

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
            <CharacterPortrait professionId={player.professionId} portrait={player.portrait} size="md" />
          </span>
          <div>
            <h2>
              {player.name}&rsquo;s action {Math.min(battle.actionsUsed + 1, actionLimit)} of {actionLimit}:
              what should they do?
            </h2>
            <p className="hint">
              {player.hp}/{player.maxHp} HP · Defense {player.defense} · In: {group}
            </p>
            <p className="hint">
              Rules: <RulesLink slug={RULES_LINKS.combat}>Combat</RulesLink> ·{' '}
              <RulesLink slug={RULES_LINKS.abilityTypes}>Ability types</RulesLink>
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
            onChange={(e) => setChoice({ actionId: selected.id, targetId: e.target.value, boost })}
          >
            {selected.targets.map((t) => (
              <option key={t.id} value={t.id} disabled={Boolean(t.disabledReason)}>
                {t.label}
                {t.disabledReason ? ` (${t.disabledReason})` : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      {selected?.boost && (
        <label className="prompt-target">
          <span className="step-index">
            Spend {TOKENS[selected.boost.tokenId].name} (+1 each, committed before you draw)
          </span>
          <select
            value={boost}
            onChange={(e) => setChoice({ actionId: selected.id, targetId, boost: Number(e.target.value) })}
          >
            {Array.from({ length: selected.boost.max + 1 }, (_, n) => (
              <option key={n} value={n}>
                {n === 0 ? 'None' : `${n} ${TOKENS[selected.boost!.tokenId].name}`}
              </option>
            ))}
          </select>
        </label>
      )}

      {freeMove && (
        <p className="hint prompt-rule">
          You are not engaged with anyone, so no test is needed.{' '}
          <button className="link-button" onClick={() => setHelpOpen(true)}>
            How does this work?
          </button>
        </p>
      )}

      {engagePreview && (
        <p className="hint prompt-rule">
          Difficulty: {engagePreview.join(', ')}.{' '}
          <button className="link-button" onClick={() => setHelpOpen(true)}>
            How does this work?
          </button>
        </p>
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
          onClick={() => onAct({ actionId: choice.actionId, targetId, boost: boost || undefined })}
        >
          {selected?.slot === 'fast' ? 'Use it (free)' : 'Do it'}
        </button>
      </div>
      {helpOpen && <RuleHelpDialog
          title={ENGAGE_HELP.title}
          paragraphs={ENGAGE_HELP.paragraphs}
          rulesSlug={RULES_LINKS.engagement}
          onClose={closeHelp}
        />}
    </section>
  )
}
