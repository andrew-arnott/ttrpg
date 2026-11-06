import { HOLY_TORCH, ORDINARY_TORCH } from '../data/items'
import { linkKey, type Dungeon, type DungeonRoom } from '../data/dungeon'
import type { SpecialSpread, TokenStack } from '../data/types'
import { burnInterval, lightTorch, torchLevel, TORCH_LEVEL_LABEL, type TorchLevel, type TorchState } from './torch'

export interface PartyMember {
  key: string
  name: string
  professionId: string
  speciesId: string
  hp: number
  maxHp: number
  special: SpecialSpread
  bag: TokenStack[]
  inventory: Record<string, number>
  /** Profession resource tokens currently in play. */
  resources: Record<string, number>
  /** The resource that resting restores. */
  restResourceId: string
  /** Resource totals the character started with; resting can exceed them by a little. */
  startingResources: Record<string, number>
  abilityIds: string[]
}

export interface DungeonState {
  dungeon: Dungeon
  party: PartyMember[]
  roomId: string
  /** Rooms the party has seen at some point, whether or not they are lit now. */
  explored: string[]
  /** Keys of hidden links the party has found. */
  discovered: string[]
  /** One-off room features already dealt with, e.g. `secret:entrance`. */
  done: string[]
  /** Preparations made in each room, e.g. "Fortified". */
  prepared: Record<string, string[]>
  torch: TorchState
  intervals: number
  log: string[]
}

export type DungeonAction =
  | { type: 'moveTo'; roomId: string }
  | { type: 'lightTorch'; memberKey: string }
  | { type: 'replace'; state: DungeonState }

/** How many doorways away the party's light reaches at each torch level. */
export const LIGHT_REACH: Record<TorchLevel, number> = {
  bright: 2,
  steady: 1,
  dim: 0,
  out: 0,
}

/** Resting can restore a resource this far above what the character started with. */
export const REST_BONUS_LIMIT = 2

const LOG_LIMIT = 40

export function roomCenter(room: DungeonRoom): { x: number; y: number } {
  return { x: room.x + room.w / 2, y: room.y + room.h / 2 }
}

export function roomById(dungeon: Dungeon, id: string): DungeonRoom {
  const room = dungeon.rooms.find((r) => r.id === id)
  if (!room) throw new Error(`Unknown room ${id}`)
  return room
}

/** Links the party can currently use: every ordinary link plus any hidden ones they have found. */
export function openLinks(dungeon: Dungeon, discovered: string[]) {
  return dungeon.links.filter((l) => !l.hidden || discovered.includes(linkKey(l)))
}

export function adjacentRoomIds(dungeon: Dungeon, roomId: string, discovered: string[] = []): string[] {
  return openLinks(dungeon, discovered).flatMap((l) =>
    l.from === roomId ? [l.to] : l.to === roomId ? [l.from] : [],
  )
}

/** The party's own room is always visible; others need to be within the torch's reach. */
export function visibleRoomIds(
  dungeon: Dungeon,
  roomId: string,
  level: TorchLevel,
  discovered: string[] = [],
): string[] {
  const reach = LIGHT_REACH[level]
  const seen = new Set([roomId])
  let frontier = [roomId]
  for (let hop = 0; hop < reach; hop++) {
    frontier = frontier
      .flatMap((id) => adjacentRoomIds(dungeon, id, discovered))
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
    done: [],
    prepared: {},
    torch,
    intervals: 0,
    log: [`The party enters ${dungeon.name} with a lit torch.`],
  }
}

export function withLog(state: DungeonState, ...messages: string[]): DungeonState {
  return { ...state, log: [...messages.reverse(), ...state.log].slice(0, LOG_LIMIT) }
}

export function revealVisible(state: DungeonState): DungeonState {
  const visible = visibleRoomIds(state.dungeon, state.roomId, torchLevel(state.torch), state.discovered)
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

export function dungeonReducer(state: DungeonState, action: DungeonAction): DungeonState {
  switch (action.type) {
    case 'replace':
      return action.state

    case 'moveTo': {
      if (!adjacentRoomIds(state.dungeon, state.roomId, state.discovered).includes(action.roomId)) return state
      const room = roomById(state.dungeon, action.roomId)
      const burned = burnTorchInterval(state)
      return revealVisible(
        withLog({ ...burned.state, roomId: action.roomId }, `The party moves to ${room.name}.`, burned.message),
      )
    }

    case 'lightTorch': {
      const member = state.party.find((m) => m.key === action.memberKey)
      if (!member || (member.inventory.torch ?? 0) <= 0) return state
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
