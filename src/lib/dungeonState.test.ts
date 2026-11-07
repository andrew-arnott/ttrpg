import { describe, expect, it } from 'vitest'
import { linkKey, SUNKEN_CRYPT } from '../data/dungeon'
import { ORDINARY_TORCH } from '../data/items'
import {
  adjacentRoomIds,
  createDungeonState,
  dungeonReducer,
  endBattle,
  visibleRoomIds,
} from './dungeonState'
import { mulberry32 } from './drawTest'
import { testMember } from './testFixtures'
import { torchLevel, totalIntervals } from './torch'

const rng = mulberry32(5)
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
    expect(dungeonReducer(s, { type: 'moveTo', roomId: 'crypt', rng })).toBe(s)
    expect(dungeonReducer(s, { type: 'moveTo', roomId: 'storeroom', rng })).toBe(s)
    expect(dungeonReducer(s, { type: 'moveTo', roomId: 'greatHall', rng }).roomId).toBe('greatHall')
  })

  it('passes an Interval whenever the party moves', () => {
    let s = fresh()
    s = dungeonReducer(s, { type: 'moveTo', roomId: 'greatHall', rng })
    expect(s.intervals).toBe(1)
    expect(s.torch.remaining).toBe(totalIntervals(ORDINARY_TORCH) - 1)
    expect(s.log[0]).toMatch(/Interval 1/)
    expect(s.log.some((l) => l.includes('moves to Great Hall'))).toBe(true)
  })

  it('lets the torch go out while travelling', () => {
    let s = { ...fresh(), patrolTriggered: true }
    const route = ['greatHall', 'entrance', 'greatHall', 'entrance', 'greatHall', 'entrance']
    for (const roomId of route) s = dungeonReducer(s, { type: 'moveTo', roomId, rng })
    expect(torchLevel(s.torch)).toBe('out')
  })

  it('remembers rooms that were seen once the light moves on', () => {
    let s = fresh()
    s = dungeonReducer(s, { type: 'moveTo', roomId: 'greatHall', rng })
    s = dungeonReducer(s, { type: 'moveTo', roomId: 'shrine', rng })
    expect(s.explored).toContain('library')
    expect(s.explored).toContain('entrance')
  })

  it('can travel a discovered hidden passage', () => {
    const hidden = SUNKEN_CRYPT.links.find((l) => l.hidden)!
    const s = { ...fresh(), discovered: [linkKey(hidden)] }
    expect(dungeonReducer(s, { type: 'moveTo', roomId: hidden.to, rng }).roomId).toBe(hidden.to)
  })

  it('lights a new torch from the member inventory without taking time', () => {
    let s = fresh()
    s = dungeonReducer(s, { type: 'moveTo', roomId: 'greatHall', rng })
    s = dungeonReducer(s, { type: 'moveTo', roomId: 'entrance', rng })
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
    dungeonReducer(s, { type: 'moveTo', roomId: 'greatHall', rng })
    expect(JSON.stringify(s)).toBe(snapshot)
  })
})

describe('the patrol', () => {
  const route = ['greatHall', 'entrance', 'greatHall', 'entrance']

  it('finds the party once enough Intervals have passed, wherever they are', () => {
    let s = fresh()
    for (const roomId of route.slice(0, 3)) s = dungeonReducer(s, { type: 'moveTo', roomId, rng })
    expect(s.battle).toBeNull()
    s = dungeonReducer(s, { type: 'moveTo', roomId: route[3], rng })
    expect(s.battle).not.toBeNull()
    expect(s.battle!.enemies).toHaveLength(SUNKEN_CRYPT.patrol.enemyIds.length)
    expect(s.patrolTriggered).toBe(true)
  })

  it('does not return once it has been dealt with', () => {
    let s = fresh()
    for (const roomId of route) s = dungeonReducer(s, { type: 'moveTo', roomId, rng })
    s = dungeonReducer(s, { type: 'replace', state: endBattle(s) })
    s = dungeonReducer(s, { type: 'moveTo', roomId: 'greatHall', rng })
    expect(s.battle).toBeNull()
  })

  it('blocks moving and lighting torches while the fight is on', () => {
    const s = dungeonReducer(fresh(), { type: 'startBattle', rng })
    expect(dungeonReducer(s, { type: 'moveTo', roomId: 'greatHall', rng })).toBe(s)
    expect(dungeonReducer(s, { type: 'lightTorch', memberKey: 'a' })).toBe(s)
  })

  it('can be called in early', () => {
    const s = dungeonReducer(fresh(), { type: 'startBattle', rng })
    expect(s.battle?.round).toBe(1)
    expect(s.intervals).toBe(0)
  })

  it('lets a preparation made in the room count when the patrol arrives', () => {
    const base = fresh()
    const prepared = { entrance: [{ tag: 'Fortified', memberKey: 'a' }] }
    const s = dungeonReducer({ ...base, prepared }, { type: 'startBattle', rng })
    expect(s.battle!.players.find((p) => p.key === 'a')!.defense).toBe(2)
    expect(s.battle!.opening.some((st) => st.title === 'Fortified')).toBe(true)
  })

  it('carries HP and resources out of a fight and revives the fallen at 1 HP', () => {
    const s = dungeonReducer(fresh(), { type: 'startBattle', rng })
    const battle = structuredClone(s.battle!)
    battle.players[0].hp = 0
    battle.players[1].hp = 1
    battle.players[0].resources.resolve = 1
    const after = endBattle({ ...s, battle })
    expect(after.battle).toBeNull()
    expect(after.party[0].hp).toBe(1)
    expect(after.party[0].resources.resolve).toBe(1)
    expect(after.party[1].hp).toBe(1)
  })
})
