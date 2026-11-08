import { ENEMIES_BY_ID, type EnemyAttack, type EnemyTrigger } from '../../data/enemies'
import type { SpecialKey } from '../../data/types'
import { drawTest, drewComplication, type TestResult } from '../drawTest'
import type { SkillTestOutcome } from '../skillTest'
import { performSkillTest } from '../skillTest'
import {
  adjustBag,
  addStep,
  describeGroup,
  enemiesInGroup,
  enemyActorOf,
  enemyDefense,
  fmtSigned,
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
import { ATTACK_ATTRIBUTE, DEFEND_ATTRIBUTE, ENGAGE_ATTRIBUTE, ENGAGE_DIFFICULTY, HEAL_AMOUNT, NEW_GROUP } from './types'
import type { BattleEnemy, BattlePlayer, BattleState } from './types'

/** Shields wait in play for the next damage; Bless tokens are used up once drawn. */
export function afterTest(p: BattlePlayer, result: TestResult) {
  const shields = result.drawn.filter((d) => d.tokenId === 'shield').length
  if (shields > 0) {
    p.shieldsInPlay += shields
    p.bag = adjustBag(p.bag, 'shield', -shields)
  }
  const blessed = result.drawn.filter((d) => d.tokenId === 'bless').length
  if (blessed > 0) p.bag = adjustBag(p.bag, 'bless', -blessed)
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
    if (owner) owner.resources[sealed.tokenId] = (owner.resources[sealed.tokenId] ?? 0) + 1
  }
  e.sealed = []
}

export function damageEnemy(b: BattleState, e: BattleEnemy, amount: number): boolean {
  e.hp = Math.max(0, e.hp - amount)
  if (e.hp > 0) return false
  releaseSealedTokens(b, e)
  return true
}


/** One enemy strike against one player. Attack value wears down Defense; damage lands only if it exceeds it. */
export function strikePlayer(
  engine: Engine,
  e: BattleEnemy,
  attack: Pick<EnemyAttack, 'name' | 'attackValue' | 'damage'>,
  target: BattlePlayer,
  intro: string,
): void {
  const value = attack.attackValue + e.empowered
  const defense = target.defense
  const breaks = value > defense
  target.defense = Math.max(0, defense - value)

  const resultLine = `Attack ${value} against Defense ${defense}: ${breaks ? 'breaks through' : 'blocked'}`
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

export function playerTest(engine: Engine, p: BattlePlayer, attribute: SpecialKey, difficulty: number): SkillTestOutcome {
  const test = performSkillTest(p.bag, attribute, p.special[attribute], difficulty, engine.rng)
  afterTest(p, test.result)
  return test
}

export interface AttackOptions {
  title?: string
  intro?: string
  attribute?: SpecialKey
  bonusDamage?: number
  /** Called when the attack hits, for effects such as sealing a token. */
  onHit?: (e: BattleEnemy) => string
}

export function attackEnemy(engine: Engine, p: BattlePlayer, e: BattleEnemy, options: AttackOptions = {}): boolean {
  const { b } = engine
  const attribute = options.attribute ?? ATTACK_ATTRIBUTE
  const defense = enemyDefense(e)
  const test = playerTest(engine, p, attribute, defense)
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
  const defeated = damageEnemy(b, e, damage)
  addStep(engine, {
    actor: playerActorOf(p),
    title,
    intro,
    test,
    testMode: 'check',
    outcome: `${p.name} hits ${e.name} for ${damage} damage (${e.hp}/${e.maxHp} HP).${
      might > 0 ? ` Might adds ${might}.` : ''
    }${extra ? ` ${extra}` : ''}${defeated ? ` ${e.name} is defeated!` : ''}`,
    tone: 'success',
  })
  updateResult(b)
  runTriggers(engine, p, test.result)
  return true
}

export function sealOn(p: BattlePlayer, e: BattleEnemy, tokenId: string): string {
  e.sealed.push({ tokenId, byKey: p.key })
  return `${tokenName(tokenId)} is sealed on ${e.name}.`
}

export function defend(engine: Engine, p: BattlePlayer) {
  const attribute = DEFEND_ATTRIBUTE
  const result = drawTest(p.bag, engine.rng)
  afterTest(p, result)
  const attributeValue = p.special[attribute]
  const total = result.total + attributeValue
  const failed = result.outcome === 'critical-failure'
  const gain = failed ? 0 : Math.max(0, total)
  const before = p.defense
  p.defense += gain
  const test: SkillTestOutcome = {
    attribute,
    attributeValue,
    difficulty: 0,
    penalty: 0,
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
      : `Tokens ${fmtSigned(result.total)} + Agility ${attributeValue} = ${total}: Defense ${before} \u2192 ${p.defense}`,
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
  const test = playerTest(engine, p, ENGAGE_ATTRIBUTE, ENGAGE_DIFFICULTY)
  const passed = test.passed
  if (passed) move()
  addStep(engine, {
    actor: playerActorOf(p),
    title: 'Change engagement',
    intro: `${p.name} tries to move to ${destination}.`,
    test,
    testMode: 'check',
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
  const defeated = damageEnemy(engine.b, e, 1)
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
      const defeated = damageEnemy(b, e, mana)
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
