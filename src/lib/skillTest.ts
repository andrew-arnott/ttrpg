import type { SpecialKey, TokenStack } from '../data/types'
import { drawTest, type Rng, type TestResult } from './drawTest'

export interface SkillTestOutcome {
  attribute: SpecialKey
  attributeValue: number
  difficulty: number
  /** Extra Difficulty from circumstances such as working in the dark. */
  penalty: number
  result: TestResult
  /** Token total plus the attribute. */
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
  penalty = 0,
): SkillTestOutcome {
  const result = drawTest(bag, rng)
  const total = result.total + attributeValue
  const passed =
    result.outcome === 'critical-success' ||
    (result.outcome !== 'critical-failure' && total >= difficulty + penalty)
  return { attribute, attributeValue, difficulty, penalty, result, total, passed }
}
