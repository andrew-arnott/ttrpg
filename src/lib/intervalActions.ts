import { linkKey, type DungeonRoom, type RoomReward } from '../data/dungeon'
import { HOLY_TORCH, ITEMS_BY_ID } from '../data/items'
import { PROFESSIONS } from '../data/professions'
import { TOKENS } from '../data/tokens'
import { SPECIAL_LABELS, type Ability, type SpecialKey } from '../data/types'
import type { Rng } from './drawTest'
import {
  adjacentRoomIds,
  burnTorchInterval,
  lightFreshTorch,
  patrolIsDue,
  REST_BONUS_LIMIT,
  revealVisible,
  roomById,
  springPatrol,
  withLog,
  type DungeonState,
  type PartyMember,
} from './dungeonState'
import { playerActor, type ResolutionStep, type StepTone } from './resolution'
import { performSkillTest, type SkillTestOutcome } from './skillTest'
import { totalIntervals, torchLevel } from './torch'

export type ActionId = 'search' | 'rest' | 'watch' | 'interact' | `ability:${string}`

export type ActionGroup = 'Basic' | 'Room' | 'Class'

export interface ActionOption {
  id: ActionId
  group: ActionGroup
  label: string
  description: string
  /** Rooms the action can be pointed at, for actions that need a target. */
  targets?: DungeonRoom[]
  disabledReason?: string
}

export interface PlannedAction {
  actionId: ActionId
  targetRoomId?: string
}

export type InteractionPlan = Record<string, PlannedAction>

export const DARKNESS_PENALTY = 3
export const DEFAULT_ACTION: PlannedAction = { actionId: 'watch' }

const TARGETED_ABILITIES = new Set(['scoutAhead', 'scry', 'barricade'])

const withArticle = (word: string) => `${/^[AEIOU]/i.test(word) ? 'an' : 'a'} ${word}`

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

export function memberAbilities(member: PartyMember): Ability[] {
  const profession = PROFESSIONS.find((p) => p.id === member.professionId)
  if (!profession) return []
  return [...profession.abilities, ...profession.explorationAbilities].filter(
    (a) => a.types.includes('Interval') && member.abilityIds.includes(a.id),
  )
}

function resourceName(member: PartyMember): string {
  return TOKENS[member.restResourceId]?.name ?? 'resource'
}

function restCap(member: PartyMember): number {
  return (member.startingResources[member.restResourceId] ?? 0) + REST_BONUS_LIMIT
}

export function availableActions(state: DungeonState, member: PartyMember): ActionOption[] {
  const room = roomById(state.dungeon, state.roomId)
  const exits = adjacentRoomIds(state.dungeon, state.roomId, state.discovered).map((id) =>
    roomById(state.dungeon, id),
  )

  const options: ActionOption[] = [
    {
      id: 'search',
      group: 'Basic',
      label: 'Search the room',
      description: 'Make a Perception test to look for anything hidden here.',
      disabledReason: state.done.includes(`secret:${room.id}`) ? 'Nothing more to find here' : undefined,
    },
    {
      id: 'rest',
      group: 'Basic',
      label: 'Rest',
      description: `Catch your breath and regain 1 ${resourceName(member)}.`,
      disabledReason:
        (member.resources[member.restResourceId] ?? 0) >= restCap(member) ? 'Already fully rested' : undefined,
    },
    {
      id: 'watch',
      group: 'Basic',
      label: 'Keep watch',
      description: 'Stay alert for approaching threats.',
    },
    {
      id: 'interact',
      group: 'Room',
      label: `Room interaction: ${lowerFirst(room.interaction.label)}`,
      description: `Make ${withArticle(SPECIAL_LABELS[room.interaction.attribute])} test.`,
      disabledReason: state.done.includes(`interaction:${room.id}`) ? 'Already done' : undefined,
    },
  ]

  for (const ability of memberAbilities(member)) {
    const targeted = TARGETED_ABILITIES.has(ability.id)
    options.push({
      id: `ability:${ability.id}`,
      group: 'Class',
      label: ability.name,
      description: ability.text,
      targets: targeted ? exits : undefined,
      disabledReason:
        ability.id === 'holyLight' && (member.inventory.torch ?? 0) <= 0
          ? 'No spare torch to consume'
          : targeted && exits.length === 0
            ? 'Nowhere to point it'
            : undefined,
    })
  }
  return options
}

function updateMember(state: DungeonState, key: string, change: (m: PartyMember) => PartyMember): DungeonState {
  return { ...state, party: state.party.map((m) => (m.key === key ? change(m) : m)) }
}

function giveReward(state: DungeonState, memberKey: string, reward: RoomReward | undefined) {
  if (!reward) return { state, text: '' }
  const item = ITEMS_BY_ID[reward.itemId]
  const next = updateMember(state, memberKey, (m) => ({
    ...m,
    inventory: { ...m.inventory, [reward.itemId]: (m.inventory[reward.itemId] ?? 0) + reward.count },
  }))
  return { state: next, text: ` ${reward.count}\u00d7 ${item?.name ?? reward.itemId} added to their pack.` }
}

function addPrepared(state: DungeonState, roomId: string, tag: string, memberKey: string): DungeonState {
  const existing = state.prepared[roomId] ?? []
  if (existing.some((p) => p.tag === tag && p.memberKey === memberKey)) return state
  return { ...state, prepared: { ...state.prepared, [roomId]: [...existing, { tag, memberKey }] } }
}

const markDone = (state: DungeonState, flag: string): DungeonState =>
  state.done.includes(flag) ? state : { ...state, done: [...state.done, flag] }

interface Resolution {
  state: DungeonState
  step: ResolutionStep
}

interface Context {
  state: DungeonState
  member: PartyMember
  room: DungeonRoom
  planned: PlannedAction
  rng: Rng
  penalty: number
}

function narrate(
  ctx: Context,
  title: string,
  intro: string,
  outcome: string,
  tone: StepTone,
  state: DungeonState = ctx.state,
  test?: SkillTestOutcome,
): Resolution {
  const complication = test?.result.complication
    ? ' A Complication was drawn, so the GM may add a consequence.'
    : ''
  const colorIndex = ctx.state.party.findIndex((m) => m.key === ctx.member.key)
  return {
    state,
    step: {
      actor: playerActor(ctx.member, colorIndex),
      title,
      intro,
      test,
      testMode: test ? 'check' : undefined,
      outcome: outcome + complication,
      tone,
    },
  }
}

function runTest(ctx: Context, attribute: SpecialKey, difficulty: number): SkillTestOutcome {
  return performSkillTest(ctx.member.bag, attribute, ctx.member.special[attribute], difficulty, ctx.rng, ctx.penalty)
}

const withDarkness = (ctx: Context, intro: string) =>
  ctx.penalty > 0 ? `${intro} It is too dark to see well.` : intro

function search(ctx: Context): Resolution {
  const { member, room, state } = ctx
  const intro = withDarkness(ctx, `${member.name} searches ${room.name}.`)
  const test = runTest(ctx, 'perception', room.secret.difficulty)
  if (!test.passed) {
    return narrate(ctx, 'Search the room', intro, `${member.name} turns up nothing this time.`, 'failure', state, test)
  }
  const reward = giveReward(markDone(state, `secret:${room.id}`), member.key, room.secret.reward)
  return narrate(
    ctx,
    'Search the room',
    intro,
    `${member.name} finds ${room.secret.text}!${reward.text}`,
    'success',
    reward.state,
    test,
  )
}

function rest(ctx: Context): Resolution {
  const { member } = ctx
  const id = member.restResourceId
  const next = (member.resources[id] ?? 0) + 1
  const state = updateMember(ctx.state, member.key, (m) => ({ ...m, resources: { ...m.resources, [id]: next } }))
  return narrate(
    ctx,
    'Rest',
    `${member.name} sits down and catches their breath.`,
    `${member.name} regains 1 ${resourceName(member)} (now ${next}).`,
    'success',
    state,
  )
}

function keepWatch(ctx: Context, title = 'Keep watch'): Resolution {
  return narrate(
    ctx,
    title,
    `${ctx.member.name} keeps watch over ${ctx.room.name}.`,
    'Nothing approaches. For now, the dark is quiet.',
    'neutral',
  )
}

function interact(ctx: Context): Resolution {
  const { member, room, state } = ctx
  const { interaction } = room
  const intro = withDarkness(ctx, `${member.name} tries to ${lowerFirst(interaction.label)}.`)
  const test = runTest(ctx, interaction.attribute, interaction.difficulty)
  if (!test.passed) {
    return narrate(ctx, 'Room interaction', intro, interaction.failure, 'failure', state, test)
  }
  const reward = giveReward(markDone(state, `interaction:${room.id}`), member.key, interaction.reward)
  return narrate(ctx, 'Room interaction', intro, interaction.success + reward.text, 'success', reward.state, test)
}

function targetRoom(ctx: Context): DungeonRoom | undefined {
  const exits = adjacentRoomIds(ctx.state.dungeon, ctx.state.roomId, ctx.state.discovered)
  const id = ctx.planned.targetRoomId && exits.includes(ctx.planned.targetRoomId) ? ctx.planned.targetRoomId : exits[0]
  return id ? roomById(ctx.state.dungeon, id) : undefined
}

function observeAdjacent(ctx: Context, ability: Ability, verb: string): Resolution {
  const target = targetRoom(ctx)
  if (!target) return keepWatch(ctx, ability.name)
  const explored = ctx.state.explored.includes(target.id)
    ? ctx.state.explored
    : [...ctx.state.explored, target.id]
  return narrate(
    ctx,
    ability.name,
    `${ctx.member.name} ${verb} ${target.name} without entering.`,
    target.description,
    'success',
    { ...ctx.state, explored },
  )
}

function findShortcut(ctx: Context, ability: Ability): Resolution {
  const { state, member, room } = ctx
  const hidden = state.dungeon.links.find(
    (l) => l.hidden && (l.from === room.id || l.to === room.id) && !state.discovered.includes(linkKey(l)),
  )
  const intro = `${member.name} searches for another way through.`
  if (!hidden?.hidden) {
    return narrate(ctx, ability.name, intro, 'There is no hidden route near here.', 'neutral')
  }
  const next = revealVisible({ ...state, discovered: [...state.discovered, linkKey(hidden)] })
  return narrate(ctx, ability.name, intro, `${member.name} discovers ${hidden.hidden.discovery}!`, 'success', next)
}

function holyLight(ctx: Context, ability: Ability): Resolution {
  const { member, state } = ctx
  const withoutTorch = updateMember(state, member.key, (m) => ({
    ...m,
    inventory: { ...m.inventory, torch: Math.max(0, (m.inventory.torch ?? 0) - 1) },
  }))
  const lit = lightFreshTorch(withoutTorch, true)
  return narrate(
    ctx,
    ability.name,
    `${member.name} calls on divine light and lights a torch.`,
    `The holy torch burns for ${totalIntervals(HOLY_TORCH)} Intervals (Bright ${HOLY_TORCH.bright}, Steady ${HOLY_TORCH.steady}, Dim ${HOLY_TORCH.dim}), replacing the torch that was burning.`,
    'success',
    lit,
  )
}

function groupHeal(ctx: Context, ability: Ability): Resolution {
  const { member, state } = ctx
  const hurt = state.party.filter((m) => m.hp < m.maxHp)
  const healed: DungeonState = {
    ...state,
    party: state.party.map((m) => (m.hp < m.maxHp ? { ...m, hp: m.hp + 1 } : m)),
  }
  return narrate(
    ctx,
    ability.name,
    `${member.name} calls down a soothing light on the whole party.`,
    hurt.length === 0
      ? 'No one is hurt, so the light fades harmlessly.'
      : `${hurt.map((m) => m.name).join(', ')} recover${hurt.length === 1 ? 's' : ''} 1 HP.`,
    hurt.length === 0 ? 'neutral' : 'success',
    healed,
  )
}

function dispelMagic(ctx: Context, ability: Ability): Resolution {
  const { member, room, state } = ctx
  const intro = withDarkness(ctx, `${member.name} tries to unravel any magic in ${room.name}.`)
  const flag = `dispelled:${room.id}`
  if (!room.magic || state.done.includes(flag)) {
    return narrate(ctx, ability.name, intro, 'There is no magic here to dispel.', 'neutral')
  }
  const test = runTest(ctx, 'intelligence', room.magic.dispelDifficulty)
  if (!test.passed) {
    return narrate(ctx, ability.name, intro, 'The magic resists, and holds firm.', 'failure', state, test)
  }
  return narrate(ctx, ability.name, intro, room.magic.dispelled, 'success', markDone(state, flag), test)
}

function performAbility(ctx: Context, ability: Ability): Resolution {
  const { member, room, state } = ctx
  const prepare = (tag: string, outcome: string) =>
    narrate(ctx, ability.name, `${member.name} prepares ${room.name}.`, outcome, 'success', addPrepared(state, room.id, tag, member.key))

  switch (ability.id) {
    case 'fortify':
      return prepare('Fortified', 'If combat begins here before the party leaves, the party begins with +2 Defend.')
    case 'secureArea':
      return prepare('Secured', 'The party can rest here without being surprised through the entrances secured.')
    case 'setAnAmbush':
      return prepare('Ambush set', 'If enemies enter before the party leaves, a free attack is ready for the first one.')
    case 'barricade': {
      const target = targetRoom(ctx)
      if (!target) return keepWatch(ctx, ability.name)
      return narrate(
        ctx,
        ability.name,
        `${member.name} reinforces the passage to ${target.name}.`,
        'Creatures forcing their way through must succeed on a Strength test.',
        'success',
        addPrepared(state, room.id, `Barricaded toward ${target.name}`, member.key),
      )
    }
    case 'standWatch':
      return keepWatch(ctx, ability.name)
    case 'scoutAhead':
      return observeAdjacent(ctx, ability, 'carefully scouts')
    case 'scry':
      return observeAdjacent(ctx, ability, 'magically observes')
    case 'caseTheJoint':
      return narrate(ctx, ability.name, `${member.name} studies ${room.name}.`, room.intel, 'success')
    case 'findAShortcut':
      return findShortcut(ctx, ability)
    case 'holyLight':
      return holyLight(ctx, ability)
    case 'groupHeal':
      return groupHeal(ctx, ability)
    case 'tendTheAfflicted':
      return narrate(
        ctx,
        ability.name,
        `${member.name} looks the party over for lingering afflictions.`,
        'No one is suffering a condition that needs treating.',
        'neutral',
      )
    case 'detectMagic':
      return narrate(
        ctx,
        ability.name,
        `${member.name} reaches out with their senses.`,
        room.magic?.detect ?? 'There is no magic here.',
        room.magic ? 'success' : 'neutral',
      )
    case 'identify':
      return narrate(
        ctx,
        ability.name,
        `${member.name} examines ${room.name} for anything magical.`,
        room.magic?.identify ?? 'There is nothing magical here to identify.',
        room.magic ? 'success' : 'neutral',
      )
    case 'dispelMagic':
      return dispelMagic(ctx, ability)
    default:
      return narrate(ctx, ability.name, `${member.name} uses ${ability.name}.`, ability.text, 'success')
  }
}

function resolveAction(ctx: Context): Resolution {
  switch (ctx.planned.actionId) {
    case 'search':
      return search(ctx)
    case 'rest':
      return rest(ctx)
    case 'interact':
      return interact(ctx)
    case 'watch':
      return keepWatch(ctx)
    default: {
      const abilityId = ctx.planned.actionId.slice('ability:'.length)
      const ability = memberAbilities(ctx.member).find((a) => a.id === abilityId)
      return ability ? performAbility(ctx, ability) : keepWatch(ctx)
    }
  }
}

/**
 * Plays out one Interval: each character acts in party order on the state left
 * by the one before, then the torch burns down a step. Anything a character
 * cannot actually do (a stale plan, a missing torch) becomes Keep watch.
 */
export function resolveInterval(
  state: DungeonState,
  plan: InteractionPlan,
  rng: Rng,
): { state: DungeonState; steps: ResolutionStep[] } {
  let working = state
  const steps: ResolutionStep[] = []
  const penalty = torchLevel(state.torch) === 'out' ? DARKNESS_PENALTY : 0

  for (const original of state.party) {
    const member = working.party.find((m) => m.key === original.key) ?? original
    const planned = plan[member.key] ?? DEFAULT_ACTION
    const option = availableActions(working, member).find((o) => o.id === planned.actionId)
    const usable = option && !option.disabledReason ? planned : DEFAULT_ACTION
    const { state: next, step } = resolveAction({
      state: working,
      member,
      room: roomById(working.dungeon, working.roomId),
      planned: usable,
      rng,
      penalty,
    })
    steps.push(step)
    working = withLog(next, `${step.intro} ${step.outcome}`)
  }

  const burned = burnTorchInterval(working)
  const { patrol } = burned.state.dungeon
  const watching = state.party.some((m) => {
    const choice = plan[m.key]?.actionId
    return choice === 'watch' || choice === 'ability:standWatch'
  })
  const warned =
    watching &&
    !burned.state.patrolTriggered &&
    burned.state.intervals === patrol.arrivesAtInterval - 1
  steps.push({
    actor: null,
    title: 'The Interval ends',
    intro: 'Time passes in the dark halls.',
    outcome: warned ? `${burned.message} ${patrol.warning}` : burned.message,
    tone: warned ? 'failure' : 'neutral',
  })
  let finished = withLog(burned.state, burned.message)
  if (patrolIsDue(finished)) {
    finished = springPatrol(finished, rng)
    steps.push({
      actor: null,
      title: 'Interrupted!',
      intro: patrol.arrival,
      outcome: 'Combat begins.',
      tone: 'failure',
    })
  }
  return { state: finished, steps }
}
