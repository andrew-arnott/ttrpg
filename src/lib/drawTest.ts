import { TOKENS } from '../data/tokens'
import type { TokenStack } from '../data/types'

export type Rng = () => number

export interface DrawnToken {
  tokenId: string
  name: string
  /** Null for tokens with no numeric contribution (Critical Failure). */
  modifier: number | null
  chain: boolean
}

export type TestOutcome = 'critical-success' | 'critical-failure' | 'normal'

export interface TestResult {
  drawn: DrawnToken[]
  /** Sum of every drawn modifier. Not meaningful on a critical failure. */
  total: number
  outcome: TestOutcome
  complication: boolean
}

/** A Complication token, or the Critical Failure that generates one. */
export const drewComplication = (r: TestResult): boolean => r.complication || r.outcome === 'critical-failure'

function expand(bag: TokenStack[]): string[] {
  return bag.flatMap((s) => Array.from({ length: s.count }, () => s.tokenId))
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Things about a character that change how their draw works. */
export interface DrawRules {
  /** Tokens that begin the draw without coming out of the bag, such as a sealed Curse. */
  startWith?: string[]
  /** With a Wound sealed, drawing another Wound is a Critical Failure. */
  woundSealed?: boolean
}

function drawnToken(tokenId: string): DrawnToken {
  const def = TOKENS[tokenId]
  return { tokenId, name: def?.name ?? tokenId, modifier: def?.modifier ?? 0, chain: def?.keywords.includes('chain') ?? false }
}

/**
 * Resolves one test: draws without replacement until a token that ends the
 * draw comes out. Chain tokens keep the draw going; anything else stops it.
 */
export function drawTest(bag: TokenStack[], rng: Rng = Math.random, rules: DrawRules = {}): TestResult {
  const drawn: DrawnToken[] = (rules.startWith ?? []).map(drawnToken)
  let woundCrash = false
  for (const tokenId of shuffle(expand(bag), rng)) {
    const token = drawnToken(tokenId)
    drawn.push(token)
    if (tokenId === 'wound' && rules.woundSealed) {
      woundCrash = true
      break
    }
    if (!token.chain) break
  }

  const ids = drawn.map((d) => d.tokenId)
  return {
    drawn,
    total: drawn.reduce((sum, d) => sum + (d.modifier ?? 0), 0),
    outcome: woundCrash || ids.includes('critFailure')
      ? 'critical-failure'
      : ids.includes('critSuccess')
        ? 'critical-success'
        : 'normal',
    complication: ids.includes('complication') || woundCrash,
  }
}

export interface SimulationSummary {
  runs: number
  averageTotal: number
  averageTokensDrawn: number
  criticalSuccessRate: number
  criticalFailureRate: number
  complicationRate: number
}

export function simulate(bag: TokenStack[], runs: number, rng: Rng = Math.random): SimulationSummary {
  let total = 0
  let tokens = 0
  let critSuccess = 0
  let critFailure = 0
  let complications = 0
  for (let i = 0; i < runs; i++) {
    const r = drawTest(bag, rng)
    total += r.total
    tokens += r.drawn.length
    if (r.outcome === 'critical-success') critSuccess++
    if (r.outcome === 'critical-failure') critFailure++
    if (r.complication) complications++
  }
  return {
    runs,
    averageTotal: total / runs,
    averageTokensDrawn: tokens / runs,
    criticalSuccessRate: critSuccess / runs,
    criticalFailureRate: critFailure / runs,
    complicationRate: complications / runs,
  }
}

/** Small seeded generator so simulations can be reproduced in tests. */
export function mulberry32(seed: number): Rng {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
