import { interactionFlag, trapFlag, type DungeonRoom } from '../../data/dungeon'
import { ITEMS, ITEMS_BY_ID } from '../../data/items'
import { TOKENS } from '../../data/tokens'
import { SPECIAL_LABELS } from '../../data/types'
import {
  breakReadySeals,
  lockedExits,
  passagesOf,
  roomById,
  unlockLock,
  type DungeonState,
  type PartyMember,
} from '../dungeonState'
import { drewComplication } from '../drawTest'
import { adjustBag, canRest, countInBag, recoverForRest, type TokenHolder } from '../tokenFlow'
import {
  armedTrap,
  defuseTrap,
  giveReward,
  keepWatch,
  lowerFirst,
  markDone,
  narrate,
  resourceName,
  runTest,
  runTestFor,
  springTrap,
  trapFound,
  updateMember,
  withArticle,
  withDarkness,
  type ActionHandler,
  type Context,
  type Resolution,
} from './context'
import { removeConditionToken } from './conditionTreatment'
import { TREAT_DIFFICULTY, type ActionOption } from './types'

/** What Investigate could still turn up in a room: its secret and any trap nobody has noticed. */
function pendingFinds(state: DungeonState, room: DungeonRoom) {
  const finds: { kind: 'secret' | 'trap'; difficulty: number }[] = []
  if (!state.done.includes(`secret:${room.id}`)) finds.push({ kind: 'secret', difficulty: room.secret.difficulty })
  if (armedTrap(state, room) && !trapFound(state, room)) finds.push({ kind: 'trap', difficulty: room.trap!.findDifficulty })
  return finds
}

const investigate: ActionHandler = {
  options: (state) => {
    const room = roomById(state.dungeon, state.roomId)
    return [
      {
        id: 'investigate',
        group: 'Basic',
        label: 'Investigate the room',
        description:
          'Make a Perception test. Whatever is hidden here at or below your result turns up: secrets, treasure, clues and traps.',
        disabledReason: pendingFinds(state, room).length === 0 ? 'Nothing more to find here' : undefined,
      },
    ]
  },
  perform: (ctx) => {
    const { member, room } = ctx
    const finds = pendingFinds(ctx.state, room)
    if (finds.length === 0) return keepWatch(ctx)
    const intro = withDarkness(ctx, `${member.name} investigates ${room.name}.`)
    const test = runTest(ctx, 'perception', Math.min(...finds.map((f) => f.difficulty)))
    const outcome = test.result.outcome
    const reaches = (difficulty: number) =>
      outcome === 'critical-success' || (outcome !== 'critical-failure' && test.total >= difficulty)
    const found = finds.filter((f) => reaches(f.difficulty)).map((f) => f.kind)
    if (found.length === 0) {
      return narrate(ctx, 'Investigate', intro, `${member.name} turns up nothing this time.`, 'failure', ctx.state, test)
    }
    let state = ctx.state
    const lines: string[] = []
    if (found.includes('secret')) {
      const reward = giveReward(markDone(state, `secret:${room.id}`), member.key, room.secret.reward)
      state = reward.state
      lines.push(`${member.name} finds ${room.secret.text}!${reward.text}`)
    }
    if (found.includes('trap')) {
      state = markDone(state, trapFlag(room.id, 'found'))
      lines.push(`${member.name} notices a trap: ${room.trap!.hint}`)
    }
    return narrate(ctx, 'Investigate', intro, lines.join(' '), 'success', state, test)
  },
}

const disarm: ActionHandler = {
  options: (state) => {
    const room = roomById(state.dungeon, state.roomId)
    const trap = armedTrap(state, room)
    if (!trap || !trapFound(state, room)) return []
    return [
      {
        id: 'disarm:trap',
        group: 'Room',
        label: `Room interaction: ${lowerFirst(trap.disarm.label)} (${trap.name})`,
        description: `Make ${withArticle(SPECIAL_LABELS[trap.disarm.attribute])} test. If it fails, the trap goes off.`,
      },
    ]
  },
  perform: (ctx) => {
    const { member, room } = ctx
    const trap = armedTrap(ctx.state, room)
    if (!trap || !trapFound(ctx.state, room)) return keepWatch(ctx)
    const intro = withDarkness(ctx, `${member.name} sets about the ${trap.name.toLowerCase()}.`)
    const test = runTest(ctx, trap.disarm.attribute, trap.disarm.difficulty)
    if (test.passed) {
      return narrate(ctx, 'Disarm', intro, trap.disarm.success, 'success', defuseTrap(ctx.state, room), test)
    }
    const sprung = springTrap(ctx, trap)
    return narrate(ctx, 'Disarm', intro, `${trap.disarm.failure} ${sprung}`, 'failure', ctx.state, test)
  },
}

const rest: ActionHandler = {
  options: (_state, member) => [
    {
      id: 'rest',
      group: 'Basic',
      label: 'Rest',
      description: `Catch your breath and regain 1 ${resourceName(member)}.`,
      disabledReason: canRest(member, member.restResourceId)
        ? undefined
        : `No ${resourceName(member)} in your bag to recover`,
    },
  ],
  perform: (ctx) => {
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
  },
}

const watch: ActionHandler = {
  options: () => [
    {
      id: 'watch',
      group: 'Basic',
      label: 'Keep watch',
      description: 'Stay alert for approaching threats. Makes it harder for enemies to surprise the party.',
    },
  ],
  perform: (ctx) => keepWatch(ctx),
}

const heal: ActionHandler = {
  options: (state, member) =>
    ITEMS.filter((item) => item.healing && (member.inventory[item.id] ?? 0) > 0).map(
      (item): ActionOption => ({
        id: `use:${item.id}`,
        group: 'Basic',
        label: `Use a ${item.name}`,
        description: `Restore ${item.healing} HP to the most wounded party member. The ${item.name.toLowerCase()} is used up.`,
        disabledReason: state.party.some((m) => m.hp < m.maxHp) ? undefined : 'Nobody is hurt',
      }),
    ),
  perform: (ctx, [itemId]) => {
    const { member, state } = ctx
    const item = ITEMS_BY_ID[itemId]
    const hurt = [...state.party].sort((a, b) => b.maxHp - b.hp - (a.maxHp - a.hp))[0]
    if (!item?.healing || !hurt || hurt.hp >= hurt.maxHp || (member.inventory[itemId] ?? 0) <= 0) {
      return keepWatch(ctx)
    }
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
  },
}

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

const treat: ActionHandler = {
  options: treatmentOptions,
  perform: (ctx, [itemId, patientKey]) => {
    const { member, state } = ctx
    const item = ITEMS_BY_ID[itemId]
    const patient = state.party.find((m) => m.key === patientKey)
    const treats = item?.treats
    if (!treats || !patient || (member.inventory[itemId] ?? 0) <= 0 || countInBag(patient.bag, treats.condition) <= 0) {
      return keepWatch(ctx)
    }
    const [first, second] = treats.attributes
    const attribute = second && patient.special[second] > patient.special[first] ? second : first
    const test = runTestFor(ctx, patient, attribute, TREAT_DIFFICULTY)
    const condition = TOKENS[treats.condition]?.name ?? treats.condition
    const spent = updateMember(ctx.state, member.key, (m) => ({
      ...m,
      inventory: { ...m.inventory, [itemId]: (m.inventory[itemId] ?? 0) - 1 },
    }))
    const next = test.passed ? removeConditionToken(spent, patient.key, treats.condition) : spent
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
  },
}

const interact: ActionHandler = {
  options: (state) => {
    const room = roomById(state.dungeon, state.roomId)
    return room.interactions.map(
      (i): ActionOption => ({
        id: `interact:${i.id}`,
        group: 'Room',
        label: `Room interaction: ${lowerFirst(i.label)}`,
        description: `Make ${withArticle(SPECIAL_LABELS[i.attribute])} test.`,
        disabledReason: state.done.includes(interactionFlag(room.id, i.id)) ? 'Already done' : undefined,
      }),
    )
  },
  perform: (ctx, [interactionId]) => {
    const { member, room } = ctx
    const interaction = room.interactions.find((i) => i.id === interactionId)
    if (!interaction) return keepWatch(ctx)
    const trap = armedTrap(ctx.state, room)
    const sprung = trap ? springTrap(ctx, trap) : ''
    const intro = withDarkness(
      ctx,
      `${member.name} tries to ${lowerFirst(interaction.label)}.${sprung ? ` ${sprung}` : ''}`,
    )
    const test = runTest(ctx, interaction.attribute, interaction.difficulty)
    if (!test.passed) {
      return narrate(ctx, 'Room interaction', intro, interaction.failure, 'failure', ctx.state, test)
    }
    const reward = giveReward(
      markDone(ctx.state, interactionFlag(room.id, interaction.id)),
      member.key,
      interaction.reward,
    )
    const seals = breakReadySeals(reward.state)
    const outcome = [interaction.success + reward.text, ...seals.messages].join(' ')
    return narrate(ctx, 'Room interaction', intro, outcome, 'success', seals.state, test)
  },
}

const unlock: ActionHandler = {
  options: (state) => {
    const room = roomById(state.dungeon, state.roomId)
    return lockedExits(state.dungeon, room.id, passagesOf(state)).flatMap(({ lock, room: beyond }) =>
      lock.kind === 'door'
        ? lock.options.map(
            (o): ActionOption => ({
              id: `unlock:${lock.id}:${o.id}`,
              group: 'Room',
              label: `Room interaction: ${lowerFirst(o.label)} (${lock.name})`,
              description: `Make ${withArticle(SPECIAL_LABELS[o.attribute])} test to get through to ${beyond.name}. If it fails you can try again, but every try takes an Interval.`,
            }),
          )
        : [],
    )
  },
  perform: (ctx, [lockId, optionId]): Resolution => unlockDoor(ctx, lockId, optionId),
}

function unlockDoor(ctx: Context, lockId: string, optionId: string): Resolution {
  const { member, state } = ctx
  const exit = lockedExits(state.dungeon, state.roomId, passagesOf(state)).find((e) => e.lock.id === lockId)
  const option = exit?.lock.kind === 'door' ? exit.lock.options.find((o) => o.id === optionId) : undefined
  if (!exit || exit.lock.kind !== 'door' || !option) return keepWatch(ctx)

  const title = `${option.label}`
  const intro = withDarkness(
    ctx,
    `${member.name} tries to ${lowerFirst(option.label)} on the ${exit.lock.name.toLowerCase()}.`,
  )
  const test = runTest(ctx, option.attribute, option.difficulty)
  if (!test.passed) {
    const price = option.complication
    if (price && drewComplication(test.result)) {
      const hurt = updateMember(ctx.state, member.key, (m) => ({ ...m, bag: adjustBag(m.bag, price.condition, 1) }))
      const name = TOKENS[price.condition]?.name ?? price.condition
      return narrate(
        ctx,
        title,
        intro,
        `${option.failure} ${price.text} ${member.name} gains a ${name} token in their bag.`,
        'failure',
        hurt,
        test,
      )
    }
    return narrate(ctx, title, intro, option.failure, 'failure', ctx.state, test)
  }

  const first = ctx.state.patrolStartedAt === null
  const opened = unlockLock(ctx.state, exit.lock.id)
  const stir = first ? ' Somewhere deeper in the complex, something starts to stir.' : ''
  return narrate(ctx, title, intro, option.success + stir, 'success', opened, test)
}

export const BASIC_HANDLERS: Record<string, ActionHandler> = {
  investigate,
  rest,
  watch,
  use: heal,
  treat,
  interact,
  disarm,
  unlock,
}
