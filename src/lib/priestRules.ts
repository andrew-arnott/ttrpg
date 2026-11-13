import type { SealedToken } from './adventurer'
import { drewComplication, type DrawnToken, type TestResult } from './drawTest'
import { offerPrayer, type Reactor } from './reactorRules'
import type { Ask } from './replay'
import { adjustBag, type Commitment } from './tokenFlow'
import type { SkillTestOutcome } from './skillTest'

/** Someone Faith can be sealed on. */
export interface FaithBearer {
  key: string
  name: string
  hp: number
  maxHp: number
  sealedBy?: SealedToken[]
}

/** A Priest who holds the Faith bag that sealed tokens return to. */
export interface FaithKeeper extends Reactor {
  bag: Reactor['bag']
}

const sealedBy = (ally: FaithBearer, priestKey: string) =>
  (ally.sealedBy ?? []).filter((s) => s.byKey === priestKey && (s.as ?? s.tokenId) === 'faith')

/** How many Faith tokens this Priest has sealed on the ally. */
export const sealedFaithCount = (ally: FaithBearer, priestKey: string) => sealedBy(ally, priestKey).length

/** Seals the committed Faith on an ally. It stays there until a passive releases it. */
export function sealFaith(priest: { key: string }, ally: FaithBearer, commit: Commitment): string {
  for (const token of commit.tokens) {
    token.sealed = true
    const stoodIn = token.tokenId !== commit.resourceId
    ally.sealedBy = [
      ...(ally.sealedBy ?? []),
      { tokenId: token.tokenId, byKey: priest.key, ...(stoodIn ? { as: commit.resourceId, value: token.value } : {}) },
    ]
  }
  return `1 Faith is sealed on ${ally.name}.`
}

/**
 * Releases up to `count` of the Priest's Faith tokens from the ally, returning each to the Priest's
 * bag. Returns how much Faith that was, counting a Critical Success as the 2 it stood in for.
 */
export function releaseFaith(ally: FaithBearer, priest: FaithKeeper, count: number): number {
  const mine = sealedBy(ally, priest.key).slice(0, count)
  for (const token of mine) priest.bag = adjustBag(priest.bag, token.tokenId, 1)
  ally.sealedBy = (ally.sealedBy ?? []).filter((s) => !mine.includes(s))
  return mine.reduce((sum, t) => sum + (t.value ?? 1), 0)
}

/** Priests in the party who chose this passive and have Faith sealed on the ally. */
function qualifyingPriests<T extends FaithKeeper>(party: T[], ally: FaithBearer, passiveId: string): T[] {
  return party.filter((p) => p.abilityIds.includes(passiveId) && sealedFaithCount(ally, p.key) > 0)
}

interface ReleaseOffer {
  abilityId: string
  title: string
  prompt: (priest: FaithKeeper, held: number) => string
}

/** Asks the ally how much of one Priest's sealed Faith to release. Returns the Faith released. */
function askRelease(ask: Ask, ally: FaithBearer, priest: FaithKeeper, offer: ReleaseOffer): number {
  const held = sealedFaithCount(ally, priest.key)
  const answer = ask({
    abilityId: offer.abilityId,
    reactorKey: ally.key,
    title: offer.title,
    prompt: offer.prompt(priest, held),
    cost: 'free',
    targets: [
      { id: '0', label: 'Release none' },
      ...Array.from({ length: held }, (_, i) => ({
        id: String(i + 1),
        label: `Release ${i + 1} Faith`,
      })),
    ],
    required: true,
    confirmLabel: 'Release',
  })
  return releaseFaith(ally, priest, Number(answer.targetId) || 0)
}

/** The test with its Complication canceled: it contributes nothing and does not Chain. */
export function cancelComplication(result: TestResult): TestResult {
  const at = result.drawn.findIndex((d) => d.tokenId === 'complication')
  const drawn: DrawnToken[] = at >= 0 ? result.drawn.slice(0, at) : result.drawn
  const total = at >= 0 ? drawn.reduce((sum, d) => sum + (d.modifier ?? 0), 0) : result.total
  return { ...result, drawn, total, complication: false, canceled: true }
}

/**
 * Steadfast Hope: when an ally with Faith sealed by this Priest draws a Complication on a test, they
 * may release any number of that Faith to cancel it and add +1 to the result for each released. At
 * least 1 must be released for the Complication to be canceled.
 */
export function offerSteadfastHope(
  ask: Ask,
  party: FaithKeeper[],
  tester: FaithBearer,
  test: SkillTestOutcome,
): SkillTestOutcome {
  let current = test
  for (const priest of qualifyingPriests(party, tester, 'steadfastHope')) {
    if (!drewComplication(current.result)) break
    const released = askRelease(ask, tester, priest, {
      abilityId: 'steadfastHope',
      title: 'Steadfast Hope',
      prompt: (p, held) =>
        `${tester.name} drew a Complication. ${tester.name} has ${held} Faith sealed by ${p.name} and may release any of it to cancel the Complication and add +1 to the result for each.`,
    })
    if (released === 0) continue
    const result = cancelComplication(current.result)
    const bonuses = [...current.bonuses, { label: `Steadfast Hope (${priest.name})`, value: released }]
    const total = result.total + current.attributeValue + bonuses.reduce((sum, b) => sum + b.value, 0)
    const passed =
      result.outcome === 'critical-success' || (result.outcome !== 'critical-failure' && total >= current.difficulty)
    current = { ...current, result, bonuses, total, passed }
  }
  return current
}

/** Steadfast Hope, then Prayer for whatever still fails. */
export function offerAllyHelp(
  ask: Ask,
  party: FaithKeeper[],
  tester: FaithBearer & Reactor,
  test: SkillTestOutcome,
): SkillTestOutcome {
  return offerPrayer(ask, party, tester, offerSteadfastHope(ask, party, tester, test))
}

export interface HealerOutcome {
  /** Faith released. */
  released: number
  /** HP actually recovered from it. */
  healed: number
  note: string
}

/**
 * Healer: when an ally with Faith sealed by this Priest recovers HP or has conditions removed, they
 * may release any number of it and recover 1 HP for each. Asked once per resolution.
 */
export function offerHealer(ask: Ask, party: FaithKeeper[], ally: FaithBearer, cause: string): HealerOutcome {
  let released = 0
  let healed = 0
  const names: string[] = []
  for (const priest of qualifyingPriests(party, ally, 'healer')) {
    const faith = askRelease(ask, ally, priest, {
      abilityId: 'healer',
      title: 'Healer',
      prompt: (p, held) =>
        `${ally.name} ${cause}. ${ally.name} has ${held} Faith sealed by ${p.name} and may release any of it to recover 1 HP for each.`,
    })
    if (faith === 0) continue
    const before = ally.hp
    ally.hp = Math.min(ally.maxHp, ally.hp + faith)
    released += faith
    healed += ally.hp - before
    names.push(priest.name)
  }
  const note =
    released > 0
      ? ` Healer: ${ally.name} releases ${released} Faith back to ${names.join(' and ')} and recovers ${healed} HP (${ally.hp}/${ally.maxHp}).`
      : ''
  return { released, healed, note }
}
