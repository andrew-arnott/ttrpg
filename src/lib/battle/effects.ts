import { ENEMIES_BY_ID, type EnemyAttack, type EnemyTrigger } from '../../data/enemies'
import type { SpecialKey } from '../../data/types'
import { drawTest, drewComplication, type TestResult } from '../drawTest'
import { performSkillTest, type SkillTestOutcome, type TestBonus } from '../skillTest'
import { recoverToken } from '../tokenFlow'
import { engageBreakdown, engageDifficulty } from './engagement'
import { INTERCEPT_DEFENSE, offerIntercept, offerPrayer } from './reactions'
import { putDrawnResourcesInPlay, releaseCommitment, type Commitment } from './tokens'
import {
  adjustBag,
  addStep,
  describeGroup,
  enemiesInGroup,
  enemyActorOf,
  enemyDefense,
  fmtSigned,
  groupOf,
  livingEnemies,
  moveToGroup,
  newGroup,
  playerActorOf,
  playerByKey,
  playersInGroup,
  sealedCount,
  tokenName,
  updateResult,
  type Engine,
} from './state'
import { ATTACK_ATTRIBUTE, DEFEND_ATTRIBUTE, ENGAGE_ATTRIBUTE, HEAL_AMOUNT, NEW_GROUP } from './types'
import type { BattleEnemy, BattlePlayer, BattleState } from './types'

/**
 * Shields wait in play for the next damage, Bless tokens are used up once drawn, and drawn
 * resource tokens go into play.
 */
export function afterTest(p: BattlePlayer, result: TestResult, succeeded: boolean) {
  const shields = result.drawn.filter((d) => d.tokenId === 'shield').length
  if (shields > 0) {
    p.shieldsInPlay += shields
    p.bag = adjustBag(p.bag, 'shield', -shields)
  }
  const blessed = result.drawn.filter((d) => d.tokenId === 'bless').length
  if (blessed > 0) p.bag = adjustBag(p.bag, 'bless', -blessed)
  putDrawnResourcesInPlay(p, result, succeeded)
}

export function dealDamageToPlayer(p: BattlePlayer, amount: number): { dealt: number; absorbed: number } {
  if (amount <= 0) return { dealt: 0, absorbed: 0 }
  const absorbed = Math.min(p.shieldsInPlay, amount)
  if (p.shieldsInPlay > 0) {
    p.bag = adjustBag(p.bag, 'shield', p.shieldsInPlay)
    p.shieldsInPlay = 0
  }
  const dealt = amount - absorbed
  p.hp = Math.max(0, p.hp - dealt)
  return { dealt, absorbed }
}

export function releaseSealedTokens(b: BattleState, e: BattleEnemy) {
  for (const sealed of e.sealed) {
    const owner = playerByKey(b, sealed.byKey)
    if (owner) owner.bag = adjustBag(owner.bag, sealed.tokenId, 1)
  }
  e.sealed = []
}

export function damageEnemy(b: BattleState, e: BattleEnemy, amount: number): boolean {
  e.hp = Math.max(0, e.hp - amount)
  if (e.hp > 0) return false
  releaseSealedTokens(b, e)
  return true
}


export interface StrikeOptions {
  /** A single-target attack that allies with Intercept may take instead. */
  interceptable?: boolean
  /** Defense gained against this attack only, as a reduction of its Attack value. */
  defenseBonus?: number
  bonusLabel?: string
}

/** One enemy strike against one player. Attack value wears down Defense; damage lands only if it exceeds it. */
export function strikePlayer(
  engine: Engine,
  e: BattleEnemy,
  attack: Pick<EnemyAttack, 'name' | 'attackValue' | 'damage'>,
  target: BattlePlayer,
  intro: string,
  options: StrikeOptions = {},
): void {
  if (options.interceptable) {
    const taken = offerIntercept(engine, e, attack.name, target)
    if (taken) {
      const { interceptor } = taken
      strikePlayer(engine, e, attack, interceptor, `${interceptor.name} steps in front of ${target.name}.`, {
        defenseBonus: INTERCEPT_DEFENSE,
        bonusLabel: 'Intercept',
      })
      releaseCommitment(interceptor, taken.commit)
      return
    }
  }
  const raw = attack.attackValue + e.empowered
  const bonus = options.defenseBonus ?? 0
  const value = Math.max(0, raw - bonus)
  const defense = target.defense
  const breaks = value > defense
  target.defense = Math.max(0, defense - value)

  const resultLine = `Attack ${raw}${bonus > 0 ? ` - ${bonus} ${options.bonusLabel}` : ''} against Defense ${defense}: ${breaks ? 'breaks through' : 'blocked'}`
  const clash = {
    attack: value,
    defenseBefore: defense,
    defenseAfter: target.defense,
    breaks,
    target: playerActorOf(target),
  }
  if (!breaks) {
    addStep(engine, {
      actor: enemyActorOf(e),
      title: attack.name,
      intro,
      resultLine,
      clash,
      outcome: `${target.name} turns the blow aside. Defense is now ${target.defense}.`,
      tone: 'success',
    })
    return
  }

  const reduction = e.disabled ? sealedCount(e, 'resolve') : 0
  const { dealt, absorbed } = dealDamageToPlayer(target, Math.max(0, attack.damage - reduction))
  const notes = [
    reduction > 0 ? `Disabled: damage reduced by ${reduction}.` : '',
    absorbed > 0 ? `${absorbed} absorbed by Shield.` : '',
  ].filter(Boolean)
  const falls = target.hp === 0 ? ` ${target.name} falls!` : ''
  addStep(engine, {
    actor: enemyActorOf(e),
    title: attack.name,
    intro,
    resultLine,
    clash,
    outcome:
      dealt > 0
        ? `${target.name} takes ${dealt} damage (${target.hp}/${target.maxHp} HP).${notes.length ? ` ${notes.join(' ')}` : ''}${falls}`
        : `The blow lands but does no damage. ${notes.join(' ')}`.trim(),
    tone: dealt > 0 ? 'failure' : 'neutral',
  })
  updateResult(engine.b)
}

export function applyTrigger(engine: Engine, e: BattleEnemy, trigger: EnemyTrigger, drawer: BattlePlayer) {
  const { effect } = trigger
  if (effect.kind === 'empower') {
    e.empowered += effect.attackBonus
    addStep(engine, {
      actor: enemyActorOf(e),
      title: trigger.name,
      intro: `${e.name} reacts to the Complication.`,
      outcome: `${e.name} gains +${effect.attackBonus} attack value until the end of the round.`,
      tone: 'failure',
    })
    return
  }
  if (effect.kind === 'heal') {
    const before = e.hp
    e.hp = Math.min(e.maxHp, e.hp + effect.amount)
    addStep(engine, {
      actor: enemyActorOf(e),
      title: trigger.name,
      intro: `${e.name} reacts to the Complication.`,
      outcome:
        e.hp > before
          ? `${e.name} regains ${e.hp - before} HP (${e.hp}/${e.maxHp}).`
          : `${e.name} is already at full strength.`,
      tone: e.hp > before ? 'failure' : 'neutral',
    })
    return
  }
  if (drawer.hp <= 0) return
  strikePlayer(
    engine,
    e,
    { name: trigger.name, attackValue: effect.attackValue, damage: effect.damage },
    drawer,
    `${e.name} seizes the opening and lunges at ${drawer.name}.`,
    { interceptable: true },
  )
}

/** A Complication, including the one a Critical Failure generates, sets off enemy triggers. */
export function runTriggers(engine: Engine, drawer: BattlePlayer, result: TestResult) {
  if (!drewComplication(result)) return
  for (const e of livingEnemies(engine.b)) {
    for (const trigger of ENEMIES_BY_ID[e.defId]?.triggers ?? []) {
      if (engine.b.result !== 'ongoing') return
      applyTrigger(engine, e, trigger, drawer)
    }
  }
}

export function playerTest(
  engine: Engine,
  p: BattlePlayer,
  attribute: SpecialKey,
  difficulty: number,
  bonuses: TestBonus[] = [],
): SkillTestOutcome {
  const rolled = performSkillTest(p.bag, attribute, p.special[attribute], difficulty, engine.rng, 0, bonuses)
  const test = offerPrayer(engine, p, rolled)
  afterTest(p, test.result, test.passed)
  return test
}

export interface AttackOptions {
  title?: string
  intro?: string
  attribute?: SpecialKey
  bonusDamage?: number
  /** Power committed before the draw, added to the attack result. */
  power?: number
  /** Called when the attack hits, for effects such as sealing a token. */
  onHit?: (e: BattleEnemy) => string
}

export function attackEnemy(engine: Engine, p: BattlePlayer, e: BattleEnemy, options: AttackOptions = {}): boolean {
  const { b } = engine
  const attribute = options.attribute ?? ATTACK_ATTRIBUTE
  const defense = enemyDefense(e)
  const test = playerTest(engine, p, attribute, defense, options.power ? [{ label: 'Power', value: options.power }] : [])
  const title = options.title ?? 'Attack'
  const intro = options.intro ?? `${p.name} attacks ${e.name}.`
  const might = test.result.drawn.filter((d) => d.tokenId === 'might').length

  if (!test.passed) {
    addStep(engine, {
      actor: playerActorOf(p),
      title,
      intro,
      test,
      testMode: 'check',
      outcome: `${p.name} misses ${e.name}.`,
      tone: 'failure',
    })
    runTriggers(engine, p, test.result)
    return false
  }

  const damage = 1 + might + (options.bonusDamage ?? 0)
  const extra = options.onHit?.(e) ?? ''
  const groupId = groupOf(b, e.id)
  const defeated = damageEnemy(b, e, damage)
  if (defeated) engine.defeats.push({ enemyId: e.id, byKey: p.key, groupId, viaAttack: true })
  const flanked = flankingRecovery(p, e, b)
  addStep(engine, {
    actor: playerActorOf(p),
    title,
    intro,
    test,
    testMode: 'check',
    outcome: `${p.name} hits ${e.name} for ${damage} damage (${e.hp}/${e.maxHp} HP).${
      might > 0 ? ` Might adds ${might}.` : ''
    }${extra ? ` ${extra}` : ''}${flanked}${defeated ? ` ${e.name} is defeated!` : ''}`,
    tone: 'success',
  })
  updateResult(b)
  runTriggers(engine, p, test.result)
  return true
}

/** Flanking: once a round, hitting an enemy beside one of your allies recovers a Cunning. */
function flankingRecovery(p: BattlePlayer, e: BattleEnemy, b: BattleState): string {
  const used = p.usedThisRound ?? []
  if (!p.abilityIds.includes('flanking') || p.hp <= 0 || used.includes('flanking')) return ''
  if (!playersInGroup(b, groupOf(b, e.id)).some((a) => a.key !== p.key)) return ''
  if (!recoverToken(p, 'cunning')) return ''
  p.usedThisRound = [...used, 'flanking']
  return ' Flanking: recovers 1 Cunning.'
}

/** Seals the committed tokens on an enemy. They stay there until it is defeated. */
export function sealOn(p: BattlePlayer, e: BattleEnemy, commit: Commitment): string {
  for (const token of commit.tokens) {
    token.sealed = true
    const stoodIn = token.tokenId !== commit.resourceId
    e.sealed.push({
      tokenId: token.tokenId,
      byKey: p.key,
      ...(stoodIn ? { as: commit.resourceId, value: token.value } : {}),
    })
  }
  const names = commit.tokens.map((t) => tokenName(t.tokenId)).join(' and ')
  return `${names} ${commit.tokens.length > 1 ? 'are' : 'is'} sealed on ${e.name}.`
}

export function defend(engine: Engine, p: BattlePlayer, armor = 0) {
  const attribute = DEFEND_ATTRIBUTE
  const result = drawTest(p.bag, engine.rng)
  const attributeValue = p.special[attribute]
  const total = result.total + attributeValue + armor
  const failed = result.outcome === 'critical-failure'
  afterTest(p, result, !failed)
  const gain = failed ? 0 : Math.max(0, total)
  const before = p.defense
  p.defense += gain
  const test: SkillTestOutcome = {
    attribute,
    attributeValue,
    difficulty: 0,
    penalty: 0,
    bonuses: armor > 0 ? [{ label: 'Armor', value: armor }] : [],
    result,
    total,
    passed: gain > 0,
  }
  addStep(engine, {
    actor: playerActorOf(p),
    title: 'Defend',
    intro: `${p.name} braces for the enemy's attacks.`,
    test,
    testMode: 'score',
    resultLine: failed
      ? `Critical Failure: nothing is added. Defense stays at ${p.defense}`
      : `Tokens ${fmtSigned(result.total)} + Agility ${attributeValue}${armor > 0 ? ` + Armor ${armor}` : ''} = ${total}: Defense ${before} \u2192 ${p.defense}`,
    outcome:
      gain > 0
        ? `${p.name} has ${p.defense} Defense this round.`
        : `${p.name} fumbles and gains no Defense this round.`,
    tone: gain > 0 ? 'success' : 'failure',
  })
  runTriggers(engine, p, result)
}

export function changeEngagement(engine: Engine, p: BattlePlayer, targetGroup: string, withTest: boolean) {
  const { b } = engine
  const destination = targetGroup === NEW_GROUP ? 'a group of their own' : describeGroup(b, targetGroup)
  const move = () => moveToGroup(b, p.key, targetGroup === NEW_GROUP ? newGroup(b) : targetGroup)
  if (!withTest) {
    move()
    addStep(engine, {
      actor: playerActorOf(p),
      title: 'Slip Away',
      intro: `${p.name} slips away through the chaos.`,
      outcome: `${p.name} moves to ${destination}.`,
      tone: 'success',
    })
    return
  }
  const difficulty = engageDifficulty(b, p, targetGroup)
  const test = playerTest(engine, p, ENGAGE_ATTRIBUTE, difficulty.total)
  const passed = test.passed
  if (passed) move()
  addStep(engine, {
    actor: playerActorOf(p),
    title: 'Change engagement',
    intro: `${p.name} tries to move to ${destination}.`,
    test,
    testMode: 'check',
    testHeading: `Agility test \u00b7 Difficulty ${difficulty.total} (${engageBreakdown(difficulty).join(', ')})`,
    outcome: passed ? `${p.name} gets there.` : `${p.name} cannot break away and stays put.`,
    tone: passed ? 'success' : 'failure',
  })
  runTriggers(engine, p, test.result)
}

export function healAlly(engine: Engine, caster: BattlePlayer, target: BattlePlayer) {
  const before = target.hp
  target.hp = Math.min(target.maxHp, target.hp + HEAL_AMOUNT)
  addStep(engine, {
    actor: playerActorOf(caster),
    title: 'Heal',
    intro: `${caster.name} calls on healing light for ${target.name}.`,
    outcome: `${target.name} recovers ${target.hp - before} HP (${target.hp}/${target.maxHp}).`,
    tone: 'success',
  })
}

export function blessAlly(engine: Engine, caster: BattlePlayer, target: BattlePlayer) {
  target.bag = adjustBag(target.bag, 'bless', 1)
  addStep(engine, {
    actor: playerActorOf(caster),
    title: 'Bless',
    intro: `${caster.name} whispers a blessing over ${target.name}.`,
    outcome: `A Bless token (+2, Chain) is added to ${target.name}'s bag.`,
    tone: 'success',
  })
}

export function magicMissile(engine: Engine, caster: BattlePlayer, e: BattleEnemy) {
  const groupId = groupOf(engine.b, e.id)
  const defeated = damageEnemy(engine.b, e, 1)
  if (defeated) engine.defeats.push({ enemyId: e.id, byKey: caster.key, groupId, viaAttack: false })
  addStep(engine, {
    actor: playerActorOf(caster),
    title: 'Magic Missile',
    intro: `${caster.name} hurls a bolt of force at ${e.name}.`,
    outcome: `${e.name} takes 1 damage (${e.hp}/${e.maxHp} HP).${defeated ? ` ${e.name} is defeated!` : ''}`,
    tone: 'success',
  })
  updateResult(engine.b)
}

export function fireball(engine: Engine, caster: BattlePlayer, groupId: string, mana: number) {
  const { b } = engine
  const targets = enemiesInGroup(b, groupId)
  const allies = playersInGroup(b, groupId)
  const groupName = describeGroup(b, groupId)
  const fatigue = Math.floor(mana / 3)

  targets.forEach((e, i) => {
    if (e.hp <= 0) return
    const test = playerTest(engine, caster, 'intelligence', enemyDefense(e))
    const first = i === 0
    const intro = first
      ? `${caster.name} unleashes a fireball (${mana} Mana) on ${groupName}.`
      : `The fireball rolls over ${e.name}.`
    if (!test.passed) {
      addStep(engine, {
        actor: playerActorOf(caster),
        title: 'Fireball',
        intro,
        test,
        testMode: 'check',
        outcome: `${e.name} dodges the flames.`,
        tone: 'failure',
      })
    } else {
      const groupId = groupOf(b, e.id)
      const defeated = damageEnemy(b, e, mana)
      if (defeated) engine.defeats.push({ enemyId: e.id, byKey: caster.key, groupId, viaAttack: true })
      addStep(engine, {
        actor: playerActorOf(caster),
        title: 'Fireball',
        intro,
        test,
        testMode: 'check',
        outcome: `${e.name} takes ${mana} damage (${e.hp}/${e.maxHp} HP).${defeated ? ` ${e.name} is defeated!` : ''}`,
        tone: 'success',
      })
    }
    updateResult(b)
    runTriggers(engine, caster, test.result)
  })

  const burned = allies.filter((a) => a.hp > 0)
  if (burned.length > 0 || fatigue > 0) {
    const lines = burned.map((a) => {
      dealDamageToPlayer(a, mana)
      return `${a.name} takes ${mana} (${a.hp}/${a.maxHp} HP)${a.hp === 0 ? ', and falls' : ''}`
    })
    if (fatigue > 0) caster.bag = adjustBag(caster.bag, 'fatigue', fatigue)
    addStep(engine, {
      actor: playerActorOf(caster),
      title: 'Backlash',
      intro: 'The flames do not pick sides.',
      outcome: [
        lines.length > 0 ? `${lines.join('; ')}.` : '',
        fatigue > 0 ? `${caster.name} adds ${fatigue} Fatigue to their bag.` : '',
      ]
        .filter(Boolean)
        .join(' '),
      tone: 'failure',
    })
    updateResult(b)
  }
}
