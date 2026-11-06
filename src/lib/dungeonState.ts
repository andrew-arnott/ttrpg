import { ITEMS_BY_ID, ORDINARY_TORCH } from '../data/items'
import type { Dungeon, DungeonRoom } from '../data/dungeon'
import { burnInterval, lightTorch, torchLevel, TORCH_LEVEL_LABEL, type TorchLevel, type TorchState } from './torch'

export interface PartyMember {
  key: string
  name: string
  professionId: string
  speciesId: string
  hp: number
  inventory: Record<string, number>
}

export interface DungeonState {
  dungeon: Dungeon
  party: PartyMember[]
  roomId: string
  /** Rooms the party has seen at some point, whether or not they are lit now. */
  explored: string[]
  torch: TorchState
  intervals: number
  log: string[]
}

export type DungeonAction =
  | { type: 'passInterval' }
  | { type: 'moveTo'; roomId: string }
  | { type: 'lightTorch'; memberKey: string }

/** How many doorways away the party's light reaches at each torch level. */
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

export function adjacentRoomIds(dungeon: Dungeon, roomId: string): string[] {
  return dungeon.links.flatMap((l) => (l.from === roomId ? [l.to] : l.to === roomId ? [l.from] : []))
}

/** The party's own room is always visible; others need to be within the torch's reach. */
export function visibleRoomIds(dungeon: Dungeon, roomId: string, level: TorchLevel): string[] {
  const reach = LIGHT_REACH[level]
  const seen = new Set([roomId])
  let frontier = [roomId]
  for (let hop = 0; hop < reach; hop++) {
    frontier = frontier
      .flatMap((id) => adjacentRoomIds(dungeon, id))
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
    torch,
    intervals: 0,
    log: [`The party enters ${dungeon.name} with a lit torch.`],
  }
}

function withLog(state: DungeonState, message: string): DungeonState {
  return { ...state, log: [message, ...state.log].slice(0, LOG_LIMIT) }
}

function revealVisible(state: DungeonState): DungeonState {
  const visible = visibleRoomIds(state.dungeon, state.roomId, torchLevel(state.torch))
  const explored = [...new Set([...state.explored, ...visible])]
  return explored.length === state.explored.length ? state : { ...state, explored }
}

export function dungeonReducer(state: DungeonState, action: DungeonAction): DungeonState {
  switch (action.type) {
    case 'passInterval': {
      const before = torchLevel(state.torch)
      const torch = burnInterval(state.torch)
      const after = torchLevel(torch)
      let next: DungeonState = { ...state, torch, intervals: state.intervals + 1 }
      next = withLog(
        next,
        after === before
          ? `Interval ${next.intervals} passes.`
          : after === 'out'
            ? `Interval ${next.intervals}: the torch gutters and goes out. Darkness closes in.`
            : `Interval ${next.intervals}: the torch burns ${TORCH_LEVEL_LABEL[after]}.`,
      )
      return revealVisible(next)
    }

    case 'moveTo': {
      if (!adjacentRoomIds(state.dungeon, state.roomId).includes(action.roomId)) return state
      const room = roomById(state.dungeon, action.roomId)
      return revealVisible(withLog({ ...state, roomId: action.roomId }, `The party moves to ${room.name}.`))
    }

    case 'lightTorch': {
      const member = state.party.find((m) => m.key === action.memberKey)
      if (!member || (member.inventory.torch ?? 0) <= 0) return state
      const party = state.party.map((m) =>
        m.key === member.key ? { ...m, inventory: { ...m.inventory, torch: (m.inventory.torch ?? 0) - 1 } } : m,
      )
      const replaced = torchLevel(state.torch) !== 'out'
      const lit: DungeonState = { ...state, party, torch: lightTorch(ORDINARY_TORCH) }
      return revealVisible(
        withLog(
          lit,
          `${member.name} lights a fresh ${ITEMS_BY_ID.torch.name.toLowerCase()}${replaced ? ', replacing the one still burning' : ''}.`,
        ),
      )
    }
  }
}
