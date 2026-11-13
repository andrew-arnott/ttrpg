import { hasDarkvision } from '../data/species'
import { TOKENS } from '../data/tokens'
import type { SpecialSpread } from '../data/types'
import { countSealed, hasSealed, isCondition, sealedOf, type SealedCondition } from './conditionRules'
import { drewComplication, type TestResult } from './drawTest'
import type { Ask } from './replay'
import type { TestBonus } from './skillTest'
import { lightBonusAt, type TorchLevel } from './torch'
import { adjustBag, type TokenHolder } from './tokenFlow'

/** Anyone who makes tests: an adventurer in a fight or in the dungeon. */
export interface TestTaker extends TokenHolder {
  key: string
  name: string
  hp: number
  maxHp: number
  special: SpecialSpread
  /** Shield tokens drawn and waiting to absorb the next damage taken. */
  shieldsInPlay: number
  sealedConditions?: SealedCondition[]
  /** Added to the next test, then used up. */
  nextTestBonus?: number
}

/** Everything added to a test before the draw: the light the party has, then anything else. */
export function testBonuses(
  taker: { speciesId?: string; nextTestBonus?: number },
  torch: TorchLevel | null | undefined,
  extras: TestBonus[] = [],
): TestBonus[] {
  const light = torch ? lightBonusAt(torch, hasDarkvision(taker.speciesId)) : null
  const blessed = taker.nextTestBonus ? [{ label: 'Bless', value: taker.nextTestBonus }] : []
  return [...(light ? [light] : []), ...blessed, ...extras]
}

const tokenName = (tokenId: string) => TOKENS[tokenId]?.name ?? tokenId

/**
 * Damage first uses up Shields in play, which go back to the bag. Outside combat damage never
 * takes anyone below 1 HP.
 */
export function takeDamage(
  taker: Pick<TestTaker, 'hp' | 'bag' | 'shieldsInPlay'>,
  amount: number,
  lethal: boolean,
): { dealt: number; absorbed: number } {
  if (amount <= 0) return { dealt: 0, absorbed: 0 }
  const absorbed = Math.min(taker.shieldsInPlay, amount)
  if (taker.shieldsInPlay > 0) {
    taker.bag = adjustBag(taker.bag, 'shield', taker.shieldsInPlay)
    taker.shieldsInPlay = 0
  }
  const dealt = amount - absorbed
  taker.hp = Math.max(lethal ? 0 : 1, taker.hp - dealt)
  return { dealt, absorbed }
}

/** Returns one sealed condition to the bag. */
export function releaseCondition(taker: TestTaker, condition: SealedCondition) {
  const list = sealedOf(taker)
  const index = list.indexOf(condition)
  if (index < 0) return
  taker.sealedConditions = list.filter((_, i) => i !== index)
  taker.bag = adjustBag(taker.bag, condition.tokenId, 1)
}

export function releaseAllConditions(taker: TestTaker) {
  for (const condition of [...sealedOf(taker)]) releaseCondition(taker, condition)
}

/**
 * What a finished test does to the tokens. Shields wait in play for the next damage, Bless tokens
 * are used up, and resource tokens go into play (Mana only if the test succeeded). Condition
 * tokens drawn in a failed test are sealed and take effect; in a successful test they go back in
 * the bag, and a sealed Curse that started the draw is released. A failed test that drew a Complication
 * also costs a token in play. Returns what to tell the player.
 */
export function settleTest(
  taker: TestTaker,
  result: TestResult,
  succeeded: boolean,
  options: { round: number; lethal: boolean; ask: Ask },
): string[] {
  taker.nextTestBonus = 0
  const shields = result.drawn.filter((d) => d.tokenId === 'shield').length
  if (shields > 0) {
    taker.shieldsInPlay += shields
    taker.bag = adjustBag(taker.bag, 'shield', -shields)
  }
  const blessed = result.drawn.filter((d) => d.tokenId === 'bless').length
  if (blessed > 0) taker.bag = adjustBag(taker.bag, 'bless', -blessed)
  putDrawnResourcesInPlay(taker, result, succeeded)
  const notes = settleConditions(taker, result, succeeded, options)
  if (!succeeded && drewComplication(result)) notes.push(...returnTokenInPlay(taker, options.ask))
  return notes
}

function tokensInPlay(taker: TestTaker): { id: string; count: number }[] {
  const resources = Object.entries(taker.resources)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ id, count }))
  return taker.shieldsInPlay > 0 ? [...resources, { id: 'shield', count: taker.shieldsInPlay }] : resources
}

/**
 * The default price of a Complication on a failed test: return a token in play to the bag, the
 * player's choice. Sealed conditions are not in play, so they cannot be given back this way.
 */
function returnTokenInPlay(taker: TestTaker, ask: Ask): string[] {
  const inPlay = tokensInPlay(taker)
  if (inPlay.length === 0) return []
  let chosen = inPlay[0]
  if (inPlay.length > 1) {
    const answer = ask({
      abilityId: 'returnToken',
      reactorKey: taker.key,
      title: 'Return a token',
      prompt: `${taker.name} drew a Complication on a failed test and must return a token in play to their bag.`,
      cost: 'free',
      targets: inPlay.map((t) => ({ id: t.id, label: `${tokenName(t.id)} (${t.count} in play)` })),
      required: true,
      confirmLabel: 'Return it',
    })
    chosen = inPlay.find((t) => t.id === answer.targetId) ?? inPlay[0]
  }
  if (chosen.id === 'shield') taker.shieldsInPlay -= 1
  else taker.resources = { ...taker.resources, [chosen.id]: chosen.count - 1 }
  taker.bag = adjustBag(taker.bag, chosen.id, 1)
  return [`${taker.name} returns a ${tokenName(chosen.id)} token to their bag.`]
}

/** Resource tokens only come into play from a successful test. */
function putDrawnResourcesInPlay(taker: TestTaker, result: TestResult, succeeded: boolean) {
  if (!succeeded) return
  for (const drawn of result.drawn) {
    if (!TOKENS[drawn.tokenId]?.keywords.includes('resource')) continue
    taker.bag = adjustBag(taker.bag, drawn.tokenId, -1)
    taker.resources = { ...taker.resources, [drawn.tokenId]: (taker.resources[drawn.tokenId] ?? 0) + 1 }
  }
}

function settleConditions(
  taker: TestTaker,
  result: TestResult,
  succeeded: boolean,
  { round, lethal }: { round: number; lethal: boolean },
): string[] {
  const startedWithCurse = hasSealed(taker, 'curse')
  const drawn = result.drawn.map((d) => d.tokenId).filter(isCondition)
  if (succeeded) {
    if (startedWithCurse) releaseCondition(taker, sealedOf(taker).find((c) => c.tokenId === 'curse')!)
    return []
  }
  const notes: string[] = []
  for (const tokenId of startedWithCurse ? drawn.slice(1) : drawn) {
    taker.bag = adjustBag(taker.bag, tokenId, -1)
    taker.sealedConditions = [...sealedOf(taker), { tokenId, round }]
    notes.push(`${tokenName(tokenId)} is sealed on ${taker.name}.`)
    if (tokenId === 'poison') {
      const damage = countSealed(taker, 'poison')
      takeDamage(taker, damage, lethal)
      notes.push(
        `${taker.name} takes ${damage} poison damage (${taker.hp}/${taker.maxHp} HP).${taker.hp === 0 ? ` ${taker.name} falls!` : ''}`,
      )
    }
  }
  return notes
}
