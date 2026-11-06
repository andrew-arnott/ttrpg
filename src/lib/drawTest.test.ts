import { describe, expect, it } from 'vitest'
import { STANDARD_BAG } from '../data/tokens'
import { applyBagMods, bagStats } from './buildCharacter'
import { SPECIES } from '../data/species'
import { drawTest, mulberry32, simulate } from './drawTest'

describe('drawTest', () => {
  it('stops at the first token that is not a chain token', () => {
    const r = drawTest([{ tokenId: 'plus3', count: 5 }], mulberry32(1))
    expect(r.drawn).toHaveLength(1)
    expect(r.total).toBe(3)
    expect(r.outcome).toBe('normal')
  })

  it('keeps drawing through chain tokens and sums their modifiers', () => {
    const bag = [
      { tokenId: 'opportunity', count: 2 },
      { tokenId: 'plus2', count: 1 },
    ]
    for (let seed = 0; seed < 25; seed++) {
      const r = drawTest(bag, mulberry32(seed))
      const last = r.drawn[r.drawn.length - 1]
      expect(last.tokenId).toBe('plus2')
      expect(r.drawn.slice(0, -1).every((d) => d.chain)).toBe(true)
      expect(r.total).toBe(r.drawn.reduce((a, d) => a + (d.modifier ?? 0), 0))
    }
  })

  it('never draws more tokens than the bag holds, even if every token chains', () => {
    const r = drawTest([{ tokenId: 'opportunity', count: 3 }], mulberry32(7))
    expect(r.drawn).toHaveLength(3)
  })

  it('reports critical outcomes and complications', () => {
    expect(drawTest([{ tokenId: 'critFailure', count: 1 }]).outcome).toBe('critical-failure')
    expect(drawTest([{ tokenId: 'critSuccess', count: 1 }]).outcome).toBe('critical-success')
    expect(drawTest([{ tokenId: 'complication', count: 1 }]).complication).toBe(true)
  })

  it('returns an empty result for an empty bag', () => {
    const r = drawTest([])
    expect(r.drawn).toEqual([])
    expect(r.total).toBe(0)
  })

  it('does not mutate the bag', () => {
    const bag = STANDARD_BAG.map((s) => ({ ...s }))
    drawTest(bag, mulberry32(3))
    expect(bag).toEqual(STANDARD_BAG)
  })
})

describe('simulate', () => {
  it('converges on the exact statistics for the standard bag', () => {
    const exact = bagStats(STANDARD_BAG)
    const sim = simulate(STANDARD_BAG, 40000, mulberry32(42))
    expect(sim.criticalFailureRate).toBeCloseTo(exact.critFailureChance, 1)
    expect(Math.abs(sim.criticalFailureRate - exact.critFailureChance)).toBeLessThan(0.01)
    expect(Math.abs(sim.criticalSuccessRate - exact.critSuccessChance)).toBeLessThan(0.01)
    expect(Math.abs(sim.complicationRate - exact.complicationChance)).toBeLessThan(0.01)
    expect(Math.abs(sim.averageTokensDrawn - exact.expectedTokensDrawn)).toBeLessThan(0.03)
  })

  it('converges on the exact statistics for a species-modified bag', () => {
    const elf = SPECIES.find((s) => s.id === 'elf')!
    const bag = applyBagMods(STANDARD_BAG, elf.bagMods)
    const exact = bagStats(bag)
    const sim = simulate(bag, 40000, mulberry32(9))
    expect(Math.abs(sim.criticalFailureRate - exact.critFailureChance)).toBeLessThan(0.01)
  })
})
