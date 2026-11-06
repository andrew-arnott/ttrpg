import { describe, expect, it } from 'vitest'
import { SPECIES } from '../data/species'
import { STANDARD_BAG, TOKENS } from '../data/tokens'
import { SPECIAL_ARRAY } from '../data/types'
import { PROFESSIONS } from '../data/professions'
import {
  allAbilities,
  applyBagMods,
  bagStats,
  buildCharacter,
  emptyDraft,
  STEP_IDS,
  suggestedSpecialAssignment,
} from './buildCharacter'

const size = (bag: { count: number }[]) => bag.reduce((a, s) => a + s.count, 0)
const countOf = (bag: { tokenId: string; count: number }[], id: string) =>
  bag.find((s) => s.tokenId === id)?.count ?? 0

const speciesById = (id: string) => SPECIES.find((s) => s.id === id)!

describe('standard bag', () => {
  it('holds the 15 tokens the guide lists', () => {
    expect(size(STANDARD_BAG)).toBe(15)
  })

  it('has an expected modifier of +2.25', () => {
    // 12 terminators contributing 27 total, 3 chain tokens netting 0.
    const stats = bagStats(STANDARD_BAG)
    expect(stats.expectedModifier).toBeCloseTo(2.25, 10)
    expect(stats.critFailureChance).toBeCloseTo(1 / 12, 10)
    expect(stats.critSuccessChance).toBeCloseTo(1 / 12, 10)
    expect(stats.complicationChance).toBeCloseTo(1 / 13, 10)
  })
})

describe('bagStats', () => {
  it('matches a brute-force simulation', () => {
    // Independent check of the permutation argument used in bagStats.
    const bag = applyBagMods(STANDARD_BAG, speciesById('dwarf').bagMods)
    const flat: string[] = []
    for (const s of bag) for (let i = 0; i < s.count; i++) flat.push(s.tokenId)

    let total = 0
    let crits = 0
    const trials = 200_000
    // Deterministic PRNG so the test cannot flake.
    let seed = 12345
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 0x100000000
    }

    for (let t = 0; t < trials; t++) {
      const deck = flat.slice()
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[deck[i], deck[j]] = [deck[j], deck[i]]
      }
      let sum = 0
      for (const id of deck) {
        const def = TOKENS[id]
        if (def.modifier !== null) sum += def.modifier
        if (!def.keywords.includes('chain')) {
          if (id === 'critFailure') crits++
          break
        }
      }
      total += sum
    }

    const stats = bagStats(bag)
    expect(total / trials).toBeCloseTo(stats.expectedModifier, 1)
    expect(crits / trials).toBeCloseTo(stats.critFailureChance, 2)
  })
})

describe('species bag modifications', () => {
  it('Elf removes one each of +1, +2, +3, leaving 12', () => {
    const bag = applyBagMods(STANDARD_BAG, speciesById('elf').bagMods)
    expect(size(bag)).toBe(12)
    expect(countOf(bag, 'plus1')).toBe(1)
    expect(countOf(bag, 'plus2')).toBe(1)
    expect(countOf(bag, 'plus3')).toBe(3)
  })

  it('Dwarf adds 3 Shields, reaching 18', () => {
    const bag = applyBagMods(STANDARD_BAG, speciesById('dwarf').bagMods)
    expect(size(bag)).toBe(18)
    expect(countOf(bag, 'shield')).toBe(3)
  })

  it('Orc converts 2 of its +2 tokens to Might without changing bag size', () => {
    const bag = applyBagMods(STANDARD_BAG, speciesById('orc').bagMods)
    expect(size(bag)).toBe(15)
    expect(countOf(bag, 'plus2')).toBe(0)
    expect(countOf(bag, 'might')).toBe(2)
  })

  it('makes special tokens proportionally more common for the Elf', () => {
    const standard = bagStats(STANDARD_BAG)
    const elf = bagStats(applyBagMods(STANDARD_BAG, speciesById('elf').bagMods))
    expect(elf.critFailureChance).toBeGreaterThan(standard.critFailureChance)
    expect(elf.critSuccessChance).toBeGreaterThan(standard.critSuccessChance)
  })
})

describe('buildCharacter', () => {
  const fullDraft = () => ({
    ...emptyDraft(),
    name: 'Test',
    professionId: 'warrior',
    // Array is [1,2,2,2,3,3,3]; assign each index exactly once.
    specialAssignment: {
      strength: 4,
      perception: 1,
      endurance: 5,
      charisma: 0,
      intelligence: 2,
      agility: 6,
      luck: 3,
    },
    speciesId: 'dwarf',
    backgroundId: 'soldier',
    tokenChoices: { warriorCombat: { armor: 2, power: 1 } },
    abilityIds: ['provoke', 'disable', 'cleave', 'intercept'],
  })

  it('stacks species and background bonuses onto the array values', () => {
    const c = buildCharacter(fullDraft())
    expect(c.baseSpecial.strength).toBe(SPECIAL_ARRAY[4]) // 3
    expect(c.special.strength).toBe(4) // +1 Soldier
    expect(c.special.endurance).toBe(4) // array 3, +1 Dwarf
    expect(c.special.charisma).toBe(1) // array 1, no bonus
  })

  it('keeps profession resources in play rather than in the bag', () => {
    const c = buildCharacter(fullDraft())
    expect(countOf(c.bag, 'resolve')).toBe(0)
    expect(countOf(c.inPlay, 'resolve')).toBe(3)
    expect(countOf(c.inPlay, 'armor')).toBe(2)
    expect(countOf(c.inPlay, 'power')).toBe(1)
    // Bag is standard + Dwarf shields only.
    expect(c.stats.size).toBe(18)
  })

  it('is complete when every choice is made', () => {
    const c = buildCharacter(fullDraft())
    expect(c.issues).toEqual([])
    expect(c.complete).toBe(true)
    expect(c.startingHp).toBe(12)
  })

  it('flags a duplicated array value', () => {
    const draft = fullDraft()
    draft.specialAssignment.luck = 4 // already used by strength
    const c = buildCharacter(draft)
    expect(c.issuesFor('special')).toContain('Each value from the array may only be used once.')
  })

  it('flags the wrong number of ability picks', () => {
    const draft = fullDraft()
    draft.abilityIds = ['provoke']
    expect(buildCharacter(draft).complete).toBe(false)
  })

  it('flags an under-allocated Warrior token choice', () => {
    const draft = fullDraft()
    draft.tokenChoices = { warriorCombat: { armor: 1, power: 1 } }
    const c = buildCharacter(draft)
    expect(c.issuesFor('abilities').some((i) => i.includes('combat tokens'))).toBe(true)
  })

  it('refuses to complete an undefined profession', () => {
    const draft = { ...fullDraft(), professionId: 'ranger', abilityIds: [], tokenChoices: {} }
    const c = buildCharacter(draft)
    expect(c.complete).toBe(false)
    expect(c.startingHp).toBeNull()
  })
})

describe('ability pool', () => {
  const warrior = PROFESSIONS.find((p) => p.id === 'warrior')!

  it('combines combat and exploration abilities', () => {
    const pool = allAbilities(warrior)
    expect(pool).toHaveLength(warrior.abilities.length + warrior.explorationAbilities.length)
    expect(pool.map((a) => a.id)).toContain('provoke')
    expect(pool.map((a) => a.id)).toContain('fortify')
  })

  it('has unique ids across both lists for every profession', () => {
    for (const p of PROFESSIONS) {
      const ids = allAbilities(p).map((a) => a.id)
      expect(new Set(ids).size, `${p.name} has duplicate ability ids`).toBe(ids.length)
    }
  })

  it('accepts a mix of combat and exploration picks', () => {
    const draft = {
      ...emptyDraft(),
      professionId: 'warrior',
      specialAssignment: {
        strength: 4, perception: 1, endurance: 5, charisma: 0,
        intelligence: 2, agility: 6, luck: 3,
      },
      speciesId: 'human',
      backgroundId: 'soldier',
      tokenChoices: { warriorCombat: { armor: 3 } },
      abilityIds: ['provoke', 'shieldWall', 'fortify', 'barricade'],
    }
    const c = buildCharacter(draft)
    expect(c.complete).toBe(true)
    expect(c.chosenAbilities.map((a) => a.id).sort()).toEqual(
      ['barricade', 'fortify', 'provoke', 'shieldWall'].sort(),
    )
  })

  it('offers enough abilities to satisfy every defined profession', () => {
    for (const p of PROFESSIONS.filter((x) => x.defined)) {
      expect(allAbilities(p).length, p.name).toBeGreaterThanOrEqual(p.abilityPicks)
    }
  })
})

describe('wizard step order', () => {
  it('collects species and background before SPECIAL', () => {
    expect([...STEP_IDS]).toEqual([
      'profession',
      'species',
      'background',
      'special',
      'abilities',
      'equipment',
    ])
  })
})

describe('equipment', () => {
  const base = () => ({
    ...emptyDraft(),
    professionId: 'warrior',
    speciesId: 'human',
    backgroundId: 'soldier',
  })

  it('starts with 10 coins and nothing bought', () => {
    const c = buildCharacter(base())
    expect(c.coinsSpent).toBe(0)
    expect(c.coinsLeft).toBe(10)
    expect(c.inventory).toEqual([])
  })

  it('prices purchases against the starting coins', () => {
    const c = buildCharacter({ ...base(), equipment: { torch: 3, healingPotion: 1 } })
    expect(c.coinsSpent).toBe(8)
    expect(c.coinsLeft).toBe(2)
    expect(c.inventory.map((e) => [e.item.id, e.count])).toEqual([
      ['torch', 3],
      ['healingPotion', 1],
    ])
  })

  it('ignores unknown items and zero quantities', () => {
    const c = buildCharacter({ ...base(), equipment: { nonsense: 4, torch: 0 } })
    expect(c.inventory).toEqual([])
  })

  it('flags overspending on the equipment step', () => {
    const c = buildCharacter({ ...base(), equipment: { healingPotion: 3 } })
    expect(c.coinsLeft).toBe(-5)
    expect(c.issuesFor('equipment')).toHaveLength(1)
  })

  it('lets a character keep unspent coins', () => {
    expect(buildCharacter(base()).issuesFor('equipment')).toEqual([])
  })
})

describe('suggestedSpecialAssignment', () => {
  it('uses every array slot exactly once, best values on suggested attributes', () => {
    const warrior = PROFESSIONS.find((p) => p.id === 'warrior')!
    const assignment = suggestedSpecialAssignment(warrior)
    const indices = Object.values(assignment)
    expect(new Set(indices).size).toBe(SPECIAL_ARRAY.length)
    for (const key of warrior.importantSpecial) {
      expect(SPECIAL_ARRAY[assignment[key]!]).toBe(3)
    }
  })
})
