import { describe, expect, it } from 'vitest'
import { linkKey, SUNKEN_CRYPT } from '../data/dungeon'
import { ORDINARY_TORCH } from '../data/items'
import {
  adjacentRoomIds,
  breakReadySeals,
  createDungeonState,
  dungeonReducer,
  endBattle,
  KEEP_WATCH,
  limitTorches,
  lockedExits,
  NO_PASSAGES,
  passagesOf,
  patrolCountdown,
  patrolIsDue,
  sealStatuses,
  STAND_WATCH,
  surpriseCheckFor,
  unlockLock,
  visibleRoomIds,
} from './dungeonState'
import { mulberry32 } from './drawTest'
import { testMember } from './testFixtures'
import { torchLevel, totalIntervals } from './torch'

const rng = mulberry32(5)
const freshLocked = () => createDungeonState(SUNKEN_CRYPT, [testMember('a', 2), testMember('b', 0)])

/** The entrance door is open, so the patrol clock is running from Interval 0. */
const fresh = () => unlockLock(freshLocked(), 'entranceDoor')

const lockIds = SUNKEN_CRYPT.links.flatMap((l) => (l.lock ? [l.lock.id] : []))

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
      for (const n of adjacentRoomIds(SUNKEN_CRYPT, queue.pop()!, { discovered: [], unlocked: lockIds })) {
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
      expect(room.interactions.length, room.id).toBeGreaterThan(0)
      expect(room.intel, room.id).toBeTruthy()
    }
  })

  it('keeps hidden links out of the way until they are discovered', () => {
    const hidden = SUNKEN_CRYPT.links.find((l) => l.hidden)!
    const found = { discovered: [linkKey(hidden)], unlocked: [] }
    expect(adjacentRoomIds(SUNKEN_CRYPT, hidden.from)).not.toContain(hidden.to)
    expect(adjacentRoomIds(SUNKEN_CRYPT, hidden.from, found)).toContain(hidden.to)
    expect(adjacentRoomIds(SUNKEN_CRYPT, hidden.to, found)).toContain(hidden.from)
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
    const s = { ...fresh(), roomId: hidden.from, discovered: [linkKey(hidden)] }
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

describe('the surprise check', () => {
  const withTorch = (remaining: number) => {
    const s = fresh()
    return { ...s, torch: { ...s.torch, remaining } }
  }

  it('gets +1 to the party’s awareness from a bright torch', () => {
    expect(surpriseCheckFor(fresh()).modifiers).toEqual([{ label: 'Bright torch', value: 1 }])
  })

  it('has no modifier for a steady torch, -1 for dim and -2 once it is out', () => {
    expect(surpriseCheckFor(withTorch(4)).modifiers).toEqual([])
    expect(surpriseCheckFor(withTorch(2)).modifiers).toEqual([{ label: 'Dim torch', value: -1 }])
    expect(surpriseCheckFor(withTorch(0)).modifiers).toEqual([{ label: 'No torch', value: -2 }])
  })

  it('adds the watch bonus on top of the torch', () => {
    const s = { ...fresh(), watch: STAND_WATCH }
    expect(surpriseCheckFor(s).modifiers).toEqual([STAND_WATCH, { label: 'Bright torch', value: 1 }])
    expect(STAND_WATCH.value).toBe(2)
  })

  it('gives each player the watch and torch as bonuses to their Perception test when the patrol arrives', () => {
    const s = dungeonReducer({ ...fresh(), watch: STAND_WATCH }, { type: 'startBattle', rng })
    const looks = s.battle!.opening.filter((o) => o.title === 'Look out!')
    expect(looks).toHaveLength(s.party.length)
    expect(looks[0].test!.bonuses).toEqual([STAND_WATCH, { label: 'Bright torch', value: 1 }])
  })

  it('takes away a bonus once the torch is dim and nobody is watching', () => {
    const s = dungeonReducer(withTorch(2), { type: 'startBattle', rng })
    const look = s.battle!.opening.find((o) => o.title === 'Look out!')!
    expect(look.test!.bonuses).toEqual([{ label: 'Dim torch', value: -1 }])
  })

  it('forgets watching as soon as the party moves', () => {
    const s = dungeonReducer({ ...fresh(), watch: KEEP_WATCH }, { type: 'moveTo', roomId: 'greatHall', rng })
    expect(s.watch).toBeNull()
  })
})

describe('locks', () => {
  it('start with the entrance door locked, hiding everything beyond it', () => {
    const s = freshLocked()
    expect(s.explored).toEqual(['entrance'])
    expect(adjacentRoomIds(s.dungeon, 'entrance', passagesOf(s))).toEqual([])
    expect(lockedExits(s.dungeon, 'entrance', passagesOf(s)).map((e) => e.lock.id)).toEqual(['entranceDoor'])
  })

  it('refuse to be walked through until they are opened', () => {
    const s = freshLocked()
    expect(dungeonReducer(s, { type: 'moveTo', roomId: 'greatHall', rng })).toBe(s)
    const open = unlockLock(s, 'entranceDoor')
    expect(dungeonReducer(open, { type: 'moveTo', roomId: 'greatHall', rng }).roomId).toBe('greatHall')
  })

  it('show what is beyond a door as soon as it opens', () => {
    expect(unlockLock(freshLocked(), 'entranceDoor').explored).toContain('greatHall')
  })

  it('keep the seal on the crypt shut regardless of the first door', () => {
    const s = { ...fresh(), roomId: 'shrine' }
    expect(lockedExits(s.dungeon, 'shrine', passagesOf(s)).map((e) => e.lock.id)).toEqual(['foundersSeal'])
    expect(adjacentRoomIds(s.dungeon, 'shrine', passagesOf(s))).not.toContain('crypt')
  })

  it('stop the light reaching through a locked door', () => {
    const open = new Set(visibleRoomIds(SUNKEN_CRYPT, 'greatHall', 'bright', { discovered: [], unlocked: lockIds }))
    const shut = new Set(visibleRoomIds(SUNKEN_CRYPT, 'greatHall', 'bright', NO_PASSAGES))
    expect(open.has('entrance')).toBe(true)
    expect(shut.has('entrance')).toBe(false)
    expect(shut.has('crypt')).toBe(false)
  })

  it('make every lock identifiable and every seal requirement a real interaction', () => {
    expect(new Set(lockIds).size).toBe(lockIds.length)
    for (const status of sealStatuses(freshLocked())) {
      for (const r of status.lock.requires) {
        const [kind, roomId, interactionId] = r.flag.split(':')
        expect(kind).toBe('interaction')
        const room = SUNKEN_CRYPT.rooms.find((x) => x.id === roomId)
        expect(room?.interactions.some((i) => i.id === interactionId), r.flag).toBe(true)
      }
    }
  })
})

describe('the patrol clock', () => {
  it('does not run until the first lock is opened', () => {
    const s = { ...freshLocked(), intervals: 20 }
    expect(patrolIsDue(s)).toBe(false)
    expect(patrolCountdown(s)).toBeNull()
  })

  it('starts the moment the first lock opens', () => {
    const s = { ...freshLocked(), intervals: 3 }
    const open = unlockLock(s, 'entranceDoor')
    expect(open.patrolStartedAt).toBe(3)
    expect(patrolCountdown(open)).toBe(SUNKEN_CRYPT.patrol.delayAfterUnlock)
  })

  it('is not restarted by opening a second lock', () => {
    const first = unlockLock({ ...freshLocked(), intervals: 1 }, 'entranceDoor')
    const second = unlockLock({ ...first, intervals: 6 }, 'foundersSeal')
    expect(second.patrolStartedAt).toBe(1)
  })

  it('makes the patrol due after the delay', () => {
    const s = fresh()
    expect(patrolIsDue({ ...s, intervals: SUNKEN_CRYPT.patrol.delayAfterUnlock - 1 })).toBe(false)
    expect(patrolIsDue({ ...s, intervals: SUNKEN_CRYPT.patrol.delayAfterUnlock })).toBe(true)
  })
})

describe('the Founders’ Seal', () => {
  const flags = SUNKEN_CRYPT.links.flatMap((l) => (l.lock?.kind === 'seal' ? l.lock.requires.map((r) => r.flag) : []))

  it('stays shut until everything it asks for has been done', () => {
    const partial = { ...fresh(), done: flags.slice(0, flags.length - 1) }
    const result = breakReadySeals(partial)
    expect(result.messages).toEqual([])
    expect(result.state.unlocked).not.toContain('foundersSeal')
  })

  it('breaks once every requirement is met, and says so', () => {
    const result = breakReadySeals({ ...fresh(), done: flags })
    expect(result.state.unlocked).toContain('foundersSeal')
    expect(result.messages[0]).toMatch(/shatters/)
  })

  it('does not break twice', () => {
    const once = breakReadySeals({ ...fresh(), done: flags })
    expect(breakReadySeals(once.state).messages).toEqual([])
  })
})

describe('the boss', () => {
  const atShrine = () => ({ ...fresh(), roomId: 'shrine', unlocked: [...fresh().unlocked, 'foundersSeal'] })

  it('rises when the party enters its room, with no chance to surprise anyone', () => {
    const s = dungeonReducer(atShrine(), { type: 'moveTo', roomId: 'crypt', rng })
    expect(s.battle).not.toBeNull()
    expect(s.battleKind).toBe('boss')
    expect(s.battle!.enemies.map((e) => e.defId)).toEqual(SUNKEN_CRYPT.boss.enemyIds)
    expect(s.battle!.opening.some((o) => o.title === 'Surprise?')).toBe(false)
  })

  it('takes the place of the patrol', () => {
    const s = dungeonReducer(atShrine(), { type: 'moveTo', roomId: 'crypt', rng })
    expect(s.patrolTriggered).toBe(true)
    expect(s.bossTriggered).toBe(true)
  })

  it('only appears once', () => {
    let s = dungeonReducer(atShrine(), { type: 'moveTo', roomId: 'crypt', rng })
    s = endBattle({ ...s, battle: { ...s.battle!, result: 'defeat' } })
    s = { ...s, roomId: 'shrine' }
    expect(dungeonReducer(s, { type: 'moveTo', roomId: 'crypt', rng }).battle).toBeNull()
  })

  it('completes the tutorial when the party wins', () => {
    const s = dungeonReducer(atShrine(), { type: 'moveTo', roomId: 'crypt', rng })
    const won = endBattle({ ...s, battle: { ...s.battle!, result: 'victory' } })
    expect(won.completed).toBe(true)
    expect(won.log[0]).toMatch(/Warden/)
  })

  it('does not complete the tutorial after the patrol', () => {
    const s = dungeonReducer(fresh(), { type: 'startBattle', rng })
    const won = endBattle({ ...s, battle: { ...s.battle!, result: 'victory' } })
    expect(won.completed).toBe(false)
  })
})

describe('limitTorches', () => {
  const member = (key: string, torch: number) => testMember(key, torch)

  it('keeps spare torches in party order until the limit and leaves the rest behind', () => {
    const party = limitTorches([member('a', 2), member('b', 2), member('c', 5)])
    expect(party.map((m) => m.inventory.torch)).toEqual([2, 1, 0])
  })

  it('leaves a party under the limit alone', () => {
    expect(limitTorches([member('a', 1), member('b', 1)]).map((m) => m.inventory.torch)).toEqual([1, 1])
  })
})
