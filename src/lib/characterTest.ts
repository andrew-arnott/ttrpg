import { TOKENS } from '../data/tokens'
import type { SpecialSpread } from '../data/types'
import { countSealed, hasSealed, isCondition, sealedOf, type SealedCondition } from './conditionRules'
import type { TestResult } from './drawTest'
import { adjustBag, type TokenHolder } from './tokenFlow'

/** Anyone who makes tests: an adventurer in a fight or in the dungeon. */
export interface TestTaker extends TokenHolder {
  name: string
  hp: number
  maxHp: number
  special: SpecialSpread
  /** Shield tokens drawn and waiting to absorb the next damage taken. */
  shieldsInPlay: number
  sealedConditions?: SealedCondition[]
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
 * the bag, and a sealed Curse that started the draw is released. Returns what to tell the player.
 */
export function settleTest(
  taker: TestTaker,
  result: TestResult,
  succeeded: boolean,
  options: { round: number; lethal: boolean },
): string[] {
  const shields = result.drawn.filter((d) => d.tokenId === 'shield').length
  if (shields > 0) {
    taker.shieldsInPlay += shields
    taker.bag = adjustBag(taker.bag, 'shield', -shields)
  }
  const blessed = result.drawn.filter((d) => d.tokenId === 'bless').length
  if (blessed > 0) taker.bag = adjustBag(taker.bag, 'bless', -blessed)
  putDrawnResourcesInPlay(taker, result, succeeded)
  return settleConditions(taker, result, succeeded, options)
}

function putDrawnResourcesInPlay(taker: TestTaker, result: TestResult, succeeded: boolean) {
  for (const drawn of result.drawn) {
    if (!TOKENS[drawn.tokenId]?.keywords.includes('resource')) continue
    if (drawn.tokenId === 'mana' && !succeeded) continue
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
