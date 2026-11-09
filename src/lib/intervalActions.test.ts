import { describe, expect, it } from 'vitest'
import { interactionFlag, linkKey, SUNKEN_CRYPT } from '../data/dungeon'
import { HOLY_TORCH, ORDINARY_TORCH } from '../data/items'
import { mulberry32 } from './drawTest'
import {
  adjacentRoomIds,
  createDungeonState,
  KEEP_WATCH,
  passagesOf,
  STAND_WATCH,
  unlockLock,
  type DungeonState,
  type PartyMember,
} from './dungeonState'
import { availableActions, resolveInterval, respondToIntervalReaction, type InteractionPlan } from './intervalActions'
import { createPartyMember } from './partyMember'
import { sampleRoster } from './roster'
import { ALWAYS_FAIL, ALWAYS_PASS, bagOf, testMember } from './testFixtures'
import { torchLevel, totalIntervals } from './torch'

const rng = () => mulberry32(1)
const flat = { strength: 1, perception: 1, endurance: 1, charisma: 1, intelligence: 1, agility: 1, luck: 1 }

const stateWith = (...members: ReturnType<typeof testMember>[]): DungeonState =>
  createDungeonState(SUNKEN_CRYPT, members)

const watchman = (key: string) => ({ ...sampleMember('warrior', key), abilityIds: ['standWatch'] })

const sampleMember = (professionId: string, key = professionId) => {
  const entry = sampleRoster().find((r) => r.key === `sample:${professionId}`)!
  return createPartyMember(key, entry.draft)
}

describe('availableActions', () => {
  it('always offers search, rest, keep watch and the room interaction', () => {
    const s = stateWith(testMember('a', 1))
    const options = availableActions(s, s.party[0])
    expect(options.map((o) => o.id).slice(0, 4)).toEqual(['search', 'rest', 'watch', 'interact:inscription'])
    expect(options.find((o) => o.id === 'interact:inscription')!.label).toBe(
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
    const s = unlockLock(stateWith(sampleMember('rogue')), 'entranceDoor')
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
    const spent = (member: PartyMember, tokenId: string): PartyMember => ({
      ...member,
      resources: { ...member.resources, [tokenId]: (member.resources[tokenId] ?? 0) - 1 },
      bag: [...member.bag, { tokenId, count: 1 }],
    })

    it('recovers a spent profession resource from the bag into play', () => {
      const m = spent(sampleMember('warrior', 'w'), 'resolve')
      const { state, steps } = resolveInterval(stateWith(m), { w: { actionId: 'rest' } }, rng())
      expect(state.party[0].resources.resolve).toBe((m.resources.resolve ?? 0) + 1)
      expect(state.party[0].bag.find((s) => s.tokenId === 'resolve')).toBeUndefined()
      expect(steps[0].outcome).toMatch(/recovers 1 Resolve/)
    })

    it('recovers Expertise when the profession resource is all in play', () => {
      const m = sampleMember('priest', 'p')
      expect(m.bag.some((s) => s.tokenId === 'expertise')).toBe(true)
      const { state } = resolveInterval(stateWith(m), { p: { actionId: 'rest' } }, rng())
      expect(state.party[0].resources.expertise).toBe(1)
    })

    it('is not offered when the bag holds no resource to recover', () => {
      const m = { ...sampleMember('priest', 'p'), bag: [{ tokenId: 'plus1', count: 3 }] }
      const s = stateWith(m)
      expect(availableActions(s, s.party[0]).find((o) => o.id === 'rest')!.disabledReason).toMatch(/Faith/)
    })
  })

  describe('after a test', () => {
    const searcher = (bag: PartyMember['bag'], extra: Partial<PartyMember> = {}) =>
      testMember('a', 0, { special: { strength: 1, perception: 1, endurance: 1, charisma: 1, intelligence: 1, agility: 1, luck: 1 }, bag, ...extra })
    const search: InteractionPlan = { a: { actionId: 'search' } }

    it('puts drawn resource tokens in play', () => {
      const s = stateWith(searcher([{ tokenId: 'expertise', count: 10 }, { tokenId: 'plus0', count: 1 }]))
      const { state, steps } = resolveInterval(s, search, rng())
      const drawn = steps[0].test!.result.drawn.filter((d) => d.tokenId === 'expertise').length
      expect(state.party[0].resources.expertise ?? 0).toBe(drawn)
    })

    it('seals a condition drawn in a failed test, hurts for Poison, and releases it when the Interval ends', () => {
      const s = stateWith(searcher([{ tokenId: 'poison', count: 1 }], { hp: 5 }))
      const { state, steps } = resolveInterval(s, search, rng())
      expect(steps[0].outcome).toMatch(/Poison is sealed on a\. a takes 1 poison damage \(4\/\d+ HP\)/)
      expect(state.party[0].hp).toBe(4)
      expect(state.party[0].sealedConditions).toEqual([])
      expect(state.party[0].bag.find((t) => t.tokenId === 'poison')?.count).toBe(1)
    })

    it('never lets a condition take someone below 1 HP', () => {
      const s = stateWith(searcher([{ tokenId: 'poison', count: 1 }], { hp: 1 }))
      expect(resolveInterval(s, search, rng()).state.party[0].hp).toBe(1)
    })

    it('keeps Shield tokens drawn in play', () => {
      const s = stateWith(searcher(bagOf('shield'), { hp: 5 }))
      const first = resolveInterval(s, search, rng()).state
      expect(first.party[0].shieldsInPlay).toBeGreaterThan(0)
    })
  })

  describe('Prayer', () => {
    const party = () => {
      const priest = { ...sampleMember('priest', 'p'), abilityIds: ['prayer'] }
      const tester = testMember('a', 0, { bag: bagOf('plus0') })
      return stateWith(tester, priest)
    }
    const search: InteractionPlan = { a: { actionId: 'search' } }

    it('stops the Interval to ask whether the priest prays for a failed test', () => {
      const first = resolveInterval(party(), search, rng())
      expect(first.state.pending?.request).toMatchObject({ abilityId: 'prayer', reactorKey: 'p' })
      expect(first.steps).toEqual([])
      expect(resolveInterval(first.state, search, rng()).steps).toEqual([])
    })

    it('adds +2 and spends 2 Faith when accepted, then finishes the Interval', () => {
      const first = resolveInterval(party(), search, rng())
      const done = respondToIntervalReaction(first.state, { use: true }, rng())
      expect(done.state.pending).toBeNull()
      expect(done.steps[0].test?.bonuses).toEqual([{ label: 'Prayer (Sister Maren)', value: 2 }])
      const priest = done.state.party.find((m) => m.key === 'p')!
      expect(priest.resources.faith).toBe(1)
      expect(done.steps.at(-1)!.title).toBe('The Interval ends')
    })

    it('carries on unchanged when declined', () => {
      const first = resolveInterval(party(), search, rng())
      const done = respondToIntervalReaction(first.state, { use: false }, rng())
      expect(done.steps[0].test?.bonuses).toEqual([])
      expect(done.state.party.find((m) => m.key === 'p')!.resources.faith).toBe(3)
    })

    it('does not ask when nobody can pray', () => {
      const s = stateWith(testMember('a', 0, { bag: bagOf('plus0') }), testMember('b', 0))
      expect(resolveInterval(s, search, rng()).state.pending).toBeFalsy()
    })
  })

  describe('Tend the Afflicted', () => {
    const tending = () => {
      const priest = { ...sampleMember('priest', 'p'), abilityIds: ['tendTheAfflicted'], inventory: { antivenom: 1 } }
      const patient = testMember('b', 0, { bag: [{ tokenId: 'poison', count: 1 }, ...ALWAYS_FAIL] })
      return stateWith(priest, patient)
    }

    it('is offered for each treatable condition the priest has the item for', () => {
      const s = tending()
      const ids = availableActions(s, s.party[0]).map((o) => o.id)
      expect(ids).toContain('ability:tendTheAfflicted:antivenom:b')
      expect(ids).not.toContain('ability:tendTheAfflicted')
    })

    it('removes the token with no test, even for someone who would fail it, and uses the item up', () => {
      const s = tending()
      const { state, steps } = resolveInterval(s, { p: { actionId: 'ability:tendTheAfflicted:antivenom:b' } }, rng())
      expect(steps[0].test).toBeUndefined()
      expect(state.party[1].bag.find((t) => t.tokenId === 'poison')).toBeUndefined()
      expect(state.party[0].inventory.antivenom).toBe(0)
    })
  })

  describe('treating conditions', () => {
    const afflicted = (bag: PartyMember['bag']) =>
      stateWith(
        testMember('a', 0, { inventory: { antivenom: 1 }, bag: [{ tokenId: 'poison', count: 1 }, ...bag] }),
        testMember('b', 0),
      )

    it('offers treatment only for a condition someone has in their bag, with the matching item', () => {
      const s = afflicted(bagOf('plus1'))
      const ids = availableActions(s, s.party[0]).map((o) => o.id)
      expect(ids).toContain('treat:antivenom:a')
      expect(ids).not.toContain('treat:antivenom:b')
      expect(availableActions(s, s.party[1]).map((o) => o.id).some((id) => id.startsWith('treat:'))).toBe(false)
    })

    it('removes the token for good on a success, and uses the item up', () => {
      const s = afflicted(ALWAYS_PASS)
      const { state, steps } = resolveInterval(s, { a: { actionId: 'treat:antivenom:a' } }, rng())
      expect(state.party[0].bag.find((t) => t.tokenId === 'poison')).toBeUndefined()
      expect(state.party[0].inventory.antivenom).toBe(0)
      expect(steps[0].outcome).toMatch(/removed from a/)
    })

    it('keeps the token on a failure but still uses the item up', () => {
      const s = afflicted(ALWAYS_FAIL)
      const { state } = resolveInterval(s, { a: { actionId: 'treat:antivenom:a' } }, rng())
      expect(state.party[0].bag.find((t) => t.tokenId === 'poison')?.count).toBe(1)
      expect(state.party[0].inventory.antivenom).toBe(0)
    })
  })

  describe('room interactions', () => {
    it('resolves with the room-specific text and marks it done', () => {
      const s = stateWith(testMember('a', 0, { bag: ALWAYS_PASS }))
      const { state, steps } = resolveInterval(s, { a: { actionId: 'interact:inscription' } }, rng())
      expect(steps[0].test?.attribute).toBe('intelligence')
      expect(steps[0].outcome).toMatch(/burial rite/)
      expect(state.done).toContain(interactionFlag('entrance', 'inscription'))
    })

    it('shows the failure text and can be retried', () => {
      const s = stateWith(testMember('a', 0, { bag: ALWAYS_FAIL }))
      const { state, steps } = resolveInterval(s, { a: { actionId: 'interact:inscription' } }, rng())
      expect(steps[0].outcome).toMatch(/worn and weathered/)
      expect(availableActions(state, state.party[0]).find((o) => o.id === 'interact:inscription')!.disabledReason).toBeUndefined()
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
      const hidden = SUNKEN_CRYPT.links.find((l) => l.hidden)!
      const s = { ...stateWith(sampleMember('rogue', 'r')), roomId: hidden.from }
      const { state, steps } = resolveInterval(s, { r: { actionId: 'ability:findAShortcut' } }, rng())
      expect(steps[0].tone).toBe('success')
      expect(state.discovered).toContain(linkKey(hidden))
      expect(adjacentRoomIds(state.dungeon, state.roomId, passagesOf(state))).toContain(hidden.to)
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
      const s = unlockLock(stateWith({ ...warrior, abilityIds: [...warrior.abilityIds, 'barricade'] }), 'entranceDoor')
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
    const s = stateWith(watchman('w'))
    const { state } = resolveInterval(s, { w: { actionId: 'ability:standWatch' } }, rng())
    expect(state.watch).toEqual(STAND_WATCH)
  })

  it('records Keep watch, including by default', () => {
    const s = stateWith(testMember('a', 0))
    expect(resolveInterval(s, { a: { actionId: 'watch' } }, rng()).state.watch).toEqual(KEEP_WATCH)
    expect(resolveInterval(s, {}, rng()).state.watch).toEqual(KEEP_WATCH)
  })

  it('takes the best watch when several characters watch', () => {
    const s = stateWith(testMember('a', 0), watchman('w'))
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
    const base = { ...stateWith(testMember('a', 0)), intervals: 2, patrolStartedAt: 0 }
    const watched = resolveInterval(base, { a: { actionId: 'watch' } }, rng())
    expect(watched.steps[watched.steps.length - 1].outcome).toMatch(/patrol is close/)
    const busy = resolveInterval(base, { a: { actionId: 'search' } }, rng())
    expect(busy.steps[busy.steps.length - 1].outcome).not.toMatch(/patrol is close/)
  })
})

describe('locked doors', () => {
  const pick = { a: { actionId: 'unlock:entranceDoor:pick' as const } }
  const smash = { a: { actionId: 'unlock:entranceDoor:break' as const } }

  it('offers lockpicking (Agility) and breaking the door down (Strength) where there is a locked door', () => {
    const s = stateWith(testMember('a', 1))
    const options = availableActions(s, s.party[0])
    expect(options.map((o) => o.id)).toContain('unlock:entranceDoor:pick')
    expect(options.map((o) => o.id)).toContain('unlock:entranceDoor:break')
    expect(options.find((o) => o.id === 'unlock:entranceDoor:pick')!.description).toMatch(/Agility/)
    expect(options.find((o) => o.id === 'unlock:entranceDoor:break')!.description).toMatch(/Strength/)
  })

  it('opens the door when the test passes, and starts the patrol clock', () => {
    const s = stateWith(testMember('a', 0, { bag: ALWAYS_PASS }))
    const { state, steps } = resolveInterval(s, pick, rng())
    expect(steps[0].test?.attribute).toBe('agility')
    expect(steps[0].tone).toBe('success')
    expect(state.unlocked).toContain('entranceDoor')
    expect(state.patrolStartedAt).toBe(0)
    expect(state.explored).toContain('greatHall')
    expect(steps[0].outcome).toMatch(/stir/)
  })

  it('tests Strength to break the door down', () => {
    const s = stateWith(testMember('a', 0, { bag: ALWAYS_PASS }))
    const { state, steps } = resolveInterval(s, smash, rng())
    expect(steps[0].test?.attribute).toBe('strength')
    expect(state.unlocked).toContain('entranceDoor')
  })

  it('leaves the door shut on a failure, and lets the party try again', () => {
    let s = stateWith(testMember('a', 0, { bag: ALWAYS_FAIL }))
    for (let i = 0; i < 3; i++) {
      const result = resolveInterval(s, pick, rng())
      expect(result.steps[0].tone).toBe('failure')
      expect(result.state.unlocked).toEqual([])
      expect(availableActions(result.state, result.state.party[0]).map((o) => o.id)).toContain(
        'unlock:entranceDoor:pick',
      )
      s = result.state
    }
  })

  it('makes every attempt cost an Interval of torch', () => {
    let s = stateWith(testMember('a', 0, { bag: ALWAYS_FAIL }))
    const start = s.torch.remaining
    for (let i = 0; i < 3; i++) s = resolveInterval(s, pick, rng()).state
    expect(s.intervals).toBe(3)
    expect(s.torch.remaining).toBe(start - 3)
  })

  it('keeps the patrol away while attempts keep failing', () => {
    let s = stateWith(testMember('a', 0, { bag: ALWAYS_FAIL }))
    for (let i = 0; i < 8; i++) s = resolveInterval(s, { a: { actionId: 'watch' } }, rng()).state
    expect(s.battle).toBeNull()
    expect(s.patrolStartedAt).toBeNull()
  })

  it('brings the patrol after the delay once the door is open', () => {
    let s = stateWith(testMember('a', 0, { bag: ALWAYS_PASS }))
    s = resolveInterval(s, pick, rng()).state
    expect(s.battle).toBeNull()
    for (let i = 0; i < 6 && !s.battle; i++) s = resolveInterval(s, { a: { actionId: 'watch' } }, rng()).state
    expect(s.battle).not.toBeNull()
    expect(s.battleKind).toBe('patrol')
  })

  it('stops offering the lock once it is open', () => {
    const open = unlockLock(stateWith(testMember('a', 0)), 'entranceDoor')
    expect(availableActions(open, open.party[0]).some((o) => o.id.startsWith('unlock:'))).toBe(false)
  })

  it('falls back to keeping watch when the door is no longer there to open', () => {
    const open = unlockLock(stateWith(testMember('a', 0)), 'entranceDoor')
    const { steps } = resolveInterval(open, pick, rng())
    expect(steps[0].title).toBe('Keep watch')
  })

  it('never offers picks or force against the seal', () => {
    const s = { ...stateWith(testMember('a', 0)), roomId: 'shrine' }
    expect(availableActions(s, s.party[0]).some((o) => o.id.startsWith('unlock:'))).toBe(false)
  })
})

describe('rooms with several things to do', () => {
  it('offers each interaction separately and tracks them separately', () => {
    const base = { ...stateWith(testMember('a', 0, { bag: ALWAYS_PASS })), roomId: 'greatHall' }
    const ids = availableActions(base, base.party[0])
      .filter((o) => o.id.startsWith('interact:'))
      .map((o) => o.id)
    expect(ids).toEqual(['interact:mosaic', 'interact:candelabra'])

    const { state } = resolveInterval(base, { a: { actionId: 'interact:mosaic' } }, rng())
    const after = availableActions(state, state.party[0])
    expect(after.find((o) => o.id === 'interact:mosaic')!.disabledReason).toBe('Already done')
    expect(after.find((o) => o.id === 'interact:candelabra')!.disabledReason).toBeUndefined()
  })

  it('rewards the character who did it', () => {
    const base = { ...stateWith(testMember('a', 0, { bag: ALWAYS_PASS })), roomId: 'greatHall' }
    const { state } = resolveInterval(base, { a: { actionId: 'interact:candelabra' } }, rng())
    expect(state.party[0].inventory.torch).toBe(1)
  })

  it('gives at least a few rooms more than one interaction', () => {
    const multi = SUNKEN_CRYPT.rooms.filter((r) => r.interactions.length > 1)
    expect(multi.length).toBeGreaterThanOrEqual(4)
    for (const room of SUNKEN_CRYPT.rooms) {
      expect(new Set(room.interactions.map((i) => i.id)).size).toBe(room.interactions.length)
    }
  })
})

describe('complications outside combat', () => {
  const clumsy = (roomId: string, over: Partial<ReturnType<typeof testMember>> = {}) => ({
    ...stateWith(testMember('a', 2, { bag: bagOf('complication'), ...over })),
    roomId,
  })
  const search = { a: { actionId: 'search' as const } }

  it('add a consequence step after the test, using the room’s own trigger', () => {
    const { steps } = resolveInterval(clumsy('greatHall'), search, rng())
    expect(steps.map((s) => s.title)).toContain('Complication!')
    const consequence = steps.find((s) => s.title === 'Complication!')!
    expect(consequence.intro).toMatch(/ceiling beam/)
    expect(consequence.tone).toBe('failure')
  })

  it('hurt the character in a room with falling debris, but never to 0 HP', () => {
    const { state } = resolveInterval(clumsy('greatHall'), search, rng())
    const a = state.party[0]
    expect(a.hp).toBe(a.maxHp - 1)
    const frail = clumsy('greatHall')
    frail.party[0] = { ...frail.party[0], hp: 1 }
    expect(resolveInterval(frail, search, rng()).state.party[0].hp).toBe(1)
  })

  it('burn an extra step off the torch where there is a draught', () => {
    const s = clumsy('barracks')
    const { state } = resolveInterval(s, search, rng())
    expect(state.torch.remaining).toBe(s.torch.remaining - 2)
  })

  it('make a noise that brings the patrol sooner, once its clock is running', () => {
    const running = { ...clumsy('entrance'), patrolStartedAt: 0 }
    const { state, steps } = resolveInterval(running, search, rng())
    expect(state.patrolStartedAt).toBe(-1)
    expect(steps.find((s) => s.title === 'Complication!')!.outcome).toMatch(/sooner/)
  })

  it('make a noise that nobody hears while the patrol clock is stopped', () => {
    const { state, steps } = resolveInterval(clumsy('entrance'), search, rng())
    expect(state.patrolStartedAt).toBeNull()
    expect(steps.find((s) => s.title === 'Complication!')!.tone).toBe('neutral')
  })

  it('drop a spare torch into the water in the cistern', () => {
    const { state } = resolveInterval(clumsy('cistern'), search, rng())
    expect(state.party[0].inventory.torch).toBe(1)
  })

  it('treat a Critical Failure as a Complication', () => {
    const { steps } = resolveInterval(clumsy('greatHall', { bag: ALWAYS_FAIL }), search, rng())
    expect(steps.some((s) => s.title === 'Complication!')).toBe(true)
  })

  it('do nothing extra in rooms without a trigger, or when no Complication was drawn', () => {
    expect(resolveInterval(clumsy('shrine'), search, rng()).steps.some((s) => s.title === 'Complication!')).toBe(false)
    const calm = { ...stateWith(testMember('a', 2, { bag: ALWAYS_PASS })), roomId: 'greatHall' }
    expect(resolveInterval(calm, search, rng()).steps.some((s) => s.title === 'Complication!')).toBe(false)
  })

  it('trigger on any test, including lockpicking', () => {
    const s = stateWith(testMember('a', 0, { bag: bagOf('complication') }))
    const { steps } = resolveInterval(s, { a: { actionId: 'unlock:entranceDoor:pick' } }, rng())
    expect(steps.some((st) => st.title === 'Complication!')).toBe(true)
  })
})

describe('breaking the seal', () => {
  const passBag = { bag: ALWAYS_PASS }
  const doRoom = (state: DungeonState, roomId: string, id: string) =>
    resolveInterval({ ...state, roomId }, { a: { actionId: `interact:${id}` } }, rng())

  it('needs all three things done in other rooms', () => {
    let s = stateWith(testMember('a', 0, passBag))
    s = doRoom(s, 'library', 'scrolls').state
    expect(s.unlocked).not.toContain('foundersSeal')
    s = doRoom(s, 'shrine', 'braziers').state
    expect(s.unlocked).not.toContain('foundersSeal')
    const last = doRoom(s, 'cistern', 'stone')
    expect(last.state.unlocked).toContain('foundersSeal')
    expect(last.steps[0].outcome).toMatch(/shatters/)
  })

  it('works in any order', () => {
    let s = stateWith(testMember('a', 0, passBag))
    for (const [room, id] of [
      ['cistern', 'stone'],
      ['library', 'scrolls'],
      ['shrine', 'braziers'],
    ]) {
      s = doRoom(s, room, id).state
    }
    expect(s.unlocked).toContain('foundersSeal')
  })

  it('is not opened by unrelated interactions', () => {
    let s = stateWith(testMember('a', 0, passBag))
    s = doRoom(s, 'library', 'desk').state
    s = doRoom(s, 'shrine', 'altar').state
    s = doRoom(s, 'cistern', 'walkway').state
    expect(s.unlocked).not.toContain('foundersSeal')
  })

  it('does not count a failed attempt', () => {
    let s = stateWith(testMember('a', 0, { bag: ALWAYS_FAIL }))
    s = doRoom(s, 'library', 'scrolls').state
    expect(s.done).not.toContain(interactionFlag('library', 'scrolls'))
  })
})

describe('using healing items', () => {
  const hurt = (key: string, hp: number) => testMember(key, 0, { hp, maxHp: 10 })
  const withItems = (items: Record<string, number>, ...others: ReturnType<typeof testMember>[]) =>
    stateWith(testMember('a', 0, { inventory: { torch: 0, ...items }, hp: 10, maxHp: 10 }), ...others)

  it('offers an item only to someone carrying it, and only when somebody is hurt', () => {
    const calm = withItems({ bandage: 1 })
    const option = availableActions(calm, calm.party[0]).find((o) => o.id === 'use:bandage')!
    expect(option.disabledReason).toBe('Nobody is hurt')
    const injured = withItems({ bandage: 1 }, hurt('b', 4))
    expect(availableActions(injured, injured.party[0]).find((o) => o.id === 'use:bandage')!.disabledReason).toBeUndefined()
    expect(availableActions(injured, injured.party[1]).some((o) => o.id.startsWith('use:'))).toBe(false)
  })

  it('heals the most wounded party member and uses the item up', () => {
    const s = withItems({ bandage: 1 }, hurt('b', 8), hurt('c', 3))
    const { state, steps } = resolveInterval(s, { a: { actionId: 'use:bandage' } }, rng())
    expect(state.party.find((m) => m.key === 'c')!.hp).toBe(5)
    expect(state.party.find((m) => m.key === 'b')!.hp).toBe(8)
    expect(state.party[0].inventory.bandage).toBe(0)
    expect(steps[0].outcome).toMatch(/c recovers 2 HP \(5\/10\)/)
  })

  it('restores more with a Healing Potion, but never past full HP', () => {
    const s = withItems({ healingPotion: 1 }, hurt('b', 9))
    const { state } = resolveInterval(s, { a: { actionId: 'use:healingPotion' } }, rng())
    expect(state.party.find((m) => m.key === 'b')!.hp).toBe(10)
  })

  it('takes an Interval of torch, like everything else', () => {
    const s = withItems({ bandage: 1 }, hurt('b', 4))
    const { state } = resolveInterval(s, { a: { actionId: 'use:bandage' } }, rng())
    expect(state.intervals).toBe(1)
  })

  it('falls back to keeping watch if nobody needs it by the time it is their turn', () => {
    const first = testMember('a', 0, { inventory: { torch: 0, bandage: 1 } })
    const second = testMember('b', 0, { inventory: { torch: 0, bandage: 1 } })
    const s = stateWith(first, second, hurt('c', 9))
    const { steps, state } = resolveInterval(
      s,
      { a: { actionId: 'use:bandage' }, b: { actionId: 'use:bandage' } },
      rng(),
    )
    expect(steps[0].title).toBe('Use a Bandage')
    expect(steps[1].title).toBe('Keep watch')
    expect(state.party[1].inventory.bandage).toBe(1)
  })
})
