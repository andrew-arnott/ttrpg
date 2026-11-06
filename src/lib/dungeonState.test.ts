import { describe, expect, it } from 'vitest'
import { linkKey, SUNKEN_CRYPT } from '../data/dungeon'
import { ORDINARY_TORCH } from '../data/items'
import {
  adjacentRoomIds,
  createDungeonState,
  dungeonReducer,
  visibleRoomIds,
} from './dungeonState'
import { testMember } from './testFixtures'
import { torchLevel, totalIntervals } from './torch'

const fresh = () => createDungeonState(SUNKEN_CRYPT, [testMember('a', 2), testMember('b', 0)])

describe('dungeon layout', () => {
  const visibleLinks = SUNKEN_CRYPT.links.filter((l) => !l.hidden)

  it('has links only between rooms that exist, and every room is reachable without secrets', () => {
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

  it('keeps every ordinary corridor straight', () => {
    const centre = (id: string) => {
      const r = SUNKEN_CRYPT.rooms.find((x) => x.id === id)!
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
    }
    for (const l of visibleLinks) {
      const a = centre(l.from)
      const b = centre(l.to)
      expect(a.x === b.x || a.y === b.y, `${l.from} -> ${l.to}`).toBe(true)
    }
  })

  it('gives every room something to find and something to try', () => {
    for (const room of SUNKEN_CRYPT.rooms) {
      expect(room.secret.text, room.id).toBeTruthy()
      expect(room.interaction.label, room.id).toBeTruthy()
      expect(room.intel, room.id).toBeTruthy()
    }
  })

  it('keeps hidden links out of the way until they are discovered', () => {
    const hidden = SUNKEN_CRYPT.links.find((l) => l.hidden)!
    expect(adjacentRoomIds(SUNKEN_CRYPT, hidden.from)).not.toContain(hidden.to)
    expect(adjacentRoomIds(SUNKEN_CRYPT, hidden.from, [linkKey(hidden)])).toContain(hidden.to)
    expect(adjacentRoomIds(SUNKEN_CRYPT, hidden.to, [linkKey(hidden)])).toContain(hidden.from)
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

  it('moves only through connected rooms', () => {
    const s = fresh()
    expect(dungeonReducer(s, { type: 'moveTo', roomId: 'crypt' })).toBe(s)
    expect(dungeonReducer(s, { type: 'moveTo', roomId: 'storeroom' })).toBe(s)
    expect(dungeonReducer(s, { type: 'moveTo', roomId: 'greatHall' }).roomId).toBe('greatHall')
  })

  it('passes an Interval whenever the party moves', () => {
    let s = fresh()
    s = dungeonReducer(s, { type: 'moveTo', roomId: 'greatHall' })
    expect(s.intervals).toBe(1)
    expect(s.torch.remaining).toBe(totalIntervals(ORDINARY_TORCH) - 1)
    expect(s.log[0]).toMatch(/Interval 1/)
    expect(s.log.some((l) => l.includes('moves to Great Hall'))).toBe(true)
  })

  it('lets the torch go out while travelling', () => {
    let s = fresh()
    const route = ['greatHall', 'entrance', 'greatHall', 'entrance', 'greatHall', 'entrance']
    for (const roomId of route) s = dungeonReducer(s, { type: 'moveTo', roomId })
    expect(torchLevel(s.torch)).toBe('out')
  })

  it('remembers rooms that were seen once the light moves on', () => {
    let s = fresh()
    s = dungeonReducer(s, { type: 'moveTo', roomId: 'greatHall' })
    s = dungeonReducer(s, { type: 'moveTo', roomId: 'shrine' })
    expect(s.explored).toContain('library')
    expect(s.explored).toContain('entrance')
  })

  it('can travel a discovered hidden passage', () => {
    const hidden = SUNKEN_CRYPT.links.find((l) => l.hidden)!
    const s = { ...fresh(), discovered: [linkKey(hidden)] }
    expect(dungeonReducer(s, { type: 'moveTo', roomId: hidden.to }).roomId).toBe(hidden.to)
  })

  it('lights a new torch from the member inventory without taking time', () => {
    let s = fresh()
    s = dungeonReducer(s, { type: 'moveTo', roomId: 'greatHall' })
    s = dungeonReducer(s, { type: 'moveTo', roomId: 'entrance' })
    const intervals = s.intervals
    s = dungeonReducer(s, { type: 'lightTorch', memberKey: 'a' })
    expect(s.torch.remaining).toBe(totalIntervals(ORDINARY_TORCH))
    expect(s.intervals).toBe(intervals)
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
    dungeonReducer(s, { type: 'moveTo', roomId: 'greatHall' })
    expect(JSON.stringify(s)).toBe(snapshot)
  })
})
