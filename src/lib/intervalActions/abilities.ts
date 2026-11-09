import { linkKey, type DungeonRoom } from '../../data/dungeon'
import { HOLY_TORCH, ITEMS, ITEMS_BY_ID } from '../../data/items'
import { PROFESSIONS } from '../../data/professions'
import { TOKENS } from '../../data/tokens'
import type { Ability } from '../../data/types'
import {
  adjacentRoomIds,
  lightFreshTorch,
  passagesOf,
  revealVisible,
  roomById,
  type DungeonState,
  type PartyMember,
} from '../dungeonState'
import { countInBag } from '../tokenFlow'
import { totalIntervals } from '../torch'
import { addPrepared, defuseTrap, giveReward, keepWatch, markDone, narrate, runTest, updateMember, withArticle, withDarkness } from './context'
import type { ActionHandler, Context, Resolution } from './context'
import { removeConditionToken } from './conditionTreatment'
import type { ActionOption } from './types'

/** What an Interval ability needs beyond its text: where it can be aimed, when it cannot be used, what it does. */
interface AbilityAction {
  /** Aimed at an adjacent room chosen when planning. */
  targeted?: boolean
  unavailable?(state: DungeonState, member: PartyMember): string | undefined
  /** Replaces the single menu entry, for abilities that need a further choice. */
  options?(state: DungeonState, member: PartyMember, ability: Ability): ActionOption[]
  perform(ctx: Context, ability: Ability, extra: string[]): Resolution
}

export function memberAbilities(member: PartyMember): Ability[] {
  const profession = PROFESSIONS.find((p) => p.id === member.professionId)
  if (!profession) return []
  return [...profession.abilities, ...profession.explorationAbilities].filter(
    (a) => a.types.includes('Interval') && member.abilityIds.includes(a.id),
  )
}

function targetRoom(ctx: Context): DungeonRoom | undefined {
  const exits = adjacentRoomIds(ctx.state.dungeon, ctx.state.roomId, passagesOf(ctx.state))
  const id = ctx.planned.targetRoomId && exits.includes(ctx.planned.targetRoomId) ? ctx.planned.targetRoomId : exits[0]
  return id ? roomById(ctx.state.dungeon, id) : undefined
}

function prepare(tag: string, outcome: string): AbilityAction {
  return {
    perform: (ctx, ability) =>
      narrate(
        ctx,
        ability.name,
        `${ctx.member.name} prepares ${ctx.room.name}.`,
        outcome,
        'success',
        addPrepared(ctx.state, ctx.room.id, tag, ctx.member.key),
      ),
  }
}

function observeAdjacent(verb: string): AbilityAction {
  return {
    targeted: true,
    perform: (ctx, ability) => {
      const target = targetRoom(ctx)
      if (!target) return keepWatch(ctx, ability.name)
      const explored = ctx.state.explored.includes(target.id) ? ctx.state.explored : [...ctx.state.explored, target.id]
      return narrate(
        ctx,
        ability.name,
        `${ctx.member.name} ${verb} ${target.name} without entering.`,
        target.description,
        'success',
        { ...ctx.state, explored },
      )
    },
  }
}

const describeRoom = (intro: (ctx: Context) => string, text: (room: DungeonRoom) => string | undefined, fallback?: string): AbilityAction => ({
  perform: (ctx, ability) => {
    const found = text(ctx.room)
    return narrate(ctx, ability.name, intro(ctx), found ?? fallback ?? '', found || !fallback ? 'success' : 'neutral')
  },
})

const findShortcut: AbilityAction = {
  perform: (ctx, ability) => {
    const { state, member, room } = ctx
    const hidden = state.dungeon.links.find(
      (l) => l.hidden && (l.from === room.id || l.to === room.id) && !state.discovered.includes(linkKey(l)),
    )
    const intro = `${member.name} searches for another way through.`
    if (!hidden?.hidden) return narrate(ctx, ability.name, intro, 'There is no hidden route near here.', 'neutral')
    const next = revealVisible({ ...state, discovered: [...state.discovered, linkKey(hidden)] })
    return narrate(ctx, ability.name, intro, `${member.name} discovers ${hidden.hidden.discovery}!`, 'success', next)
  },
}

const holyLight: AbilityAction = {
  unavailable: (_state, member) => ((member.inventory.torch ?? 0) <= 0 ? 'No spare torch to consume' : undefined),
  perform: (ctx, ability) => {
    const { member, state } = ctx
    const withoutTorch = updateMember(state, member.key, (m) => ({
      ...m,
      inventory: { ...m.inventory, torch: Math.max(0, (m.inventory.torch ?? 0) - 1) },
    }))
    return narrate(
      ctx,
      ability.name,
      `${member.name} calls on divine light and lights a torch.`,
      `The holy torch burns for ${totalIntervals(HOLY_TORCH)} Intervals (Bright ${HOLY_TORCH.bright}, Steady ${HOLY_TORCH.steady}, Dim ${HOLY_TORCH.dim}), replacing the torch that was burning.`,
      'success',
      lightFreshTorch(withoutTorch, true),
    )
  },
}

const groupHeal: AbilityAction = {
  perform: (ctx, ability) => {
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
  },
}

const dispelMagic: AbilityAction = {
  perform: (ctx, ability) => {
    const { member, room, state } = ctx
    const intro = withDarkness(ctx, `${member.name} tries to unravel any magic in ${room.name}.`)
    const flag = `dispelled:${room.id}`
    if (!room.magic || state.done.includes(flag)) {
      return narrate(ctx, ability.name, intro, 'There is no magic here to dispel.', 'neutral')
    }
    const test = runTest(ctx, 'intelligence', room.magic.dispelDifficulty)
    if (!test.passed) return narrate(ctx, ability.name, intro, 'The magic resists, and holds firm.', 'failure', ctx.state, test)
    const dispelled = applyDispel(ctx, room, markDone(ctx.state, flag))
    return narrate(ctx, ability.name, intro, `${room.magic.dispelled}${dispelled.text}`, 'success', dispelled.state, test)
  },
}

/** What unravelling a room's magic does besides the story: always something that helps. */
function applyDispel(ctx: Context, room: DungeonRoom, state: DungeonState): { state: DungeonState; text: string } {
  const effect = room.magic?.effect
  if (effect?.kind === 'disarmTrap' && room.trap) return { state: defuseTrap(state, room), text: ` The ${room.trap.name.toLowerCase()} is disarmed.` }
  if (effect?.kind === 'revealSecret' && !state.done.includes(`secret:${room.id}`)) {
    const reward = giveReward(markDone(state, `secret:${room.id}`), ctx.member.key, room.secret.reward)
    return { state: reward.state, text: ` ${ctx.member.name} finds ${room.secret.text}!${reward.text}` }
  }
  if (effect?.kind === 'weakenBoss') return { state, text: ' The guardian here will no longer be able to heal itself.' }
  return { state, text: '' }
}

/** Tend the Afflicted: treat a condition with the matching item, and the patient needs no test. */
const tendTheAfflicted: AbilityAction = {
  options: (state, member, ability) =>
    ITEMS.flatMap((item) => {
      const treats = item.treats
      if (!treats || (member.inventory[item.id] ?? 0) <= 0) return []
      const condition = TOKENS[treats.condition]?.name ?? treats.condition
      return state.party
        .filter((patient) => countInBag(patient.bag, treats.condition) > 0)
        .map(
          (patient): ActionOption => ({
            id: `ability:${ability.id}:${item.id}:${patient.key}`,
            group: 'Class',
            label: `${ability.name}: ${patient.key === member.key ? 'your' : `${patient.name}'s`} ${condition}`,
            description: `Use ${withArticle(item.name.toLowerCase())} to remove the ${condition} token from the patient's bag. No test is needed.`,
          }),
        )
    }),
  perform: (ctx, ability, [itemId, patientKey]) => {
    const { member, state } = ctx
    const item = ITEMS_BY_ID[itemId]
    const patient = state.party.find((m) => m.key === patientKey)
    const treats = item?.treats
    if (!treats || !patient || (member.inventory[itemId] ?? 0) <= 0 || countInBag(patient.bag, treats.condition) <= 0) {
      return keepWatch(ctx, ability.name)
    }
    const spent = updateMember(state, member.key, (m) => ({
      ...m,
      inventory: { ...m.inventory, [itemId]: (m.inventory[itemId] ?? 0) - 1 },
    }))
    const condition = TOKENS[treats.condition]?.name ?? treats.condition
    return narrate(
      ctx,
      ability.name,
      `${member.name} tends to ${patient.key === member.key ? 'their own' : `${patient.name}'s`} affliction.`,
      `The ${condition} token is removed from ${patient.name}'s bag.`,
      'success',
      removeConditionToken(spent, patient.key, treats.condition),
    )
  },
}

const ABILITY_ACTIONS: Record<string, AbilityAction> = {
  fortify: prepare('Fortified', 'If combat begins here before the party leaves, the party begins with +2 Defend.'),
  secureArea: prepare('Secured', 'The party can rest here without being surprised through the entrances secured.'),
  setAnAmbush: prepare('Ambush set', 'If enemies enter before the party leaves, a free attack is ready for the first one.'),
  barricade: {
    targeted: true,
    perform: (ctx, ability) => {
      const target = targetRoom(ctx)
      if (!target) return keepWatch(ctx, ability.name)
      return narrate(
        ctx,
        ability.name,
        `${ctx.member.name} reinforces the passage to ${target.name}.`,
        'Creatures forcing their way through must succeed on a Strength test.',
        'success',
        addPrepared(ctx.state, ctx.room.id, `Barricaded toward ${target.name}`, ctx.member.key),
      )
    },
  },
  standWatch: { perform: (ctx, ability) => keepWatch(ctx, ability.name) },
  scoutAhead: observeAdjacent('carefully scouts'),
  scry: observeAdjacent('magically observes'),
  caseTheJoint: describeRoom((ctx) => `${ctx.member.name} studies ${ctx.room.name}.`, (room) => room.intel),
  findAShortcut: findShortcut,
  holyLight,
  groupHeal,
  tendTheAfflicted,
  detectMagic: describeRoom(
    (ctx) => `${ctx.member.name} reaches out with their senses.`,
    (room) => room.magic?.detect,
    'There is no magic here.',
  ),
  identify: describeRoom(
    (ctx) => `${ctx.member.name} examines ${ctx.room.name} for anything magical.`,
    (room) => room.magic?.identify,
    'There is nothing magical here to identify.',
  ),
  dispelMagic,
}

const fallbackAbility: AbilityAction = {
  perform: (ctx, ability) =>
    narrate(ctx, ability.name, `${ctx.member.name} uses ${ability.name}.`, ability.text, 'success'),
}

export const abilityHandler: ActionHandler = {
  options: (state, member) => {
    const room = roomById(state.dungeon, state.roomId)
    const exits = adjacentRoomIds(state.dungeon, room.id, passagesOf(state)).map((id) => roomById(state.dungeon, id))
    return memberAbilities(member).flatMap((ability): ActionOption[] => {
      const action = ABILITY_ACTIONS[ability.id]
      if (action?.options) return action.options(state, member, ability)
      const targeted = Boolean(action?.targeted)
      return [
        {
          id: `ability:${ability.id}`,
          group: 'Class',
          label: ability.name,
          description: ability.text,
          targets: targeted ? exits : undefined,
          disabledReason:
            action?.unavailable?.(state, member) ?? (targeted && exits.length === 0 ? 'Nowhere to point it' : undefined),
        },
      ]
    })
  },
  perform: (ctx, [abilityId, ...extra]) => {
    const ability = memberAbilities(ctx.member).find((a) => a.id === abilityId)
    return ability ? (ABILITY_ACTIONS[ability.id] ?? fallbackAbility).perform(ctx, ability, extra) : keepWatch(ctx)
  },
}
