import { interactionFlag, trapFlag, type DungeonRoom, type RoomReward, type RoomTrap } from '../../data/dungeon'
import { ITEMS_BY_ID } from '../../data/items'
import { TOKENS } from '../../data/tokens'
import type { SpecialKey } from '../../data/types'
import { settleTest, takeDamage, testBonuses } from '../characterTest'
import { drawRulesFor } from '../conditionRules'
import { drewComplication, type Rng } from '../drawTest'
import type { DungeonState, PartyMember } from '../dungeonState'
import { offerAllyHelp, offerHealer } from '../priestRules'
import type { Ask } from '../replay'
import { adjustBag } from '../tokenFlow'
import { playerActor, type ResolutionStep, type StepTone } from '../resolution'
import { performSkillTest, type SkillTestOutcome } from '../skillTest'
import type { TorchLevel } from '../torch'
import type { ActionOption, PlannedAction } from './types'

export const withArticle = (word: string) => `${/^[AEIOU]/i.test(word) ? 'an' : 'a'} ${word}`

export const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

export function resourceName(member: PartyMember): string {
  return TOKENS[member.restResourceId]?.name ?? 'resource'
}

export function updateMember(state: DungeonState, key: string, change: (m: PartyMember) => PartyMember): DungeonState {
  return { ...state, party: state.party.map((m) => (m.key === key ? change(m) : m)) }
}

export function giveReward(state: DungeonState, memberKey: string, reward: RoomReward | undefined) {
  if (!reward) return { state, text: '' }
  const item = ITEMS_BY_ID[reward.itemId]
  const next = updateMember(state, memberKey, (m) => ({
    ...m,
    inventory: { ...m.inventory, [reward.itemId]: (m.inventory[reward.itemId] ?? 0) + reward.count },
  }))
  return { state: next, text: ` ${reward.count}\u00d7 ${item?.name ?? reward.itemId} added to their pack.` }
}

export function addPrepared(state: DungeonState, roomId: string, tag: string, memberKey: string): DungeonState {
  const existing = state.prepared[roomId] ?? []
  if (existing.some((p) => p.tag === tag && p.memberKey === memberKey)) return state
  return { ...state, prepared: { ...state.prepared, [roomId]: [...existing, { tag, memberKey }] } }
}

export const markDone = (state: DungeonState, flag: string): DungeonState =>
  state.done.includes(flag) ? state : { ...state, done: [...state.done, flag] }

export const isDone = (state: DungeonState, room: DungeonRoom, interactionId: string) =>
  state.done.includes(interactionFlag(room.id, interactionId))

/** A trap in the room that nobody has disarmed or set off yet. */
export const armedTrap = (state: DungeonState, room: DungeonRoom): RoomTrap | undefined =>
  room.trap && !state.done.includes(trapFlag(room.id, 'spent')) ? room.trap : undefined

export const trapFound = (state: DungeonState, room: DungeonRoom): boolean =>
  state.done.includes(trapFlag(room.id, 'found'))

export const defuseTrap = (state: DungeonState, room: DungeonRoom): DungeonState =>
  markDone(markDone(state, trapFlag(room.id, 'found')), trapFlag(room.id, 'spent'))

/** The trap goes off on the acting character. Returns what happens, for the step's text. */
export function springTrap(ctx: Context, trap: RoomTrap): string {
  const party = ctx.state.party.map((m) => ({ ...m }))
  const victim = party.find((m) => m.key === ctx.member.key)!
  const parts = [trap.sprung]
  if (trap.damage) {
    takeDamage(victim, trap.damage, false)
    parts.push(`${victim.name} takes ${trap.damage} damage (${victim.hp}/${victim.maxHp} HP).`)
  }
  if (trap.condition) {
    victim.bag = adjustBag(victim.bag, trap.condition, 1)
    parts.push(`${victim.name} gains a ${TOKENS[trap.condition]?.name ?? trap.condition} token in their bag.`)
  }
  ctx.state = defuseTrap({ ...ctx.state, party }, ctx.room)
  ctx.member = victim
  return parts.join(' ')
}

export interface Resolution {
  state: DungeonState
  step: ResolutionStep
}

/**
 * One character's action as it resolves. `state` and `member` are replaced as tests settle (drawn
 * tokens, Prayer, conditions), so read them again after rolling rather than before.
 */
export interface Context {
  state: DungeonState
  member: PartyMember
  room: DungeonRoom
  planned: PlannedAction
  rng: Rng
  ask: Ask
  /** The torch, which modifies every test the party makes. */
  torch: TorchLevel
  /** Condition effects waiting to be added to the outcome. */
  notes: string[]
}

export function narrate(
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
  const notes = ctx.notes.length > 0 ? ` ${ctx.notes.join(' ')}` : ''
  return {
    state,
    step: {
      actor: playerActor(ctx.member, colorIndex),
      title,
      intro,
      test,
      testMode: test ? 'check' : undefined,
      outcome: outcome + complication + notes,
      tone,
    },
  }
}

/**
 * Rolls a test for `subject` (the acting member unless someone else is the patient). An ally may
 * pray for a failure, then the tokens settle: drawn resources go into play, conditions are sealed.
 */
export function runTestFor(
  ctx: Context,
  subject: PartyMember,
  attribute: SpecialKey,
  difficulty: number,
): SkillTestOutcome {
  const rolled = performSkillTest(
    subject.bag,
    attribute,
    subject.special[attribute],
    difficulty,
    ctx.rng,
    testBonuses(subject, ctx.torch),
    drawRulesFor(subject),
  )
  const party = ctx.state.party.map((m) => ({ ...m }))
  const taker = party.find((m) => m.key === subject.key)!
  const test = offerAllyHelp(ctx.ask, party, taker, rolled)
  ctx.notes.push(...settleTest(taker, test.result, test.passed, { round: 0, lethal: false, ask: ctx.ask }))
  ctx.state = { ...ctx.state, party }
  ctx.member = party.find((m) => m.key === ctx.member.key) ?? ctx.member
  return test
}

export const runTest = (ctx: Context, attribute: SpecialKey, difficulty: number) =>
  runTestFor(ctx, ctx.member, attribute, difficulty)

export const withDarkness = (ctx: Context, intro: string) =>
  ctx.torch === 'dim' || ctx.torch === 'out' ? `${intro} The light is poor.` : intro

/**
 * Healer: offers each of these characters, who have just recovered HP or had conditions removed,
 * the chance to release Faith a Priest sealed on them. Returns the new state and what to add to the outcome.
 */
export function withHealer(
  ctx: Context,
  state: DungeonState,
  keys: string[],
  cause: string,
): { state: DungeonState; text: string } {
  const party = state.party.map((m) => ({ ...m }))
  let text = ''
  for (const key of keys) {
    const ally = party.find((m) => m.key === key)
    if (ally) text += offerHealer(ctx.ask, party, ally, cause).note
  }
  return { state: { ...state, party }, text }
}

export function keepWatch(ctx: Context, title = 'Keep watch'): Resolution {
  return narrate(
    ctx,
    title,
    `${ctx.member.name} keeps watch over ${ctx.room.name}.`,
    'Nothing approaches. For now, the dark is quiet.',
    'neutral',
  )
}

/** One kind of Interval action: the menu entries it adds, and what it does when chosen. */
export interface ActionHandler {
  options(state: DungeonState, member: PartyMember): ActionOption[]
  /** `args` are the parts of the action id after the first colon. */
  perform(ctx: Context, args: string[]): Resolution
}
