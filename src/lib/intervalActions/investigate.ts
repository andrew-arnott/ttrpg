import { linkKey, trapFlag, type DungeonLink, type DungeonRoom } from '../../data/dungeon'
import { SPECIAL_LABELS } from '../../data/types'
import { revealVisible, roomById, type DungeonState } from '../dungeonState'
import {
  armedTrap,
  defuseTrap,
  giveReward,
  keepWatch,
  lowerFirst,
  markDone,
  narrate,
  runTest,
  springTrap,
  trapFound,
  withArticle,
  withDarkness,
  type ActionHandler,
} from './context'

/** What Investigate could still turn up in a room: its secret and any trap nobody has noticed. */
function pendingFinds(state: DungeonState, room: DungeonRoom) {
  const finds: { kind: 'secret' | 'trap' | 'passage'; difficulty: number; link?: DungeonLink }[] = []
  for (const link of state.dungeon.links) {
    const touches = link.from === room.id || link.to === room.id
    if (link.hidden?.findDifficulty !== undefined && touches && !state.discovered.includes(linkKey(link))) {
      finds.push({ kind: 'passage', difficulty: link.hidden.findDifficulty, link })
    }
  }
  if (!state.done.includes(`secret:${room.id}`)) finds.push({ kind: 'secret', difficulty: room.secret.difficulty })
  if (armedTrap(state, room) && !trapFound(state, room)) finds.push({ kind: 'trap', difficulty: room.trap!.findDifficulty })
  return finds
}

export const investigate: ActionHandler = {
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
    const reached = finds.filter((f) => reaches(f.difficulty))
    const found = reached.map((f) => f.kind)
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
    for (const { link } of reached) {
      if (!link?.hidden) continue
      state = revealVisible({ ...state, discovered: [...state.discovered, linkKey(link)] })
      lines.push(`${member.name} discovers ${link.hidden.discovery}!`)
    }
    return narrate(ctx, 'Investigate', intro, lines.join(' '), 'success', state, test)
  },
}

export const disarm: ActionHandler = {
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
