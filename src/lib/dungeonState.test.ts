import { describe, expect, it } from 'vitest'
import { SUNKEN_CRYPT } from '../data/dungeon'
import { ORDINARY_TORCH } from '../data/items'
import {
  adjacentRoomIds,
  createDungeonState,
  dungeonReducer,
  visibleRoomIds,
  type PartyMember,
} from './dungeonState'
import { torchLevel, totalIntervals } from './torch'

const member = (key: string, torches: number): PartyMember => ({
  key,
  name: key,
  professionId: 'warrior',
  speciesId: 'human',
  hp: 12,
  inventory: { torch: torches },
})

const fresh = () => createDungeonState(SUNKEN_CRYPT, [member('a', 2), member('b', 0)])

describe('dungeon layout', () => {
  it('has links only between rooms that exist, and every room is reachable', () => {
    const ids = new Set(SUNKEN_CRYPT.rooms.map((r) => r.id))
    for (const l of SUNKEN_CRYPT.links) {
      expect(ids.has(l.from)).toBe(true)
      expect(ids.has(l.to)).toBe(true)
    }
    const reached = new Set([SUNKEN_CRYPT.startRoomId])
    const queue = [SUNKEN_CRYPT.startRoomId]
    while (queue.length) {
      for (const n of adjacentRoomIds(SUNKEN_CRYPT, queue.pop()!)) {
        if (!reached.has(n)) {
          reached.add(n)
          queue.push(n)
        }
      }
    }
    expect(reached.size).toBe(ids.size)
  })

  it('keeps every corridor straight', () => {
    const centre = (id: string) => {
      const r = SUNKEN_CRYPT.rooms.find((x) => x.id === id)!
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
    }
    for (const l of SUNKEN_CRYPT.links) {
      const a = centre(l.from)
      const b = centre(l.to)
      expect(a.x === b.x || a.y === b.y, `${l.from} -> ${l.to}`).toBe(true)
    }
  })
})

describe('visibility', () => {
  it('reaches further the brighter the torch', () => {
    const at = (level: Parameters<typeof visibleRoomIds>[2]) =>
      visibleRoomIds(SUNKEN_CRYPT, 'greatHall', level).length
    expect(at('bright')).toBeGreaterThan(at('steady'))
    expect(at('steady')).toBeGreaterThan(at('dim'))
    expect(at('dim')).toBe(1)
    expect(at('out')).toBe(1)
  })
})

describe('dungeonReducer', () => {
  it('starts in the entrance with a lit torch and the first rooms seen', () => {
    const s = fresh()
    expect(s.roomId).toBe('entrance')
    expect(torchLevel(s.torch)).toBe('bright')
    expect(s.explored).toContain('entrance')
    expect(s.explored).toContain('greatHall')
  })

  it('burns the torch one Interval at a time until it goes out', () => {
    let s = fresh()
    for (let i = 0; i < totalIntervals(ORDINARY_TORCH); i++) s = dungeonReducer(s, { type: 'passInterval' })
    expect(torchLevel(s.torch)).toBe('out')
    expect(s.intervals).toBe(totalIntervals(ORDINARY_TORCH))
    expect(s.log[0]).toMatch(/goes out/)
  })

  it('moves only through connected rooms', () => {
    const s = fresh()
    expect(dungeonReducer(s, { type: 'moveTo', roomId: 'crypt' })).toBe(s)
    const moved = dungeonReducer(s, { type: 'moveTo', roomId: 'greatHall' })
    expect(moved.roomId).toBe('greatHall')
  })

  it('remembers rooms that were seen once the light moves on', () => {
    let s = fresh()
    s = dungeonReducer(s, { type: 'moveTo', roomId: 'greatHall' })
    s = dungeonReducer(s, { type: 'moveTo', roomId: 'shrine' })
    expect(s.explored).toContain('library')
    expect(s.explored).toContain('entrance')
  })

  it('lights a new torch from the member inventory, replacing the active one', () => {
    let s = fresh()
    s = dungeonReducer(s, { type: 'passInterval' })
    s = dungeonReducer(s, { type: 'passInterval' })
    s = dungeonReducer(s, { type: 'passInterval' })
    const before = s.torch.remaining
    s = dungeonReducer(s, { type: 'lightTorch', memberKey: 'a' })
    expect(before).toBeLessThan(totalIntervals(ORDINARY_TORCH))
    expect(s.torch.remaining).toBe(totalIntervals(ORDINARY_TORCH))
    expect(s.party.find((m) => m.key === 'a')!.inventory.torch).toBe(1)
    expect(s.log[0]).toMatch(/replacing/)
  })

  it('ignores lighting a torch the member does not have', () => {
    const s = fresh()
    expect(dungeonReducer(s, { type: 'lightTorch', memberKey: 'b' })).toBe(s)
    expect(dungeonReducer(s, { type: 'lightTorch', memberKey: 'nobody' })).toBe(s)
  })

  it('does not mutate previous state', () => {
    const s = fresh()
    const snapshot = JSON.stringify(s)
    dungeonReducer(s, { type: 'lightTorch', memberKey: 'a' })
    dungeonReducer(s, { type: 'passInterval' })
    expect(JSON.stringify(s)).toBe(snapshot)
  })
})
