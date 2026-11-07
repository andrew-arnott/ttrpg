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

/** One beat of an Interval or battle round, played back in order by the UI. */
export interface ResolutionStep {
  actor: StepActor | null
  title: string
  intro: string
  test?: SkillTestOutcome
  /**
   * `check` compares the test with a Difficulty. `score` adds the result to something
   * (a Defense score) and has no pass or fail.
   */
  testMode?: 'check' | 'score'
  /** Replaces the generated "tokens + attribute against Difficulty" line. */
  resultLine?: string
  outcome: string
  tone: StepTone
}

export function playerActor(
  member: { key: string; name: string; professionId: string },
  colorIndex: number,
): StepActor {
  return { key: member.key, name: member.name, artKind: 'profession', artId: member.professionId, colorIndex }
}
