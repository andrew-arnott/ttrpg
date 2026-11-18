import { SPECIAL_LABELS, type SpecialKey } from '../../data/types'
import { attackProfile, TWO_HANDED_DAMAGE } from '../../data/weapons'
import type { TestBonus } from '../skillTest'
import type { BattlePlayer } from './types'

export interface AttackPlan {
  attribute: SpecialKey
  /** Power committed. */
  modifiers: TestBonus[]
  /** Damage added to a hit before anything else, such as a two-handed weapon. */
  extraDamage: number
}

/**
 * What an attack with the weapon in hand tests and adds. A spell names its own attribute, so the
 * weapon neither sets it nor adds damage or a close-quarters penalty.
 */
export function planAttack(
  p: BattlePlayer,
  options: { attribute?: SpecialKey; power?: number },
): AttackPlan {
  const weapon = attackProfile(p.hands)
  const withWeapon = options.attribute === undefined
  return {
    attribute: options.attribute ?? weapon.attribute,
    modifiers: options.power ? [{ label: 'Power', value: options.power }] : [],
    extraDamage: withWeapon && weapon.twoHanded ? TWO_HANDED_DAMAGE : 0,
  }
}

const withArticle = (word: string) => `${/^[AEIOU]/i.test(word) ? 'an' : 'a'} ${word}`

/** The menu text for an ordinary attack, from the same weapon the plan uses. */
export function describeAttack(p: BattlePlayer): string {
  const weapon = attackProfile(p.hands)
  const damage = weapon.twoHanded ? '2 damage' : '1 damage'
  const reach = weapon.ranged
    ? 'It is a ranged attack: you can only attack an enemy you are not engaged with.'
    : 'It is a melee attack: you can only attack an enemy you are engaged with.'
  return `Make ${withArticle(SPECIAL_LABELS[weapon.attribute])} test with your ${weapon.name} against an enemy's Defense. A hit deals ${damage}. ${reach}`
}
