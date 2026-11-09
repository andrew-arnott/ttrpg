import type { SpecialKey, TokenStack } from '../data/types'
import { drawTest, type DrawRules, type Rng, type TestResult } from './drawTest'

export interface TestBonus {
  label: string
  value: number
}

export interface SkillTestOutcome {
  attribute: SpecialKey
  attributeValue: number
  difficulty: number
  result: TestResult
  /** Armor, Power, Prayer and the like. Already included in `total`. */
  bonuses: TestBonus[]
  /** Token total plus the attribute and any bonus. */
  total: number
  passed: boolean
}

/**
 * Draws a test from the bag and compares token total plus attribute with the
 * Difficulty. A Critical Success always passes and a Critical Failure always fails.
 */
export function performSkillTest(
  bag: TokenStack[],
  attribute: SpecialKey,
  attributeValue: number,
  difficulty: number,
  rng: Rng,
  bonuses: TestBonus[] = [],
  rules: DrawRules = {},
): SkillTestOutcome {
  const result = drawTest(bag, rng, rules)
  const total = result.total + attributeValue + bonuses.reduce((sum, b) => sum + b.value, 0)
  const passed =
    result.outcome === 'critical-success' ||
    (result.outcome !== 'critical-failure' && total >= difficulty)
  return { attribute, attributeValue, difficulty, bonuses, result, total, passed }
}

/** The same test with a bonus added after the draw. A Critical Failure still fails. */
export function withBonus(test: SkillTestOutcome, bonus: TestBonus): SkillTestOutcome {
  const total = test.total + bonus.value
  const passed =
    test.result.outcome === 'critical-success' ||
    (test.result.outcome !== 'critical-failure' && total >= test.difficulty)
  return { ...test, bonuses: [...test.bonuses, bonus], total, passed }
}
