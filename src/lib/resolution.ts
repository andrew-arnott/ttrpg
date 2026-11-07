import type { ArtKind } from './art'
import type { SkillTestOutcome } from './skillTest'

export type StepTone = 'success' | 'failure' | 'neutral'

/** Who is acting in a step: a party member, an enemy, or nobody. */
export interface StepActor {
  key: string
  name: string
  artKind: ArtKind
  artId: string
  /** Index into the party colours, or -1 for enemies. */
  colorIndex: number
}

/** An enemy attack setting its value against a player's Defense score. */
export interface Clash {
  attack: number
  defenseBefore: number
  defenseAfter: number
  breaks: boolean
  target: StepActor
}

/** One beat of an Interval or battle round, played back in order by the UI. */
export interface ResolutionStep {
  actor: StepActor | null
  title: string
  intro: string
  test?: SkillTestOutcome
  /**
   * `check` compares the test with a Difficulty and shows pass or fail. `score` shows no
   * pass/fail badge, for tests that add to a score or are described in their own words.
   */
  testMode?: 'check' | 'score'
  /** Replaces the generated "Strength test · Difficulty 4" heading above a test. */
  testHeading?: string
  /** Replaces "<actor>'s bag" under the pouch. */
  bagLabel?: string
  /** Replaces the generated "tokens + attribute against Difficulty" line. */
  resultLine?: string
  clash?: Clash
  outcome: string
  tone: StepTone
}

export function playerActor(
  member: { key: string; name: string; professionId: string },
  colorIndex: number,
): StepActor {
  return { key: member.key, name: member.name, artKind: 'profession', artId: member.professionId, colorIndex }
}
