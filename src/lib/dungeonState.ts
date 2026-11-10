import { type Hands } from '../data/weapons'
import { outOfFight, type Adventurer } from './adventurer'
import { HOLY_TORCH, ORDINARY_TORCH } from '../data/items'
import { linkKey, type Dungeon, type DungeonLink, type DungeonRoom, type Lock } from '../data/dungeon'
import { releaseAllConditions } from './characterTest'
import type { PendingInterval } from './intervalActions/types'
import { startBattle, type BattleState, type SurpriseCheck } from './battle'
import type { Rng } from './drawTest'
import { burnInterval, lightBonus, lightTorch, torchLevel, TORCH_LEVEL_LABEL, type TorchLevel, type TorchState } from './torch'

export interface PartyMember extends Adventurer {
  speciesId: string
  hands: Hands
  inventory: Record<string, number>
  /** The resource that resting restores. */
  restResourceId: string
}

/** The party can only carry this many spare torches between them. */
export const PARTY_TORCH_LIMIT = 3

/** Keeps spare torches in party order until the limit is reached; the rest are left behind. */
export function limitTorches(party: PartyMember[], limit = PARTY_TORCH_LIMIT): PartyMember[] {
  let left = limit
  return party.map((m) => {
    const kept = Math.min(m.inventory.torch ?? 0, left)
    left -= kept
    return { ...m, inventory: { ...m.inventory, torch: kept } }
  })
}

/** Something a character set up in a room, such as Fortify, that matters if combat starts there. */
export interface Preparation {
  tag: string
  memberKey: string
}

/** Someone keeping watch during the last Interval makes it harder for enemies to surprise the party. */
export interface Watchfulness {
  label: string
  value: number
}

export const STAND_WATCH: Watchfulness = { label: 'Stand Watch', value: 2 }
export const KEEP_WATCH: Watchfulness = { label: 'Keeping watch', value: 2 }

export interface DungeonState {
  dungeon: Dungeon
  party: PartyMember[]
  roomId: string
  /** Rooms the party has seen at some point, whether or not they are lit now. */
  explored: string[]
  /** Keys of hidden links the party has found. */
  discovered: string[]
  /** Ids of locks that have been opened. */
  unlocked: string[]
  /** One-off room features already dealt with, e.g. `secret:entrance`. */
  done: string[]
  /** Preparations made in each room, e.g. "Fortified". */
  prepared: Record<string, Preparation[]>
  torch: TorchState
  intervals: number
  log: string[]
  battle: BattleState | null
  /** Which encounter the current battle belongs to. */
  battleKind: 'patrol' | 'boss' | 'guardian' | null
  patrolTriggered: boolean
  /** The Interval count when the first lock was opened. The patrol clock only runs from then. */
  patrolStartedAt: number | null
  bossTriggered: boolean
  /** The boss has been beaten and the tutorial is complete. */
  completed: boolean
  /** Set when someone kept watch in the Interval that just ended; cleared by moving. */
  watch: Watchfulness | null
  /** Set while the Interval waits for a player to decide whether to use a Triggered ability. */
  pending?: PendingInterval | null
}

export type DungeonAction =
  | { type: 'moveTo'; roomId: string; rng: Rng }
  | { type: 'lightTorch'; memberKey: string }
  | { type: 'startBattle'; rng: Rng }
  | { type: 'replace'; state: DungeonState }

/** How many doorways away the party's light reaches at each torch level. */
/** Set when the party walks into a guardian's room, so it only wakes once. */
export const guardianFlag = (roomId: string) => `guardian:${roomId}`

export const LIGHT_REACH: Record<TorchLevel, number> = {
  bright: 2,
  steady: 1,
  dim: 0,
  out: 0,
}

const LOG_LIMIT = 40

export function roomCenter(room: DungeonRoom): { x: number; y: number } {
  return { x: room.x + room.w / 2, y: room.y + room.h / 2 }
}

export function roomById(dungeon: Dungeon, id: string): DungeonRoom {
  const room = dungeon.rooms.find((r) => r.id === id)
  if (!room) throw new Error(`Unknown room ${id}`)
  return room
}

/** Which hidden links have been found and which locks have been opened. */
export interface Passages {
  discovered: string[]
  unlocked: string[]
}

export const NO_PASSAGES: Passages = { discovered: [], unlocked: [] }

export const passagesOf = (state: Pick<DungeonState, 'discovered' | 'unlocked'>): Passages => ({
  discovered: state.discovered,
  unlocked: state.unlocked,
})

const isFound = (link: DungeonLink, passages: Passages) => !link.hidden || passages.discovered.includes(linkKey(link))
const isOpen = (link: DungeonLink, passages: Passages) => !link.lock || passages.unlocked.includes(link.lock.id)

/** Links the party can use now: hidden ones must have been found and locked ones opened. */
export function openLinks(dungeon: Dungeon, passages: Passages = NO_PASSAGES) {
  return dungeon.links.filter((l) => isFound(l, passages) && isOpen(l, passages))
}

export function adjacentRoomIds(dungeon: Dungeon, roomId: string, passages: Passages = NO_PASSAGES): string[] {
  return openLinks(dungeon, passages).flatMap((l) =>
    l.from === roomId ? [l.to] : l.to === roomId ? [l.from] : [],
  )
}

export interface LockedExit {
  link: DungeonLink
  lock: Lock
  room: DungeonRoom
}

/** Locked exits from a room that the party knows about and has not opened yet. */
export function lockedExits(dungeon: Dungeon, roomId: string, passages: Passages): LockedExit[] {
  return dungeon.links.flatMap((link) => {
    if (!link.lock || !isFound(link, passages) || isOpen(link, passages)) return []
    if (link.from !== roomId && link.to !== roomId) return []
    return [{ link, lock: link.lock, room: roomById(dungeon, link.from === roomId ? link.to : link.from) }]
  })
}

/** The party's own room is always visible; others need to be within the torch's reach and not behind a lock. */
export function visibleRoomIds(
  dungeon: Dungeon,
  roomId: string,
  level: TorchLevel,
  passages: Passages = NO_PASSAGES,
): string[] {
  const reach = LIGHT_REACH[level]
  const seen = new Set([roomId])
  let frontier = [roomId]
  for (let hop = 0; hop < reach; hop++) {
    frontier = frontier
      .flatMap((id) => adjacentRoomIds(dungeon, id, passages))
      .filter((id) => !seen.has(id))
    frontier.forEach((id) => seen.add(id))
  }
  return dungeon.rooms.filter((r) => seen.has(r.id)).map((r) => r.id)
}

export function createDungeonState(dungeon: Dungeon, party: PartyMember[]): DungeonState {
  const torch = lightTorch(ORDINARY_TORCH)
  return {
    dungeon,
    party,
    roomId: dungeon.startRoomId,
    explored: visibleRoomIds(dungeon, dungeon.startRoomId, torchLevel(torch)),
    discovered: [],
    unlocked: [],
    done: [],
    prepared: {},
    torch,
    intervals: 0,
    log: [`The party enters ${dungeon.name} with a lit torch.`],
    battle: null,
    battleKind: null,
    patrolTriggered: false,
    patrolStartedAt: null,
    bossTriggered: false,
    completed: false,
    watch: null,
  }
}

export function withLog(state: DungeonState, ...messages: string[]): DungeonState {
  return { ...state, log: [...messages.reverse(), ...state.log].slice(0, LOG_LIMIT) }
}

export function revealVisible(state: DungeonState): DungeonState {
  const visible = visibleRoomIds(state.dungeon, state.roomId, torchLevel(state.torch), passagesOf(state))
  const explored = [...new Set([...state.explored, ...visible])]
  return explored.length === state.explored.length ? state : { ...state, explored }
}

export function lightFreshTorch(state: DungeonState, holy: boolean): DungeonState {
  return revealVisible({ ...state, torch: lightTorch(holy ? HOLY_TORCH : ORDINARY_TORCH) })
}

/** Ends an Interval: the torch burns down one step and the light may reach less far. */
export function burnTorchInterval(state: DungeonState): { state: DungeonState; message: string } {
  const before = torchLevel(state.torch)
  const torch = burnInterval(state.torch)
  const after = torchLevel(torch)
  const intervals = state.intervals + 1
  const message =
    after === before
      ? `Interval ${intervals} ends.`
      : after === 'out'
        ? `Interval ${intervals} ends: the torch gutters and goes out. Darkness closes in.`
        : `Interval ${intervals} ends: the torch burns ${TORCH_LEVEL_LABEL[after]}.`
  return { state: revealVisible({ ...state, torch, intervals }), message }
}

/** The patrol finds the party wherever they are, and any preparations made in that room come into play. */
export function surpriseCheckFor(state: DungeonState): SurpriseCheck {
  return { modifiers: state.watch ? [state.watch] : [] }
}

export function springPatrol(state: DungeonState, rng: Rng): DungeonState {
  const { patrol } = state.dungeon
  const battle = startBattle(
    state.party,
    state.prepared[state.roomId] ?? [],
    patrol.enemyIds,
    rng,
    patrol.arrival,
    surpriseCheckFor(state),
    { light: lightBonus(state.torch) },
  )
  return withLog({ ...state, battle, battleKind: 'patrol', patrolTriggered: true }, patrol.arrival)
}

/** The guardian rises when the party enters its room. There is no chance to surprise anyone here. */
export function springBoss(state: DungeonState, rng: Rng): DungeonState {
  const { boss } = state.dungeon
  const battle = startBattle(state.party, state.prepared[boss.roomId] ?? [], boss.enemyIds, rng, boss.arrival, null, {
    unwarded: state.done.includes(`dispelled:${boss.roomId}`),
    light: lightBonus(state.torch),
  })
  return withLog(
    { ...state, battle, battleKind: 'boss', bossTriggered: true, patrolTriggered: true },
    boss.arrival,
  )
}

/** An optional room's guardian wakes the first time the party walks in, and the party may spot it first. */
export function springGuardian(state: DungeonState, room: DungeonRoom, rng: Rng): DungeonState {
  const guardian = room.guardian!
  const battle = startBattle(
    state.party,
    state.prepared[room.id] ?? [],
    guardian.enemyIds,
    rng,
    guardian.arrival,
    surpriseCheckFor(state),
    { light: lightBonus(state.torch) },
  )
  return withLog(
    { ...state, battle, battleKind: 'guardian', done: [...state.done, guardianFlag(room.id)] },
    guardian.arrival,
  )
}

/** The patrol only starts looking once the first lock has been opened. */
export function patrolIsDue(state: DungeonState): boolean {
  if (state.battle || state.patrolTriggered || state.patrolStartedAt === null) return false
  return state.intervals - state.patrolStartedAt >= state.dungeon.patrol.delayAfterUnlock
}

/** Intervals until the patrol arrives, once its clock is running. */
export function patrolCountdown(state: DungeonState): number | null {
  if (state.patrolStartedAt === null || state.patrolTriggered) return null
  return state.dungeon.patrol.delayAfterUnlock - (state.intervals - state.patrolStartedAt)
}

export function springPatrolIfDue(state: DungeonState, rng: Rng): DungeonState {
  return patrolIsDue(state) ? springPatrol(state, rng) : state
}

/** Opens a lock, starts the patrol clock if this is the first one, and shows whatever is now in the light. */
export function unlockLock(state: DungeonState, lockId: string): DungeonState {
  if (state.unlocked.includes(lockId)) return state
  return revealVisible({
    ...state,
    unlocked: [...state.unlocked, lockId],
    patrolStartedAt: state.patrolStartedAt ?? state.intervals,
  })
}

export interface SealStatus {
  link: DungeonLink
  lock: Extract<Lock, { kind: 'seal' }>
  requirements: { hint: string; done: string; met: boolean }[]
}

export const sealStatuses = (state: DungeonState): SealStatus[] =>
  state.dungeon.links.flatMap((link) =>
    link.lock?.kind === 'seal'
      ? [
          {
            link,
            lock: link.lock,
            requirements: link.lock.requires.map((r) => ({
              hint: r.hint,
              done: r.done,
              met: state.done.includes(r.flag),
            })),
          },
        ]
      : [],
  )

/** Breaks any seal whose requirements have all been met. Returns what to tell the player. */
export function breakReadySeals(state: DungeonState): { state: DungeonState; messages: string[] } {
  let next = state
  const messages: string[] = []
  for (const { lock, requirements } of sealStatuses(state)) {
    if (next.unlocked.includes(lock.id) || !requirements.every((r) => r.met)) continue
    next = unlockLock(next, lock.id)
    messages.push(lock.broken)
  }
  return { state: next, messages }
}

/** Carries HP, resources and bags out of the fight. Anyone who was knocked out comes round with 1 HP. */
export function endBattle(state: DungeonState): DungeonState {
  const { battle } = state
  if (!battle) return state
  const party = state.party.map((m) => {
    const found = battle.players.find((p) => p.key === m.key)
    if (!found) return m
    const fought = { ...found }
    releaseAllConditions(fought)
    return outOfFight(m, fought)
  })
  const wonBoss = state.battleKind === 'boss' && battle.result === 'victory'
  return withLog(
    { ...state, party, battle: null, battleKind: null, completed: state.completed || wonBoss },
    wonBoss ? 'The Barrow Warden crumbles to dust.' : 'The fight is over. Everyone catches their breath.',
  )
}

export function dungeonReducer(state: DungeonState, action: DungeonAction): DungeonState {
  switch (action.type) {
    case 'replace':
      return action.state

    case 'startBattle':
      return state.battle || state.pending || state.patrolTriggered ? state : springPatrol(state, action.rng)

    case 'moveTo': {
      if (state.battle || state.pending) return state
      if (!adjacentRoomIds(state.dungeon, state.roomId, passagesOf(state)).includes(action.roomId)) return state
      const room = roomById(state.dungeon, action.roomId)
      const burned = burnTorchInterval(state)
      const moved = revealVisible(
        withLog(
          { ...burned.state, roomId: action.roomId, watch: null },
          `The party moves to ${room.name}.`,
          burned.message,
        ),
      )
      const { boss } = state.dungeon
      if (room.id === boss.roomId && !moved.bossTriggered) return springBoss(moved, action.rng)
      if (room.guardian && !moved.done.includes(guardianFlag(room.id))) return springGuardian(moved, room, action.rng)
      return springPatrolIfDue(moved, action.rng)
    }

    case 'lightTorch': {
      const member = state.party.find((m) => m.key === action.memberKey)
      if (state.battle || state.pending || !member || (member.inventory.torch ?? 0) <= 0) return state
      const party = state.party.map((m) =>
        m.key === member.key ? { ...m, inventory: { ...m.inventory, torch: (m.inventory.torch ?? 0) - 1 } } : m,
      )
      const replaced = torchLevel(state.torch) !== 'out'
      return withLog(
        lightFreshTorch({ ...state, party }, false),
        `${member.name} lights a fresh torch${replaced ? ', replacing the one still burning' : ''}.`,
      )
    }
  }
}
