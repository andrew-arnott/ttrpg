import {
  interactionFlag,
  linkKey,
  type DungeonRoom,
  type RoomComplication,
  type RoomReward,
} from '../data/dungeon'
import { HOLY_TORCH, ITEMS, ITEMS_BY_ID } from '../data/items'
import { PROFESSIONS } from '../data/professions'
import { TOKENS } from '../data/tokens'
import { SPECIAL_LABELS, type Ability, type SpecialKey } from '../data/types'
import { drewComplication, type Rng } from './drawTest'
import {
  adjacentRoomIds,
  breakReadySeals,
  burnTorchInterval,
  lightFreshTorch,
  KEEP_WATCH,
  lockedExits,
  passagesOf,
  patrolCountdown,
  patrolIsDue,
  revealVisible,
  roomById,
  springPatrol,
  STAND_WATCH,
  withLog,
  type DungeonState,
  type PartyMember,
  unlockLock,
  type Watchfulness,
} from './dungeonState'
import { playerActor, type ResolutionStep, type StepTone } from './resolution'
import { performSkillTest, type SkillTestOutcome } from './skillTest'
import { adjustBag, canRest, countInBag, recoverForRest, type TokenHolder } from './tokenFlow'
import { burnInterval, TORCH_LEVEL_LABEL, totalIntervals, torchLevel } from './torch'

export type ActionId =
  | 'search'
  | 'rest'
  | 'watch'
  | `use:${string}`
  | `treat:${string}`
  | `interact:${string}`
  | `unlock:${string}`
  | `ability:${string}`

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

export const TREAT_DIFFICULTY = 6

function treatmentOptions(state: DungeonState, member: PartyMember): ActionOption[] {
  return ITEMS.flatMap((item) => {
    const treats = item.treats
    if (!treats || (member.inventory[item.id] ?? 0) <= 0) return []
    const condition = TOKENS[treats.condition]?.name ?? treats.condition
    return state.party
      .filter((patient) => countInBag(patient.bag, treats.condition) > 0)
      .map(
        (patient): ActionOption => ({
          id: `treat:${item.id}:${patient.key}`,
          group: 'Basic',
          label: `Treat ${patient.key === member.key ? 'your' : `${patient.name}'s`} ${condition} with ${withArticle(item.name.toLowerCase())}`,
          description: `The patient makes a test (Difficulty ${TREAT_DIFFICULTY}). On success the ${condition} token is removed from their bag for good. The ${item.name.toLowerCase()} is used up either way.`,
        }),
      )
  })
}

export function availableActions(state: DungeonState, member: PartyMember): ActionOption[] {
  const room = roomById(state.dungeon, state.roomId)
  const passages = passagesOf(state)
  const exits = adjacentRoomIds(state.dungeon, state.roomId, passages).map((id) => roomById(state.dungeon, id))

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
        canRest(member, member.restResourceId) ? undefined : `No ${resourceName(member)} in your bag to recover`,
    },
    {
      id: 'watch',
      group: 'Basic',
      label: 'Keep watch',
      description: 'Stay alert for approaching threats. Makes it harder for enemies to surprise the party.',
    },
    ...ITEMS.filter((item) => item.healing && (member.inventory[item.id] ?? 0) > 0).map(
      (item): ActionOption => ({
        id: `use:${item.id}`,
        group: 'Basic',
        label: `Use a ${item.name}`,
        description: `Restore ${item.healing} HP to the most wounded party member. The ${item.name.toLowerCase()} is used up.`,
        disabledReason: state.party.some((m) => m.hp < m.maxHp) ? undefined : 'Nobody is hurt',
      }),
    ),
    ...treatmentOptions(state, member),
    ...room.interactions.map(
      (i): ActionOption => ({
        id: `interact:${i.id}`,
        group: 'Room',
        label: `Room interaction: ${lowerFirst(i.label)}`,
        description: `Make ${withArticle(SPECIAL_LABELS[i.attribute])} test.`,
        disabledReason: state.done.includes(interactionFlag(room.id, i.id)) ? 'Already done' : undefined,
      }),
    ),
    ...lockedExits(state.dungeon, room.id, passages).flatMap(({ lock, room: beyond }) =>
      lock.kind === 'door'
        ? lock.options.map(
            (o): ActionOption => ({
              id: `unlock:${lock.id}:${o.id}`,
              group: 'Room',
              label: `${o.label} (${lock.name})`,
              description: `Make ${withArticle(SPECIAL_LABELS[o.attribute])} test to get through to ${beyond.name}. If it fails you can try again, but every try takes an Interval.`,
            }),
          )
        : [],
    ),
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
  const complication =
    test && drewComplication(test.result) && !ctx.room.complication
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
  const rested: TokenHolder = { bag: member.bag, resources: member.resources }
  const recovered = recoverForRest(rested, member.restResourceId)
  const state = updateMember(ctx.state, member.key, (m) => ({ ...m, ...rested }))
  const name = recovered ? (TOKENS[recovered]?.name ?? recovered) : resourceName(member)
  return narrate(
    ctx,
    'Rest',
    `${member.name} sits down and catches their breath.`,
    recovered
      ? `${member.name} recovers 1 ${name} into play (${rested.resources[recovered]} now).`
      : `${member.name} has nothing left to recover.`,
    recovered ? 'success' : 'neutral',
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

function healWithItem(ctx: Context, itemId: string): Resolution {
  const { member, state } = ctx
  const item = ITEMS_BY_ID[itemId]
  const hurt = [...state.party].sort((a, b) => b.maxHp - b.hp - (a.maxHp - a.hp))[0]
  if (!item?.healing || !hurt || hurt.hp >= hurt.maxHp || (member.inventory[itemId] ?? 0) <= 0) return keepWatch(ctx)

  const healed = Math.min(item.healing, hurt.maxHp - hurt.hp)
  const spent = updateMember(state, member.key, (m) => ({
    ...m,
    inventory: { ...m.inventory, [itemId]: (m.inventory[itemId] ?? 0) - 1 },
  }))
  const next = updateMember(spent, hurt.key, (m) => ({ ...m, hp: m.hp + healed }))
  const who = hurt.key === member.key ? 'themselves' : hurt.name
  return narrate(
    ctx,
    `Use a ${item.name}`,
    `${member.name} treats ${who} with a ${item.name.toLowerCase()}.`,
    `${hurt.name} recovers ${healed} HP (${hurt.hp + healed}/${hurt.maxHp}).`,
    'success',
    next,
  )
}

function treatCondition(ctx: Context, itemId: string, patientKey: string): Resolution {
  const { member, state } = ctx
  const item = ITEMS_BY_ID[itemId]
  const patient = state.party.find((m) => m.key === patientKey)
  const treats = item?.treats
  if (!treats || !patient || (member.inventory[itemId] ?? 0) <= 0 || countInBag(patient.bag, treats.condition) <= 0) {
    return keepWatch(ctx)
  }
  const [first, second] = treats.attributes
  const attribute =
    second && patient.special[second] > patient.special[first] ? second : first
  const test = performSkillTest(
    patient.bag,
    attribute,
    patient.special[attribute],
    TREAT_DIFFICULTY,
    ctx.rng,
    ctx.penalty,
  )
  const condition = TOKENS[treats.condition]?.name ?? treats.condition
  const spent = updateMember(state, member.key, (m) => ({
    ...m,
    inventory: { ...m.inventory, [itemId]: (m.inventory[itemId] ?? 0) - 1 },
  }))
  const next = test.passed
    ? updateMember(spent, patient.key, (m) => ({ ...m, bag: adjustBag(m.bag, treats.condition, -1) }))
    : spent
  const who = patient.key === member.key ? 'themselves' : patient.name
  return narrate(
    ctx,
    'Treat a condition',
    `${member.name} treats ${who} with ${withArticle(item.name.toLowerCase())}.`,
    test.passed
      ? `The ${condition} token is removed from ${patient.name}'s bag.`
      : `The treatment does not take. The ${condition} token stays, and the ${item.name.toLowerCase()} is used up.`,
    test.passed ? 'success' : 'failure',
    next,
    test,
  )
}

function interact(ctx: Context, interactionId: string): Resolution {
  const { member, room, state } = ctx
  const interaction = room.interactions.find((i) => i.id === interactionId)
  if (!interaction) return keepWatch(ctx)
  const intro = withDarkness(ctx, `${member.name} tries to ${lowerFirst(interaction.label)}.`)
  const test = runTest(ctx, interaction.attribute, interaction.difficulty)
  if (!test.passed) {
    return narrate(ctx, 'Room interaction', intro, interaction.failure, 'failure', state, test)
  }
  const reward = giveReward(
    markDone(state, interactionFlag(room.id, interaction.id)),
    member.key,
    interaction.reward,
  )
  const seals = breakReadySeals(reward.state)
  const outcome = [interaction.success + reward.text, ...seals.messages].join(' ')
  return narrate(ctx, 'Room interaction', intro, outcome, 'success', seals.state, test)
}

function unlockDoor(ctx: Context, lockId: string, optionId: string): Resolution {
  const { member, state } = ctx
  const exit = lockedExits(state.dungeon, state.roomId, passagesOf(state)).find((e) => e.lock.id === lockId)
  const option = exit?.lock.kind === 'door' ? exit.lock.options.find((o) => o.id === optionId) : undefined
  if (!exit || exit.lock.kind !== 'door' || !option) return keepWatch(ctx)

  const title = `${option.label}`
  const intro = withDarkness(ctx, `${member.name} tries to ${lowerFirst(option.label)} on the ${exit.lock.name.toLowerCase()}.`)
  const test = runTest(ctx, option.attribute, option.difficulty)
  if (!test.passed) return narrate(ctx, title, intro, option.failure, 'failure', state, test)

  const first = state.patrolStartedAt === null
  const opened = unlockLock(state, exit.lock.id)
  const stir = first ? ' Somewhere deeper in the complex, something starts to stir.' : ''
  return narrate(ctx, title, intro, option.success + stir, 'success', opened, test)
}

function targetRoom(ctx: Context): DungeonRoom | undefined {
  const exits = adjacentRoomIds(ctx.state.dungeon, ctx.state.roomId, passagesOf(ctx.state))
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
  const id = ctx.planned.actionId
  if (id === 'search') return search(ctx)
  if (id === 'rest') return rest(ctx)
  if (id === 'watch') return keepWatch(ctx)
  if (id.startsWith('use:')) return healWithItem(ctx, id.slice('use:'.length))
  if (id.startsWith('treat:')) {
    const [, itemId, patientKey] = id.split(':')
    return treatCondition(ctx, itemId, patientKey)
  }
  if (id.startsWith('interact:')) return interact(ctx, id.slice('interact:'.length))
  if (id.startsWith('unlock:')) {
    const [, lockId, optionId] = id.split(':')
    return unlockDoor(ctx, lockId, optionId)
  }
  const ability = memberAbilities(ctx.member).find((a) => `ability:${a.id}` === id)
  return ability ? performAbility(ctx, ability) : keepWatch(ctx)
}

/** What a Complication does in a room, applied to the character who drew it. */
function applyComplication(
  state: DungeonState,
  member: PartyMember,
  trigger: RoomComplication,
  colorIndex: number,
): Resolution {
  const { effect } = trigger
  let next = state
  let outcome = ''
  let tone: StepTone = 'failure'

  switch (effect.kind) {
    case 'damage': {
      next = updateMember(state, member.key, (m) => ({ ...m, hp: Math.max(1, m.hp - effect.amount) }))
      const hurt = next.party.find((m) => m.key === member.key)!
      outcome = `${member.name} takes ${effect.amount} damage (${hurt.hp}/${hurt.maxHp} HP).`
      break
    }
    case 'torch': {
      const torch = burnInterval(state.torch)
      next = revealVisible({ ...state, torch })
      const level = torchLevel(torch)
      outcome =
        level === 'out'
          ? 'The torch burns down an extra step and goes out.'
          : `The torch burns down an extra step and is now ${TORCH_LEVEL_LABEL[level]}.`
      break
    }
    case 'noise': {
      if (state.patrolStartedAt !== null && !state.patrolTriggered) {
        next = { ...state, patrolStartedAt: state.patrolStartedAt - 1 }
        outcome = 'The noise carries through the halls. The patrol will arrive an Interval sooner.'
      } else {
        outcome = 'The noise echoes through the empty halls. For now, nothing answers.'
        tone = 'neutral'
      }
      break
    }
    case 'drop': {
      const item = ITEMS_BY_ID[effect.itemId]
      if ((member.inventory[effect.itemId] ?? 0) > 0) {
        next = updateMember(state, member.key, (m) => ({
          ...m,
          inventory: { ...m.inventory, [effect.itemId]: (m.inventory[effect.itemId] ?? 0) - 1 },
        }))
        outcome = `${member.name} loses a ${item?.name.toLowerCase() ?? effect.itemId}.`
      } else {
        outcome = `Something nearly slips away, but ${member.name} has nothing of that kind to lose.`
        tone = 'neutral'
      }
      break
    }
  }

  return {
    state: next,
    step: { actor: playerActor(member, colorIndex), title: 'Complication!', intro: trigger.text, outcome, tone },
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
  let watch: Watchfulness | null = null

  for (const original of state.party) {
    const member = working.party.find((m) => m.key === original.key) ?? original
    const planned = plan[member.key] ?? DEFAULT_ACTION
    const option = availableActions(working, member).find((o) => o.id === planned.actionId)
    const usable = option && !option.disabledReason ? planned : DEFAULT_ACTION
    if (usable.actionId === 'ability:standWatch') watch = STAND_WATCH
    else if (usable.actionId === 'watch' && !watch) watch = KEEP_WATCH
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

    const trigger = roomById(working.dungeon, working.roomId).complication
    if (trigger && step.test && drewComplication(step.test.result)) {
      const colorIndex = working.party.findIndex((m) => m.key === member.key)
      const consequence = applyComplication(working, member, trigger, colorIndex)
      steps.push(consequence.step)
      working = withLog(consequence.state, `${consequence.step.intro} ${consequence.step.outcome}`)
    }
  }

  const burned = burnTorchInterval(working)
  const { patrol } = burned.state.dungeon
  const warned = Boolean(watch) && patrolCountdown(burned.state) === 1
  steps.push({
    actor: null,
    title: 'The Interval ends',
    intro: 'Time passes in the dark halls.',
    outcome: warned ? `${burned.message} ${patrol.warning}` : burned.message,
    tone: warned ? 'failure' : 'neutral',
  })
  let finished = withLog({ ...burned.state, watch }, burned.message)
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
