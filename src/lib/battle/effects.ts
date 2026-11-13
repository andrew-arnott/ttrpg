import { ENEMIES_BY_ID, type EnemyAttack, type EnemyTrigger } from '../../data/enemies'
import { SPECIAL_LABELS, type SpecialKey } from '../../data/types'
import { drawTest, drewComplication, type TestResult } from '../drawTest'
import { performSkillTest, type SkillTestOutcome, type TestBonus } from '../skillTest'
import { recoverToken } from '../tokenFlow'
import { engageBreakdown, engageDifficulty, needsEngageTest } from './engagement'
import { planAttack } from './attackPlan'
import { settleTest, takeDamage, testBonuses } from '../characterTest'
import { enemyTargets } from './targets'
import { drawRulesFor } from './conditionRules'
import { gainCondition } from './conditions'
import { offerAllyHelp, offerHealer, sealFaith } from '../priestRules'
import { INTERCEPT_DEFENSE, offerIntercept, offerLastStand, offerShieldWall, steadyingPresenceBonus } from './reactions'
import { releaseCommitment, type Commitment } from './tokens'
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
import { DEFEND_ATTRIBUTE, EMPOWER_DAMAGE, ENGAGE_ATTRIBUTE, HEAL_AMOUNT, INSPIRING_COMMAND_BONUS, NEW_GROUP } from './types'
import type { BattleEnemy, BattlePlayer, BattleState } from './types'

/** What a finished test does to the tokens, and the notes about it for the step that follows. */
export function afterTest(engine: Engine, p: BattlePlayer, result: TestResult, succeeded: boolean) {
  engine.notes.push(...settleTest(p, result, succeeded, { round: engine.b.round, lethal: true, ask: engine.ask }))
  updateResult(engine.b)
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
  attack: EnemyAttack,
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
  const steadied = steadyingPresenceBonus(engine.b, e, target)
  const bonus = (options.defenseBonus ?? 0) + steadied
  const bonusLabel = [options.defenseBonus ? options.bonusLabel : '', steadied ? 'Steadying Presence' : ''].filter(Boolean).join(' and ')
  const cover = offerShieldWall(engine, e, attack.name, target, Math.max(0, raw - bonus))
  const value = cover.remaining
  const defense = target.defense
  const breaks = value > defense
  target.defense = Math.max(0, defense - value)

  const resultLine = `Attack ${raw}${bonus > 0 ? ` - ${bonus} ${bonusLabel}` : ''}${cover.note} against Defense ${defense}: ${breaks ? 'breaks through' : 'blocked'}`
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
  const { dealt, absorbed } = takeDamage(target, Math.max(0, attack.damage - reduction), true)
  const notes = [
    reduction > 0 ? `Disabled: damage reduced by ${reduction}.` : '',
    absorbed > 0 ? `${absorbed} absorbed by Shield.` : '',
  ].filter(Boolean)
  const stood = target.hp === 0 && offerLastStand(engine, target)
  const falls = stood ? ` Last Stand: ${target.name} stays on their feet at 1 HP.` : target.hp === 0 ? ` ${target.name} falls!` : ''
  const gained = attack.condition ? ` ${gainCondition(engine, target, attack.condition)}` : ''
  addStep(engine, {
    actor: enemyActorOf(e),
    title: attack.name,
    intro,
    resultLine,
    clash,
    outcome:
      dealt > 0
        ? `${target.name} takes ${dealt} damage (${target.hp}/${target.maxHp} HP).${notes.length ? ` ${notes.join(' ')}` : ''}${falls}${gained}`
        : `The blow lands but does no damage. ${notes.join(' ')}${gained}`.trim(),
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
  if (effect.kind === 'condition') {
    const outcome = gainCondition(engine, drawer, effect.conditionId)
    addStep(engine, {
      actor: enemyActorOf(e),
      title: trigger.name,
      intro: `${e.name} reacts to the Complication.`,
      outcome,
      tone: 'failure',
    })
    return
  }
  const { kind: _kind, ...stats } = effect
  strikePlayer(
    engine,
    e,
    { name: trigger.name, ...stats },
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
      if (e.unwarded && trigger.effect.kind === 'heal') continue
      if (!trigger.global && groupOf(engine.b, e.id) !== groupOf(engine.b, drawer.key)) continue
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
  const all = testBonuses(p, engine.b.torchLevel, bonuses)
  const rolled = performSkillTest(p.bag, attribute, p.special[attribute], difficulty, engine.rng, all, drawRulesFor(p))
  const test = offerAllyHelp(engine.ask, engine.b.players, p, rolled)
  afterTest(engine, p, test.result, test.passed)
  return test
}

export interface AttackOptions {
  title?: string
  intro?: string
  attribute?: SpecialKey
  bonusDamage?: number
  /** Damage on a hit before bonuses. */
  damage?: number
  /** Power committed before the draw, added to the attack result. */
  power?: number
  /** A flat bonus to the attack's test result. */
  testBonus?: TestBonus
  /** The damage a hit deals in total, replacing the usual sum of bonuses. */
  totalDamage?: number
  /** Called when the attack hits, for effects such as sealing a token. */
  onHit?: (e: BattleEnemy) => string
}

export function attackEnemy(engine: Engine, p: BattlePlayer, e: BattleEnemy, options: AttackOptions = {}): boolean {
  const { b } = engine
  const plan = planAttack(p, { attribute: options.attribute, power: options.power, closeRange: groupOf(b, e.id) === groupOf(b, p.key) })
  const empowered = p.strikeBonus ?? 0
  p.strikeBonus = 0
  const test = playerTest(engine, p, plan.attribute, enemyDefense(e), [...plan.modifiers, ...(options.testBonus ? [options.testBonus] : [])])
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

  const damage =
    options.totalDamage ?? (options.damage ?? 1) + plan.extraDamage + might + (options.bonusDamage ?? 0) + empowered
  const groupId = groupOf(b, e.id)
  const extra = options.onHit?.(e) ?? ''
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
    }${empowered > 0 ? ` Empowered: +${empowered} damage.` : ''}${extra ? ` ${extra}` : ''}${flanked}${defeated ? ` ${e.name} is defeated!` : ''}`,
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

export function defend(engine: Engine, p: BattlePlayer, armor = 0, title = 'Defend') {
  const attribute = DEFEND_ATTRIBUTE
  const result = drawTest(p.bag, engine.rng, drawRulesFor(p))
  const attributeValue = p.special[attribute]
  const bonuses = testBonuses(p, engine.b.torchLevel, armor > 0 ? [{ label: 'Armor', value: armor }] : [])
  const total = result.total + attributeValue + bonuses.reduce((sum, x) => sum + x.value, 0)
  const failed = result.outcome === 'critical-failure'
  afterTest(engine, p, result, !failed)
  const gain = failed ? 0 : Math.max(0, total)
  const before = p.defense
  p.defense += gain
  const test: SkillTestOutcome = {
    attribute,
    attributeValue,
    difficulty: 0,
    bonuses,
    result,
    total,
    passed: gain > 0,
  }
  addStep(engine, {
    actor: playerActorOf(p),
    title,
    intro: `${p.name} braces for the enemy's attacks.`,
    test,
    testMode: 'score',
    resultLine: failed
      ? `Critical Failure: nothing is added. Defense stays at ${p.defense}`
      : `Tokens ${fmtSigned(result.total)} + Agility ${attributeValue}${bonuses.map((x) => ` ${x.value < 0 ? '-' : '+'} ${x.label} ${Math.abs(x.value)}`).join('')} = ${total}: Defense ${before} \u2192 ${p.defense}`,
    outcome:
      gain > 0
        ? `${p.name} has ${p.defense} Defense this round.`
        : `${p.name} fumbles and gains no Defense this round.`,
    tone: gain > 0 ? 'success' : 'failure',
  })
  runTriggers(engine, p, result)
}

export interface FreeMove {
  title: string
  intro: string
}

export function changeEngagement(
  engine: Engine,
  p: BattlePlayer,
  targetGroup: string,
  withTest: boolean,
  free: FreeMove = { title: 'Slip Away', intro: `${p.name} slips away through the chaos.` },
) {
  const { b } = engine
  const destination = targetGroup === NEW_GROUP ? 'a group of their own' : describeGroup(b, targetGroup)
  const move = () => moveToGroup(b, p.key, targetGroup === NEW_GROUP ? newGroup(b) : targetGroup)
  if (!withTest) {
    move()
    addStep(engine, {
      actor: playerActorOf(p),
      title: free.title,
      intro: free.intro,
      outcome: `${p.name} moves to ${destination}.`,
      tone: 'success',
    })
    return
  }
  if (!needsEngageTest(b, p)) {
    move()
    addStep(engine, {
      actor: playerActorOf(p),
      title: 'Change engagement',
      intro: `${p.name} is not engaged with anyone, so nothing holds them back.`,
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

/** Offers Healer to an ally who has just recovered HP or had conditions removed. */
export function offerHealerRelease(engine: Engine, ally: BattlePlayer, cause: string): string {
  return offerHealer(engine.ask, engine.b.players, ally, cause).note
}

export function healAlly(engine: Engine, caster: BattlePlayer, target: BattlePlayer, commit: Commitment) {
  const sealed = sealFaith(caster, target, commit)
  const before = target.hp
  target.hp = Math.min(target.maxHp, target.hp + HEAL_AMOUNT)
  const recovered = target.hp > before
  const healer = recovered ? offerHealerRelease(engine, target, 'recovered HP') : ''
  addStep(engine, {
    actor: playerActorOf(caster),
    title: 'Heal',
    intro: `${caster.name} calls on healing light for ${target.name}.`,
    outcome: `${sealed} ${target.name} recovers ${target.hp - before} HP (${target.hp}/${target.maxHp}).${healer}`,
    tone: 'success',
  })
}

export function blessAlly(engine: Engine, caster: BattlePlayer, target: BattlePlayer, commit: Commitment) {
  const sealed = sealFaith(caster, target, commit)
  target.nextTestBonus = (target.nextTestBonus ?? 0) + 1
  addStep(engine, {
    actor: playerActorOf(caster),
    title: 'Bless',
    intro: `${caster.name} whispers a blessing over ${target.name}.`,
    outcome: `${sealed} ${target.name} gains +1 to their next test.`,
    tone: 'success',
  })
}

export function empowerStrike(engine: Engine, caster: BattlePlayer, target: BattlePlayer, commit: Commitment) {
  const sealed = sealFaith(caster, target, commit)
  target.strikeBonus = (target.strikeBonus ?? 0) + EMPOWER_DAMAGE
  addStep(engine, {
    actor: playerActorOf(caster),
    title: 'Empower the Strike',
    intro: `${caster.name} lends ${target.name} their strength.`,
    outcome: `${sealed} ${target.name}'s next attack deals +${EMPOWER_DAMAGE} damage if it hits.`,
    tone: 'success',
  })
}

export function inspiringCommand(
  engine: Engine,
  caster: BattlePlayer,
  ally: BattlePlayer,
  enemy: BattleEnemy,
  commit: Commitment,
) {
  const sealed = sealFaith(caster, ally, commit)
  attackEnemy(engine, ally, enemy, {
    title: 'Inspiring Command',
    intro: `${caster.name} calls out and ${ally.name} attacks ${enemy.name} at once. ${sealed}`,
    testBonus: { label: 'Inspiring Command', value: INSPIRING_COMMAND_BONUS },
  })
}

export function moveAsOne(
  engine: Engine,
  caster: BattlePlayer,
  ally: BattlePlayer,
  targetGroup: string,
  commit: Commitment,
) {
  const sealed = sealFaith(caster, ally, commit)
  changeEngagement(engine, ally, targetGroup, false, {
    title: 'Move as One',
    intro: `${caster.name} guides ${ally.name} across the fight. ${sealed}`,
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
  if (defeated) chainReaction(engine, caster, [e])
}

/** Chain Reaction: once a round, a spell that defeats an enemy deals 1 damage to another enemy in its group. */
export function chainReaction(engine: Engine, caster: BattlePlayer, defeated: BattleEnemy[]) {
  const { b } = engine
  const used = caster.usedThisRound ?? []
  if (!caster.abilityIds.includes('chainReaction') || caster.hp <= 0 || used.includes('chainReaction')) return
  for (const fallen of defeated) {
    const group = groupOf(b, fallen.id)
    const neighbours = enemiesInGroup(b, group)
    if (neighbours.length === 0) continue
    let target = neighbours[0]
    if (neighbours.length > 1) {
      const answer = engine.ask({
        abilityId: 'chainReaction',
        reactorKey: caster.key,
        title: 'Chain Reaction',
        prompt: `${fallen.name} falls to ${caster.name}'s spell. Chain Reaction deals 1 damage to another enemy in its group.`,
        cost: 'free',
        targets: enemyTargets(neighbours),
        required: true,
        confirmLabel: 'Strike it',
      })
      target = neighbours.find((e) => e.id === answer.targetId) ?? neighbours[0]
    }
    caster.usedThisRound = [...used, 'chainReaction']
    const down = damageEnemy(b, target, 1)
    if (down) engine.defeats.push({ enemyId: target.id, byKey: caster.key, groupId: group, viaAttack: false })
    addStep(engine, {
      actor: playerActorOf(caster),
      title: 'Chain Reaction',
      intro: `${fallen.name}'s fall sets off a ripple of magic.`,
      outcome: `${target.name} takes 1 damage (${target.hp}/${target.maxHp} HP).${down ? ` ${target.name} is defeated!` : ''}`,
      tone: 'success',
    })
    updateResult(b)
    return
  }
}

/**
 * Selective Casting: once per spell, one ally who would take damage from it takes none. Returns that
 * ally, if there is one. With a choice to make, the Wizard is asked.
 */
export function selectiveCasting(engine: Engine, caster: BattlePlayer, exposed: BattlePlayer[]): BattlePlayer | null {
  if (!caster.abilityIds.includes('selectiveCasting')) return null
  const allies = exposed.filter((a) => a.key !== caster.key && a.hp > 0)
  if (allies.length === 0) return null
  if (allies.length === 1) return allies[0]
  const answer = engine.ask({
    abilityId: 'selectiveCasting',
    reactorKey: caster.key,
    title: 'Selective Casting',
    prompt: `${caster.name}'s spell would hurt several allies. Choose one who takes no damage from it.`,
    cost: 'free',
    targets: allies.map((a) => ({ id: a.key, label: `${a.name} (${a.hp}/${a.maxHp} HP)` })),
    required: true,
    confirmLabel: 'Spare them',
  })
  return allies.find((a) => a.key === answer.targetId) ?? allies[0]
}

/** Damage a spell deals to allies standing in its group, less the one Selective Casting spares. */
export function spellBacklash(engine: Engine, caster: BattlePlayer, allies: BattlePlayer[], amount: number): string[] {
  const exposed = allies.filter((a) => a.hp > 0)
  const spared = selectiveCasting(engine, caster, exposed)
  return exposed.map((a) => {
    if (a === spared) return `${a.name} is spared by Selective Casting`
    takeDamage(a, amount, true)
    const stood = a.hp === 0 && offerLastStand(engine, a)
    return `${a.name} takes ${amount} (${a.hp}/${a.maxHp} HP)${stood ? ', and stays up with Last Stand' : a.hp === 0 ? ', and falls' : ''}`
  })
}

export interface Volley {
  title: string
  intro: string
  damage: number
  dodge: string
}

/**
 * One Intelligence draw compared with every enemy in a group, like Fireball. Each enemy it reaches takes
 * `damage`. Returns the enemies that were defeated.
 */
export function intelligenceVolley(engine: Engine, caster: BattlePlayer, groupId: string, volley: Volley): BattleEnemy[] {
  const { b } = engine
  const living = enemiesInGroup(b, groupId).filter((e) => e.hp > 0)
  if (living.length === 0) return []
  const lowest = Math.min(...living.map((e) => enemyDefense(e)))
  const test = playerTest(engine, caster, 'intelligence', lowest)
  const outcome = test.result.outcome
  const reaches = (e: BattleEnemy) =>
    outcome === 'critical-success' || (outcome !== 'critical-failure' && test.total >= enemyDefense(e))
  const fallen: BattleEnemy[] = []
  const lines = living.map((e) => {
    if (!reaches(e)) return `${e.name} (Defense ${enemyDefense(e)}) ${volley.dodge}`
    const where = groupOf(b, e.id)
    const defeated = damageEnemy(b, e, volley.damage)
    if (defeated) {
      engine.defeats.push({ enemyId: e.id, byKey: caster.key, groupId: where, viaAttack: true })
      fallen.push(e)
    }
    return `${e.name} takes ${volley.damage} damage (${e.hp}/${e.maxHp} HP).${defeated ? ` ${e.name} is defeated!` : ''}`
  })
  addStep(engine, {
    actor: playerActorOf(caster),
    title: volley.title,
    intro: volley.intro,
    test,
    testMode: 'score',
    testHeading: 'Intelligence test against each enemy in the group',
    resultLine: `Tokens ${fmtSigned(test.result.total)} + Intelligence ${test.attributeValue}${test.bonuses.map((x) => ` ${x.value < 0 ? '-' : '+'} ${x.label} ${Math.abs(x.value)}`).join('')} = ${test.total}`,
    outcome: lines.join(' '),
    tone: living.some(reaches) ? 'success' : 'failure',
  })
  updateResult(b)
  runTriggers(engine, caster, test.result)
  return fallen
}

export function fireball(engine: Engine, caster: BattlePlayer, groupId: string, mana: number) {
  const { b } = engine
  const allies = playersInGroup(b, groupId)
  const fatigue = Math.floor(mana / 3)

  const fallen = intelligenceVolley(engine, caster, groupId, {
    title: 'Fireball',
    intro: `${caster.name} unleashes a fireball (${mana} Mana) on ${describeGroup(b, groupId)}. One result is compared with every enemy's Defense.`,
    damage: mana,
    dodge: 'dodges the flames.',
  })
  chainReaction(engine, caster, fallen)

  const burned = allies.filter((a) => a.hp > 0)
  if (burned.length > 0 || fatigue > 0) {
    const lines = spellBacklash(engine, caster, burned, mana)
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

/**
 * Sweeping Blow: one attack test against every enemy in the player's engagement group. The result is
 * compared with each enemy's Defense, like a Fireball, and every enemy it reaches takes damage.
 */
export function sweepingBlow(engine: Engine, p: BattlePlayer, power: number) {
  const { b } = engine
  const groupId = groupOf(b, p.key)
  const living = enemiesInGroup(b, groupId).filter((e) => e.hp > 0)
  if (living.length === 0) return
  const plan = planAttack(p, { power, closeRange: true })
  const lowest = Math.min(...living.map((e) => enemyDefense(e)))
  const test = playerTest(engine, p, plan.attribute, lowest, plan.modifiers)
  const outcome = test.result.outcome
  const might = test.result.drawn.filter((d) => d.tokenId === 'might').length
  const damage = 1 + plan.extraDamage + might
  const reaches = (e: BattleEnemy) =>
    outcome === 'critical-success' || (outcome !== 'critical-failure' && test.total >= enemyDefense(e))
  const lines = living.map((e) => {
    if (!reaches(e)) return `${e.name} (Defense ${enemyDefense(e)}) ducks the blow.`
    const defeated = damageEnemy(b, e, damage)
    if (defeated) engine.defeats.push({ enemyId: e.id, byKey: p.key, groupId, viaAttack: true })
    return `${e.name} takes ${damage} damage (${e.hp}/${e.maxHp} HP).${defeated ? ` ${e.name} is defeated!` : ''}`
  })
  addStep(engine, {
    actor: playerActorOf(p),
    title: 'Sweeping Blow',
    intro: `${p.name} swings through everything in reach. One result is compared with every enemy's Defense.`,
    test,
    testMode: 'score',
    testHeading: `${SPECIAL_LABELS[plan.attribute]} test against each enemy in the group`,
    resultLine: `Tokens ${fmtSigned(test.result.total)} + ${SPECIAL_LABELS[plan.attribute]} ${test.attributeValue}${test.bonuses.map((x) => ` ${x.value < 0 ? '-' : '+'} ${x.label} ${Math.abs(x.value)}`).join('')} = ${test.total}`,
    outcome: lines.join(' '),
    tone: living.some(reaches) ? 'success' : 'failure',
  })
  updateResult(b)
  runTriggers(engine, p, test.result)
}
