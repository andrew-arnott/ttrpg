import { describe, expect, it } from 'vitest'
import { linkKey, SUNKEN_CRYPT } from '../data/dungeon'
import { HOLY_TORCH, ORDINARY_TORCH } from '../data/items'
import { mulberry32 } from './drawTest'
import {
  adjacentRoomIds,
  createDungeonState,
  KEEP_WATCH,
  REST_BONUS_LIMIT,
  STAND_WATCH,
  type DungeonState,
} from './dungeonState'
import { availableActions, resolveInterval, type InteractionPlan } from './intervalActions'
import { createPartyMember } from './partyMember'
import { sampleRoster } from './roster'
import { ALWAYS_FAIL, ALWAYS_PASS, bagOf, testMember } from './testFixtures'
import { torchLevel, totalIntervals } from './torch'

const rng = () => mulberry32(1)
const flat = { strength: 1, perception: 1, endurance: 1, charisma: 1, intelligence: 1, agility: 1, luck: 1 }

const stateWith = (...members: ReturnType<typeof testMember>[]): DungeonState =>
  createDungeonState(SUNKEN_CRYPT, members)

const sampleMember = (professionId: string, key = professionId) => {
  const entry = sampleRoster().find((r) => r.key === `sample:${professionId}`)!
  return createPartyMember(key, entry.draft)
}

describe('availableActions', () => {
  it('always offers search, rest, keep watch and the room interaction', () => {
    const s = stateWith(testMember('a', 1))
    const options = availableActions(s, s.party[0])
    expect(options.map((o) => o.id).slice(0, 4)).toEqual(['search', 'rest', 'watch', 'interact'])
    expect(options.find((o) => o.id === 'interact')!.label).toBe(
      'Room interaction: read the worn inscription over the door',
    )
  })

  it('offers only the Interval abilities a character actually chose', () => {
    const s = stateWith(sampleMember('rogue'))
    const ids = availableActions(s, s.party[0]).map((o) => o.id)
    expect(ids).toContain('ability:scoutAhead')
    expect(ids).toContain('ability:findAShortcut')
    expect(ids).not.toContain('ability:caseTheJoint')
    expect(ids.some((id) => id.includes('backstab'))).toBe(false)
  })

  it('points targeted abilities at the exits', () => {
    const s = stateWith(sampleMember('rogue'))
    const scout = availableActions(s, s.party[0]).find((o) => o.id === 'ability:scoutAhead')!
    expect(scout.targets?.map((r) => r.id)).toEqual(['greatHall'])
  })

  it('disables Holy Light without a torch to consume', () => {
    const priest = sampleMember('priest')
    const none = stateWith({ ...priest, inventory: {} })
    expect(availableActions(none, none.party[0]).find((o) => o.id === 'ability:holyLight')!.disabledReason).toBeTruthy()
    const some = stateWith(priest)
    expect(availableActions(some, some.party[0]).find((o) => o.id === 'ability:holyLight')!.disabledReason).toBeUndefined()
  })
})

describe('resolveInterval', () => {
  it('resolves characters in party order, then burns the torch', () => {
    const s = stateWith(testMember('a', 0), testMember('b', 0), testMember('c', 0))
    const { state, steps } = resolveInterval(s, {}, rng())
    expect(steps.map((st) => st.actor?.key ?? null)).toEqual(['a', 'b', 'c', null])
    expect(state.intervals).toBe(1)
    expect(state.torch.remaining).toBe(totalIntervals(ORDINARY_TORCH) - 1)
  })

  it('defaults anyone without a plan to keeping watch', () => {
    const { steps } = resolveInterval(stateWith(testMember('a', 0)), {}, rng())
    expect(steps[0].title).toBe('Keep watch')
    expect(steps[0].tone).toBe('neutral')
  })

  it('does not mutate the state it was given', () => {
    const s = stateWith(testMember('a', 1, { bag: ALWAYS_PASS }))
    const snapshot = JSON.stringify(s)
    resolveInterval(s, { a: { actionId: 'search' } }, rng())
    expect(JSON.stringify(s)).toBe(snapshot)
  })

  describe('searching', () => {
    it('finds the secret on a passed test and adds the reward to that character', () => {
      const s = stateWith(testMember('a', 0, { bag: ALWAYS_PASS }), testMember('b', 0))
      const { state, steps } = resolveInterval(s, { a: { actionId: 'search' } }, rng())
      expect(steps[0].test?.passed).toBe(true)
      expect(steps[0].tone).toBe('success')
      expect(steps[0].outcome).toMatch(/satchel/)
      expect(state.party[0].inventory.torch).toBe(1)
      expect(state.party[1].inventory.torch).toBe(0)
      expect(state.done).toContain('secret:entrance')
    })

    it('leaves the secret to find on a failed test', () => {
      const s = stateWith(testMember('a', 0, { bag: ALWAYS_FAIL }))
      const { state, steps } = resolveInterval(s, { a: { actionId: 'search' } }, rng())
      expect(steps[0].test?.passed).toBe(false)
      expect(steps[0].tone).toBe('failure')
      expect(state.done).not.toContain('secret:entrance')
      expect(availableActions(state, state.party[0]).find((o) => o.id === 'search')!.disabledReason).toBeUndefined()
    })

    it('stops offering a search once the room has been searched', () => {
      const s = stateWith(testMember('a', 0, { bag: ALWAYS_PASS }))
      const { state } = resolveInterval(s, { a: { actionId: 'search' } }, rng())
      expect(availableActions(state, state.party[0]).find((o) => o.id === 'search')!.disabledReason).toBeTruthy()
    })

    it('uses Perception plus the token total against the Difficulty', () => {
      const bag = bagOf('plus3')
      const pass = resolveInterval(
        stateWith(testMember('a', 0, { bag, special: { ...flat, perception: 1 } })),
        { a: { actionId: 'search' } },
        rng(),
      )
      expect(pass.steps[0].test).toMatchObject({ attribute: 'perception', total: 4, difficulty: 4, passed: true })
      const fail = resolveInterval(
        stateWith(testMember('a', 0, { bag: bagOf('plus1'), special: { ...flat, perception: 1 } })),
        { a: { actionId: 'search' } },
        rng(),
      )
      expect(fail.steps[0].test).toMatchObject({ total: 2, passed: false })
    })

    it('makes tests harder once the torch has gone out', () => {
      const lit = stateWith(testMember('a', 0, { bag: bagOf('plus3'), special: flat }))
      const dark = { ...lit, torch: { ...lit.torch, remaining: 0 } }
      expect(torchLevel(dark.torch)).toBe('out')
      const plan: InteractionPlan = { a: { actionId: 'search' } }
      expect(resolveInterval(lit, plan, rng()).steps[0].test?.passed).toBe(true)
      const darkStep = resolveInterval(dark, plan, rng()).steps[0]
      expect(darkStep.test?.passed).toBe(false)
      expect(darkStep.test?.penalty).toBeGreaterThan(0)
      expect(darkStep.intro).toMatch(/too dark/)
    })
  })

  describe('resting', () => {
    it('regains one of the profession resource', () => {
      const m = sampleMember('warrior', 'w')
      const s = stateWith(m)
      const { state, steps } = resolveInterval(s, { w: { actionId: 'rest' } }, rng())
      expect(state.party[0].resources.resolve).toBe((m.resources.resolve ?? 0) + 1)
      expect(steps[0].outcome).toMatch(/regains 1 Resolve/)
    })

    it('stops at a small bonus over the starting amount', () => {
      let s = stateWith(sampleMember('priest', 'p'))
      const start = s.party[0].startingResources.faith
      for (let i = 0; i < REST_BONUS_LIMIT + 3; i++) {
        s = resolveInterval(s, { p: { actionId: 'rest' } }, rng()).state
      }
      expect(s.party[0].resources.faith).toBe(start + REST_BONUS_LIMIT)
      expect(availableActions(s, s.party[0]).find((o) => o.id === 'rest')!.disabledReason).toBeTruthy()
    })
  })

  describe('room interactions', () => {
    it('resolves with the room-specific text and marks it done', () => {
      const s = stateWith(testMember('a', 0, { bag: ALWAYS_PASS }))
      const { state, steps } = resolveInterval(s, { a: { actionId: 'interact' } }, rng())
      expect(steps[0].test?.attribute).toBe('intelligence')
      expect(steps[0].outcome).toMatch(/burial rite/)
      expect(state.done).toContain('interaction:entrance')
    })

    it('shows the failure text and can be retried', () => {
      const s = stateWith(testMember('a', 0, { bag: ALWAYS_FAIL }))
      const { state, steps } = resolveInterval(s, { a: { actionId: 'interact' } }, rng())
      expect(steps[0].outcome).toMatch(/worn and weathered/)
      expect(availableActions(state, state.party[0]).find((o) => o.id === 'interact')!.disabledReason).toBeUndefined()
    })
  })

  describe('class abilities', () => {
    it('Holy Light consumes a torch and lights an 8 Interval holy torch', () => {
      const s = stateWith(sampleMember('priest', 'p'))
      const before = s.party[0].inventory.torch
      const { state } = resolveInterval(s, { p: { actionId: 'ability:holyLight' } }, rng())
      expect(state.party[0].inventory.torch).toBe(before - 1)
      expect(state.torch.spec).toEqual(HOLY_TORCH)
      expect(state.torch.remaining).toBe(totalIntervals(HOLY_TORCH) - 1)
    })

    it('falls back to keeping watch when Holy Light cannot be used', () => {
      const s = stateWith({ ...sampleMember('priest', 'p'), inventory: {} })
      const { state, steps } = resolveInterval(s, { p: { actionId: 'ability:holyLight' } }, rng())
      expect(steps[0].title).toBe('Keep watch')
      expect(state.torch.spec).toEqual(ORDINARY_TORCH)
    })

    it('Find a Shortcut reveals the hidden passage, which then becomes a usable exit', () => {
      const s = stateWith(sampleMember('rogue', 'r'))
      const { state, steps } = resolveInterval(s, { r: { actionId: 'ability:findAShortcut' } }, rng())
      const hidden = SUNKEN_CRYPT.links.find((l) => l.hidden)!
      expect(steps[0].tone).toBe('success')
      expect(state.discovered).toContain(linkKey(hidden))
      expect(adjacentRoomIds(state.dungeon, state.roomId, state.discovered)).toContain('storeroom')
    })

    it('Find a Shortcut finds nothing where there is no hidden route', () => {
      const s = { ...stateWith(sampleMember('rogue', 'r')), roomId: 'library' }
      const { steps } = resolveInterval(s, { r: { actionId: 'ability:findAShortcut' } }, rng())
      expect(steps[0].tone).toBe('neutral')
    })

    it('Scout Ahead reveals the chosen neighbouring room on the map', () => {
      const s = {
        ...stateWith(sampleMember('rogue', 'r')),
        roomId: 'greatHall',
        explored: ['greatHall'],
      }
      const { state, steps } = resolveInterval(
        s,
        { r: { actionId: 'ability:scoutAhead', targetRoomId: 'shrine' } },
        rng(),
      )
      expect(state.explored).toContain('shrine')
      expect(state.roomId).toBe('greatHall')
      expect(steps[0].outcome).toMatch(/altar/)
    })

    it('Group Heal restores 1 HP to hurt party members only', () => {
      const priest = sampleMember('priest', 'p')
      const hurt = { ...testMember('h', 0), hp: 3, maxHp: 10 }
      const s = stateWith(priest, hurt)
      const { state, steps } = resolveInterval(s, { p: { actionId: 'ability:groupHeal' } }, rng())
      expect(state.party.find((m) => m.key === 'h')!.hp).toBe(4)
      expect(state.party.find((m) => m.key === 'p')!.hp).toBe(priest.maxHp)
      expect(steps[0].outcome).toMatch(/h recovers 1 HP/)
    })

    it('Fortify and Barricade leave a preparation on the room', () => {
      const warrior = { ...sampleMember('warrior', 'w') }
      const s = stateWith({ ...warrior, abilityIds: [...warrior.abilityIds, 'barricade'] })
      const { state } = resolveInterval(s, { w: { actionId: 'ability:fortify' } }, rng())
      expect(state.prepared.entrance.map((p) => p.tag)).toEqual(['Fortified'])
      expect(state.prepared.entrance[0].memberKey).toBe('w')
      const barricaded = resolveInterval(state, { w: { actionId: 'ability:barricade', targetRoomId: 'greatHall' } }, rng())
      expect(barricaded.state.prepared.entrance.map((p) => p.tag)).toEqual([
        'Fortified',
        'Barricaded toward Great Hall',
      ])
    })

    it('Dispel Magic tests Intelligence against the room magic', () => {
      const wizard = { ...sampleMember('wizard', 'z'), bag: ALWAYS_PASS }
      const s = { ...stateWith(wizard), roomId: 'shrine' }
      const { state, steps } = resolveInterval(s, { z: { actionId: 'ability:dispelMagic' } }, rng())
      expect(steps[0].test?.attribute).toBe('intelligence')
      expect(steps[0].tone).toBe('success')
      expect(state.done).toContain('dispelled:shrine')
    })

    it('Detect Magic describes the magic in a room, and the lack of it elsewhere', () => {
      const wizard = sampleMember('wizard', 'z')
      const shrine = resolveInterval({ ...stateWith(wizard), roomId: 'shrine' }, { z: { actionId: 'ability:detectMagic' } }, rng())
      expect(shrine.steps[0].outcome).toMatch(/pulse/)
      const plain = resolveInterval(stateWith(wizard), { z: { actionId: 'ability:detectMagic' } }, rng())
      expect(plain.steps[0].tone).toBe('neutral')
    })
  })

  it('applies each character’s result before the next acts', () => {
    const s = stateWith(
      testMember('a', 0, { bag: ALWAYS_PASS }),
      testMember('b', 0, { bag: ALWAYS_PASS }),
    )
    const { steps, state } = resolveInterval(
      s,
      { a: { actionId: 'search' }, b: { actionId: 'search' } },
      rng(),
    )
    expect(steps[0].tone).toBe('success')
    expect(steps[1].title).toBe('Keep watch')
    expect(state.party[0].inventory.torch).toBe(1)
  })
})

describe('watching during an Interval', () => {
  it('records Stand Watch for the surprise check', () => {
    const s = stateWith(sampleMember('warrior', 'w'))
    const { state } = resolveInterval(s, { w: { actionId: 'ability:standWatch' } }, rng())
    expect(state.watch).toEqual(STAND_WATCH)
  })

  it('records the weaker Keep watch, including by default', () => {
    const s = stateWith(testMember('a', 0))
    expect(resolveInterval(s, { a: { actionId: 'watch' } }, rng()).state.watch).toEqual(KEEP_WATCH)
    expect(resolveInterval(s, {}, rng()).state.watch).toEqual(KEEP_WATCH)
  })

  it('takes the best watch when several characters watch', () => {
    const s = stateWith(testMember('a', 0), sampleMember('warrior', 'w'))
    const { state } = resolveInterval(
      s,
      { a: { actionId: 'watch' }, w: { actionId: 'ability:standWatch' } },
      rng(),
    )
    expect(state.watch).toEqual(STAND_WATCH)
  })

  it('records nothing when everyone is busy with something else', () => {
    const s = stateWith(testMember('a', 0, { bag: ALWAYS_FAIL }))
    expect(resolveInterval(s, { a: { actionId: 'search' } }, rng()).state.watch).toBeNull()
  })

  it('warns watchers one Interval before the patrol, but not anyone else', () => {
    const base = { ...stateWith(testMember('a', 0)), intervals: 2 }
    const watched = resolveInterval(base, { a: { actionId: 'watch' } }, rng())
    expect(watched.steps[watched.steps.length - 1].outcome).toMatch(/patrol is close/)
    const busy = resolveInterval(base, { a: { actionId: 'search' } }, rng())
    expect(busy.steps[busy.steps.length - 1].outcome).not.toMatch(/patrol is close/)
  })
})
