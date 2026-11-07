import { ENEMIES_BY_ID, type EnemyAttack, type EnemyDef, type EnemyTrigger } from '../data/enemies'
import { PROFESSIONS } from '../data/professions'
import { STANDARD_BAG, TOKENS } from '../data/tokens'
import type { Ability, SpecialKey, SpecialSpread, TokenStack } from '../data/types'
import { drawTest, type Rng, type TestResult } from './drawTest'
import type { PartyMember, Preparation } from './dungeonState'
import { playerActor, type ResolutionStep, type StepActor } from './resolution'
import { performSkillTest, type SkillTestOutcome } from './skillTest'

export const ACTIONS_PER_TURN = 2
export const ATTACK_ATTRIBUTE: SpecialKey = 'strength'
export const DEFEND_ATTRIBUTE: SpecialKey = 'agility'
export const ENGAGE_ATTRIBUTE: SpecialKey = 'agility'
export const ENGAGE_DIFFICULTY = 4
export const FORTIFY_DEFENSE = 2
export const BACKSTAB_DAMAGE = 2
export const HEAL_AMOUNT = 2
export const MAX_FIREBALL_MANA = 3
/** Difficulty for the enemies' Perception test to surprise the party, before watchfulness and light. */
export const SURPRISE_BASE_DIFFICULTY = 4
const LOG_LIMIT = 40
const NEW_GROUP = 'new'

export interface BattlePlayer {
  key: string
  name: string
  professionId: string
  hp: number
  maxHp: number
  special: SpecialSpread
  bag: TokenStack[]
  resources: Record<string, number>
  abilityIds: string[]
  /** Shield tokens drawn and waiting to absorb the next damage taken. */
  shieldsInPlay: number
  /** Defense score for this round. Resets at the end of the round. */
  defense: number
  colorIndex: number
}

export interface SealedToken {
  tokenId: string
  byKey: string
}

export interface BattleEnemy {
  id: string
  defId: string
  name: string
  hp: number
  maxHp: number
  defense: number
  sealed: SealedToken[]
  disabled: boolean
  provokedBy: string | null
  /** Extra attack value until the end of the round. */
  empowered: number
}

export type BattleResult = 'ongoing' | 'victory' | 'defeat'

export interface BattleState {
  round: number
  players: BattlePlayer[]
  enemies: BattleEnemy[]
  /** Combatant id to engagement group id. */
  groups: Record<string, string>
  nextGroup: number
  log: string[]
  result: BattleResult
  /** `players`: someone is choosing an action. `enemies`: everyone has acted and the enemies are next. */
  phase: 'players' | 'enemies'
  /** Index into `players` of whoever is choosing an action. */
  turnIndex: number
  /** Actions the current player has used this round. Fast abilities are free and do not count. */
  actionsUsed: number
  /** Steps leading into round 1, played once when the battle begins. */
  opening: ResolutionStep[]
}

export interface PlannedCombat {
  actionId: string
  targetId?: string
}

/** Inputs to the enemies' Perception test to surprise the party. */
export interface SurpriseCheck {
  perception: number
  modifiers: { label: string; value: number }[]
}

export interface TargetChoice {
  id: string
  label: string
}

export interface CombatOption {
  id: string
  slot: 'action' | 'fast'
  label: string
  description: string
  targets?: TargetChoice[]
  /**
   * The target must be in the player's own engagement group when the action resolves,
   * not when it is planned, so an earlier action can move the player into position.
   */
  requiresEngaged?: boolean
  disabledReason?: string
}

/** What to pre-select for a player: attack an engaged enemy if there is one, otherwise defend. */
export function suggestedAction(b: BattleState, p: BattlePlayer): PlannedCombat {
  const target = engagedEnemies(b, p)[0]
  return target ? { actionId: 'attack', targetId: target.id } : { actionId: 'defend' }
}

// --- lookups -----------------------------------------------------------

const allAbilities: Ability[] = PROFESSIONS.flatMap((p) => [...p.abilities, ...p.explorationAbilities])
const abilityById = (id: string): Ability | undefined => allAbilities.find((a) => a.id === id)

export const livingPlayers = (b: BattleState) => b.players.filter((p) => p.hp > 0)
export const livingEnemies = (b: BattleState) => b.enemies.filter((e) => e.hp > 0)

const sealedCount = (e: BattleEnemy, tokenId: string) => e.sealed.filter((s) => s.tokenId === tokenId).length

/** Exposed (Cunning sealed on the enemy) lowers its Defense. */
export const enemyDefense = (e: BattleEnemy) => Math.max(0, e.defense - sealedCount(e, 'cunning'))

const playerByKey = (b: BattleState, key: string) => b.players.find((p) => p.key === key)
const enemyById = (b: BattleState, id: string) => b.enemies.find((e) => e.id === id)

const groupOf = (b: BattleState, id: string) => b.groups[id]

const enemiesInGroup = (b: BattleState, groupId: string) =>
  livingEnemies(b).filter((e) => groupOf(b, e.id) === groupId)
const playersInGroup = (b: BattleState, groupId: string) =>
  livingPlayers(b).filter((p) => groupOf(b, p.key) === groupId)

export const engagedEnemies = (b: BattleState, p: BattlePlayer) => enemiesInGroup(b, groupOf(b, p.key))

function distinctGroupIds(b: BattleState): string[] {
  const living = new Set([...livingPlayers(b).map((p) => p.key), ...livingEnemies(b).map((e) => e.id)])
  return [...new Set(Object.entries(b.groups).filter(([id]) => living.has(id)).map(([, g]) => g))]
}

export interface EngagementGroup {
  id: string
  players: BattlePlayer[]
  enemies: BattleEnemy[]
}

/** Engagement groups that still have someone standing in them. */
export function engagementGroups(b: BattleState): EngagementGroup[] {
  return distinctGroupIds(b).map((id) => ({ id, players: playersInGroup(b, id), enemies: enemiesInGroup(b, id) }))
}

export function describeGroup(b: BattleState, groupId: string): string {
  const names = [...playersInGroup(b, groupId), ...enemiesInGroup(b, groupId)].map((c) => c.name)
  return names.length > 0 ? names.join(' + ') : 'empty group'
}

const fmtSigned = (n: number) => (n > 0 ? `+${n}` : `${n}`)

function shuffled<T>(items: T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const pick = <T>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)]

function adjustBag(bag: TokenStack[], tokenId: string, delta: number): TokenStack[] {
  const existing = bag.find((s) => s.tokenId === tokenId)
  if (!existing) return delta > 0 ? [...bag, { tokenId, count: delta }] : bag
  return bag
    .map((s) => (s.tokenId === tokenId ? { ...s, count: s.count + delta } : s))
    .filter((s) => s.count > 0)
}

function parseCost(cost: string): { tokenId: string; amount: number } | null {
  const match = /^(\d+)\s+([A-Za-z]+)$/.exec(cost.trim())
  if (!match) return null
  return { tokenId: match[2].toLowerCase(), amount: Number(match[1]) }
}

const tokenName = (tokenId: string) => TOKENS[tokenId]?.name ?? tokenId

// --- creating a battle -------------------------------------------------

function nameEnemies(defs: EnemyDef[]): { id: string; name: string; def: EnemyDef }[] {
  const totals = new Map<string, number>()
  defs.forEach((d) => totals.set(d.id, (totals.get(d.id) ?? 0) + 1))
  const seen = new Map<string, number>()
  return defs.map((def) => {
    const index = seen.get(def.id) ?? 0
    seen.set(def.id, index + 1)
    const many = (totals.get(def.id) ?? 0) > 1
    const letter = String.fromCharCode(65 + index)
    return { id: many ? `${def.id}-${letter}` : def.id, name: many ? `${def.name} ${letter}` : def.name, def }
  })
}

interface Engine {
  b: BattleState
  rng: Rng
  steps: ResolutionStep[]
}

const playerActorOf = (p: BattlePlayer): StepActor => playerActor(p, p.colorIndex)

const enemyActorOf = (e: BattleEnemy): StepActor => ({
  key: e.id,
  name: e.name,
  artKind: 'enemy',
  artId: e.defId,
  colorIndex: -1,
})

function addStep(engine: Engine, step: ResolutionStep) {
  engine.steps.push(step)
  engine.b.log = [`${step.intro} ${step.outcome}`, ...engine.b.log].slice(0, LOG_LIMIT)
}

function updateResult(b: BattleState) {
  if (livingEnemies(b).length === 0) b.result = 'victory'
  else if (livingPlayers(b).length === 0) b.result = 'defeat'
}

function moveToGroup(b: BattleState, id: string, groupId: string) {
  b.groups[id] = groupId
}

function newGroup(b: BattleState): string {
  b.nextGroup += 1
  return `g${b.nextGroup}`
}

/**
 * Sets up a fight. Each player begins in their own engagement group and every
 * enemy engages a random player. Preparations made in the room beforehand
 * (Fortify, Set an Ambush) play out as the opening steps.
 */
export function startBattle(
  party: PartyMember[],
  prepared: Preparation[],
  enemyIds: string[],
  rng: Rng,
  arrival: string,
  surprise: SurpriseCheck | null,
): BattleState {
  const defs = enemyIds.flatMap((id) => (ENEMIES_BY_ID[id] ? [ENEMIES_BY_ID[id]] : []))
  const b: BattleState = {
    round: 1,
    players: party.map((m, i) => ({
      key: m.key,
      name: m.name,
      professionId: m.professionId,
      hp: m.hp,
      maxHp: m.maxHp,
      special: m.special,
      bag: m.bag.map((s) => ({ ...s })),
      resources: { ...m.resources },
      abilityIds: m.abilityIds,
      shieldsInPlay: 0,
      defense: 0,
      colorIndex: i,
    })),
    enemies: nameEnemies(defs).map(({ id, name, def }) => ({
      id,
      defId: def.id,
      name,
      hp: def.hp,
      maxHp: def.hp,
      defense: def.defense,
      sealed: [],
      disabled: false,
      provokedBy: null,
      empowered: 0,
    })),
    groups: {},
    nextGroup: 0,
    log: [arrival],
    result: 'ongoing',
    phase: 'players',
    turnIndex: 0,
    actionsUsed: 0,
    opening: [],
  }

  b.players.forEach((p) => moveToGroup(b, p.key, newGroup(b)))
  const targets = livingPlayers(b)
  b.enemies.forEach((e) => moveToGroup(b, e.id, groupOf(b, pick(targets, rng).key)))

  const engine: Engine = { b, rng, steps: [] }
  const engagements = distinctGroupIds(b).map((g) => describeGroup(b, g))
  addStep(engine, {
    actor: null,
    title: 'Battle!',
    intro: arrival,
    outcome: `Engaged: ${engagements.join('; ')}.`,
    tone: 'failure',
  })

  for (const prep of prepared) {
    const p = playerByKey(b, prep.memberKey)
    if (!p) continue
    if (prep.tag === 'Fortified') {
      p.defense += FORTIFY_DEFENSE
      addStep(engine, {
        actor: playerActorOf(p),
        title: 'Fortified',
        intro: `${p.name}'s preparations pay off.`,
        outcome: `${p.name} begins combat with +${FORTIFY_DEFENSE} Defense.`,
        tone: 'success',
      })
    } else if (prep.tag === 'Ambush set') {
      const victims = livingEnemies(b)
      if (victims.length > 0) {
        attackEnemy(engine, p, pick(victims, rng), { title: 'Ambush!', intro: `${p.name} springs the ambush.` })
      }
    }
  }

  if (surprise && b.result === 'ongoing') surpriseCheck(engine, surprise)

  updateResult(b)
  finalStep(engine)
  b.turnIndex = Math.max(0, b.players.findIndex((p) => p.hp > 0))
  b.opening = engine.steps
  return b
}

/**
 * The enemy group makes a Perception test to surprise the party. Stand Watch, Keep Watch
 * and a bright torch make that harder; a dim or dead torch makes it easier. If they
 * succeed they get a full round of attacks before anyone can act.
 */
function surpriseCheck(engine: Engine, check: SurpriseCheck) {
  const { b } = engine
  const difficulty = SURPRISE_BASE_DIFFICULTY + check.modifiers.reduce((sum, m) => sum + m.value, 0)
  const test = performSkillTest(STANDARD_BAG, 'perception', check.perception, difficulty, engine.rng)
  const lead = livingEnemies(b)[0]
  const surprised = test.passed
  const breakdown = [
    `${SURPRISE_BASE_DIFFICULTY} base`,
    ...check.modifiers.map((m) => `${fmtSigned(m.value)} ${m.label}`),
  ].join(', ')

  addStep(engine, {
    actor: lead ? enemyActorOf(lead) : null,
    title: 'Surprise?',
    intro: 'The enemies creep closer, trying to catch the party off guard.',
    test,
    testMode: 'score',
    testHeading: `Enemy Perception test \u00b7 Difficulty ${difficulty} (${breakdown})`,
    bagLabel: "The enemies' bag",
    resultLine: `Tokens ${fmtSigned(test.result.total)} + Perception ${check.perception} = ${test.total} against ${difficulty}: ${
      surprised ? 'the enemies succeed' : 'the party notices them'
    }`,
    outcome: surprised
      ? 'The enemies strike from the shadows! They get a surprise round before anyone can act.'
      : 'The party spots them in time. Combat begins on even terms.',
    tone: surprised ? 'failure' : 'success',
  })
  if (!surprised) return

  addStep(engine, {
    actor: null,
    title: 'Surprise round',
    intro: 'The party is caught flat-footed.',
    outcome: 'The enemies attack before anyone can defend.',
    tone: 'failure',
  })
  enemyActions(engine)
  resetRoundState(b)
}

// --- resolving tests and effects --------------------------------------

const complicationDrawn = (r: TestResult) => r.complication || r.outcome === 'critical-failure'

/** Shields wait in play for the next damage; Bless tokens are used up once drawn. */
function afterTest(p: BattlePlayer, result: TestResult) {
  const shields = result.drawn.filter((d) => d.tokenId === 'shield').length
  if (shields > 0) {
    p.shieldsInPlay += shields
    p.bag = adjustBag(p.bag, 'shield', -shields)
  }
  const blessed = result.drawn.filter((d) => d.tokenId === 'bless').length
  if (blessed > 0) p.bag = adjustBag(p.bag, 'bless', -blessed)
}

function dealDamageToPlayer(p: BattlePlayer, amount: number): { dealt: number; absorbed: number } {
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

function releaseSealedTokens(b: BattleState, e: BattleEnemy) {
  for (const sealed of e.sealed) {
    const owner = playerByKey(b, sealed.byKey)
    if (owner) owner.resources[sealed.tokenId] = (owner.resources[sealed.tokenId] ?? 0) + 1
  }
  e.sealed = []
}

function damageEnemy(b: BattleState, e: BattleEnemy, amount: number): boolean {
  e.hp = Math.max(0, e.hp - amount)
  if (e.hp > 0) return false
  releaseSealedTokens(b, e)
  return true
}

function spend(p: BattlePlayer, tokenId: string, amount: number) {
  p.resources[tokenId] = Math.max(0, (p.resources[tokenId] ?? 0) - amount)
}

/** One enemy strike against one player. Attack value wears down Defense; damage lands only if it exceeds it. */
function strikePlayer(
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

function applyTrigger(engine: Engine, e: BattleEnemy, trigger: EnemyTrigger, drawer: BattlePlayer) {
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
function runTriggers(engine: Engine, drawer: BattlePlayer, result: TestResult) {
  if (!complicationDrawn(result)) return
  for (const e of livingEnemies(engine.b)) {
    for (const trigger of ENEMIES_BY_ID[e.defId]?.triggers ?? []) {
      if (engine.b.result !== 'ongoing') return
      applyTrigger(engine, e, trigger, drawer)
    }
  }
}

function playerTest(engine: Engine, p: BattlePlayer, attribute: SpecialKey, difficulty: number): SkillTestOutcome {
  const test = performSkillTest(p.bag, attribute, p.special[attribute], difficulty, engine.rng)
  afterTest(p, test.result)
  return test
}

interface AttackOptions {
  title?: string
  intro?: string
  attribute?: SpecialKey
  bonusDamage?: number
  /** Called when the attack hits, for effects such as sealing a token. */
  onHit?: (e: BattleEnemy) => string
}

function attackEnemy(engine: Engine, p: BattlePlayer, e: BattleEnemy, options: AttackOptions = {}): boolean {
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

function sealOn(p: BattlePlayer, e: BattleEnemy, tokenId: string): string {
  e.sealed.push({ tokenId, byKey: p.key })
  return `${tokenName(tokenId)} is sealed on ${e.name}.`
}

function defend(engine: Engine, p: BattlePlayer) {
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

function changeEngagement(engine: Engine, p: BattlePlayer, targetGroup: string, withTest: boolean) {
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

function healAlly(engine: Engine, caster: BattlePlayer, target: BattlePlayer) {
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

function blessAlly(engine: Engine, caster: BattlePlayer, target: BattlePlayer) {
  target.bag = adjustBag(target.bag, 'bless', 1)
  addStep(engine, {
    actor: playerActorOf(caster),
    title: 'Bless',
    intro: `${caster.name} whispers a blessing over ${target.name}.`,
    outcome: `A Bless token (+2, Chain) is added to ${target.name}'s bag.`,
    tone: 'success',
  })
}

function magicMissile(engine: Engine, caster: BattlePlayer, e: BattleEnemy) {
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

function fireball(engine: Engine, caster: BattlePlayer, groupId: string, mana: number) {
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

// --- action catalogue --------------------------------------------------

const UNSUPPORTED = 'Not in the sample battle yet'

function enemyTargets(list: BattleEnemy[], engaged: BattleEnemy[] = list): TargetChoice[] {
  return list.map((e) => ({
    id: e.id,
    label: `${e.name} (${e.hp}/${e.maxHp} HP, Defense ${enemyDefense(e)})${engaged.includes(e) ? '' : ', not engaged'}`,
  }))
}

function groupTargets(b: BattleState, p: BattlePlayer, includeOwn: boolean): TargetChoice[] {
  const own = groupOf(b, p.key)
  const others = distinctGroupIds(b)
    .filter((g) => includeOwn || g !== own)
    .map((g) => ({ id: g, label: describeGroup(b, g) }))
  const aloneNow = playersInGroup(b, own).length === 1 && enemiesInGroup(b, own).length === 0
  return aloneNow ? others : [...others, { id: NEW_GROUP, label: 'Break away alone' }]
}

const allyTargets = (b: BattleState): TargetChoice[] =>
  livingPlayers(b).map((a) => ({ id: a.key, label: `${a.name} (${a.hp}/${a.maxHp} HP)` }))

function resourceGate(p: BattlePlayer, ability: Ability): string | undefined {
  const cost = parseCost(ability.cost)
  if (!cost) return undefined
  return (p.resources[cost.tokenId] ?? 0) < cost.amount ? `Needs ${cost.amount} ${tokenName(cost.tokenId)}` : undefined
}

function abilityOptions(b: BattleState, p: BattlePlayer): CombatOption[] {
  const engaged = engagedEnemies(b, p)
  const outside = livingEnemies(b).filter((e) => !engaged.includes(e))
  const options: CombatOption[] = []

  for (const ability of p.abilityIds.flatMap((id) => abilityById(id) ?? [])) {
    if (ability.types.length === 1 && (ability.types[0] === 'Interval' || ability.types[0] === 'Triggered')) continue
    const slot = ability.types.includes('Fast') ? 'fast' : 'action'
    const base = {
      slot,
      label: ability.name,
      description: `${ability.cost !== '—' ? `${ability.cost}. ` : ''}${ability.text}`,
    } as const
    const gate = resourceGate(p, ability)
    const id = `ability:${ability.id}`
    const living = livingEnemies(b)
    const noEnemies = living.length === 0 ? 'No enemy to target' : undefined

    switch (ability.id) {
      case 'provoke':
      case 'disable':
      case 'cheapShot':
      case 'smite':
        options.push({
          ...base,
          id,
          targets: enemyTargets(living, engaged),
          requiresEngaged: true,
          disabledReason: gate ?? noEnemies,
        })
        break
      case 'backstab':
        options.push({
          ...base,
          id,
          targets: enemyTargets(livingEnemies(b)),
          disabledReason: gate ?? (engaged.length > 0 ? 'You must not be engaged' : undefined),
        })
        break
      case 'slipAway':
        options.push({ ...base, id, targets: groupTargets(b, p, false), disabledReason: gate })
        break
      case 'heal':
      case 'blessAbility':
        options.push({ ...base, id, targets: allyTargets(b), disabledReason: gate })
        break
      case 'magicMissile':
        options.push({
          ...base,
          id,
          targets: enemyTargets(outside),
          disabledReason: gate ?? (outside.length === 0 ? 'No enemy outside your engagement group' : undefined),
        })
        break
      case 'fireball': {
        const groups = distinctGroupIds(b)
          .filter((g) => enemiesInGroup(b, g).length > 0)
          .map((g) => ({ id: g, label: describeGroup(b, g) }))
        const mana = p.resources.mana ?? 0
        for (let x = 1; x <= MAX_FIREBALL_MANA; x++) {
          options.push({
            ...base,
            id: `${id}:${x}`,
            label: `Fireball (${x} Mana)`,
            targets: groups,
            disabledReason: mana < x ? `Needs ${x} Mana` : groups.length === 0 ? 'No enemy to target' : undefined,
          })
        }
        break
      }
      default:
        options.push({ ...base, id, disabledReason: UNSUPPORTED })
    }
  }
  return options
}

export function availableCombatActions(b: BattleState, p: BattlePlayer): CombatOption[] {
  const engaged = engagedEnemies(b, p)
  const groups = groupTargets(b, p, false)
  return [
    {
      id: 'attack',
      slot: 'action',
      label: 'Attack',
      description: `Make a Strength test against an enemy you are engaged with, using its Defense. A hit deals 1 damage.`,
      targets: enemyTargets(livingEnemies(b), engaged),
      requiresEngaged: true,
      disabledReason: livingEnemies(b).length === 0 ? 'No enemy to target' : undefined,
    },
    {
      id: 'defend',
      slot: 'action',
      label: 'Defend',
      description: 'Make an Agility test and add the result to your Defense score for the round.',
    },
    {
      id: 'engage',
      slot: 'action',
      label: 'Change engagement',
      description: `Make an Agility test (Difficulty ${ENGAGE_DIFFICULTY}) to move to another engagement group.`,
      targets: groups,
      disabledReason: groups.length === 0 ? 'Nowhere to go' : undefined,
    },
    ...abilityOptions(b, p),
  ]
}

// --- resolving a round -------------------------------------------------

function isValid(b: BattleState, p: BattlePlayer, planned: PlannedCombat): CombatOption | undefined {
  const option = availableCombatActions(b, p).find((o) => o.id === planned.actionId)
  if (!option || option.disabledReason) return undefined
  if (option.targets && !option.targets.some((t) => t.id === planned.targetId)) return undefined
  if (option.requiresEngaged && !engagedEnemies(b, p).some((e) => e.id === planned.targetId)) return undefined
  return option
}

function performAction(engine: Engine, p: BattlePlayer, planned: PlannedCombat) {
  const { b } = engine
  const option = isValid(b, p, planned)
  if (!option) {
    addStep(engine, {
      actor: playerActorOf(p),
      title: 'No move',
      intro: `${p.name} hesitates.`,
      outcome: 'That is no longer possible, so the moment passes.',
      tone: 'neutral',
    })
    return
  }

  const target = planned.targetId ?? ''
  const [, abilityId, extra] = option.id.split(':')
  const enemy = enemyById(b, target)

  if (option.id === 'attack' && enemy) {
    attackEnemy(engine, p, enemy)
  } else if (option.id === 'defend') {
    defend(engine, p)
  } else if (option.id === 'engage') {
    changeEngagement(engine, p, target, true)
  } else if (abilityId) {
    const ability = abilityById(abilityId)
    const cost = ability ? parseCost(ability.cost) : null
    if (cost && abilityId !== 'fireball') spend(p, cost.tokenId, cost.amount)
    const ally = playerByKey(b, target)

    switch (abilityId) {
      case 'provoke':
        if (enemy) {
          attackEnemy(engine, p, enemy, {
            title: 'Provoke',
            onHit: (e) => {
              e.provokedBy = p.key
              moveToGroup(b, e.id, groupOf(b, p.key))
              return `${sealOn(p, e, 'resolve')} ${e.name} is Provoked and engages ${p.name}.`
            },
          })
        }
        break
      case 'disable':
        if (enemy) {
          attackEnemy(engine, p, enemy, {
            title: 'Disable',
            onHit: (e) => {
              e.disabled = true
              return `${sealOn(p, e, 'resolve')} Its damage is reduced for each Resolve sealed.`
            },
          })
        }
        break
      case 'cheapShot':
        if (enemy) {
          attackEnemy(engine, p, enemy, {
            title: 'Cheap Shot',
            onHit: (e) => `${sealOn(p, e, 'cunning')} ${e.name} is Exposed: Defense ${enemyDefense(e)}.`,
          })
        }
        break
      case 'smite':
        if (enemy) attackEnemy(engine, p, enemy, { title: 'Smite' })
        break
      case 'backstab':
        if (enemy) {
          moveToGroup(b, p.key, groupOf(b, enemy.id))
          attackEnemy(engine, p, enemy, {
            title: 'Backstab',
            intro: `${p.name} slips behind ${enemy.name} and strikes.`,
            bonusDamage: BACKSTAB_DAMAGE,
          })
        }
        break
      case 'slipAway':
        changeEngagement(engine, p, target, false)
        break
      case 'heal':
        if (ally) healAlly(engine, p, ally)
        break
      case 'blessAbility':
        if (ally) blessAlly(engine, p, ally)
        break
      case 'magicMissile':
        if (enemy) magicMissile(engine, p, enemy)
        break
      case 'fireball': {
        const mana = Number(extra)
        spend(p, 'mana', mana)
        fireball(engine, p, target, mana)
        break
      }
    }
  }
}

function ensureEngaged(engine: Engine, e: BattleEnemy): { target: BattlePlayer; closedIn: boolean } | null {
  const { b, rng } = engine
  const inGroup = playersInGroup(b, groupOf(b, e.id))
  if (inGroup.length > 0) return { target: pick(inGroup, rng), closedIn: false }
  const players = livingPlayers(b)
  if (players.length === 0) return null
  const target = pick(players, rng)
  moveToGroup(b, e.id, groupOf(b, target.key))
  return { target, closedIn: true }
}

function enemyTurn(engine: Engine, e: BattleEnemy) {
  const { b } = engine
  const def = ENEMIES_BY_ID[e.defId]
  for (const attack of def?.attacks ?? []) {
    if (b.result !== 'ongoing' || e.hp <= 0) return
    if (attack.area) {
      const provoker = e.provokedBy ? playerByKey(b, e.provokedBy) : undefined
      const victims = provoker && provoker.hp > 0 ? [provoker] : livingPlayers(b)
      victims.forEach((victim, i) => {
        if (b.result !== 'ongoing' || victim.hp <= 0) return
        const intro =
          i === 0
            ? `${e.name} uses ${attack.name}${provoker ? `, but Provoked, can only hit ${provoker.name}` : ', sweeping the whole room'}.`
            : `${attack.name} catches ${victim.name}.`
        strikePlayer(engine, e, attack, victim, intro)
      })
      continue
    }
    const engaged = ensureEngaged(engine, e)
    if (!engaged) return
    const intro = engaged.closedIn
      ? `${e.name} closes in on ${engaged.target.name} and strikes with ${attack.name}.`
      : `${e.name} attacks ${engaged.target.name} with ${attack.name}.`
    strikePlayer(engine, e, attack, engaged.target, intro)
  }
}

function resetRoundState(b: BattleState) {
  b.players.forEach((p) => {
    p.defense = 0
  })
  b.enemies.forEach((e) => {
    e.empowered = 0
  })
}

function enemyActions(engine: Engine) {
  const { b, rng } = engine
  for (const e of shuffled(livingEnemies(b), rng)) {
    if (b.result !== 'ongoing') break
    if (e.hp > 0) enemyTurn(engine, e)
  }
}

function finalStep(engine: Engine) {
  const { result } = engine.b
  if (result === 'ongoing') return
  addStep(engine, {
    actor: null,
    title: result === 'victory' ? 'Victory!' : 'Defeat',
    intro: result === 'victory' ? 'The last enemy falls.' : 'The party is overwhelmed.',
    outcome: result === 'victory' ? 'The fight is won.' : 'Every adventurer has fallen.',
    tone: result === 'victory' ? 'success' : 'failure',
  })
}

/** The player who is choosing an action right now, if any. */
export function currentPlayer(b: BattleState): BattlePlayer | null {
  if (b.result !== 'ongoing' || b.phase !== 'players') return null
  const p = b.players[b.turnIndex]
  return p && p.hp > 0 ? p : null
}

function advanceTurn(b: BattleState) {
  const current = b.players[b.turnIndex]
  if (b.actionsUsed < ACTIONS_PER_TURN && current && current.hp > 0) return
  const next = b.players.findIndex((p, i) => i > b.turnIndex && p.hp > 0)
  b.actionsUsed = 0
  if (next === -1) {
    b.phase = 'enemies'
  } else {
    b.turnIndex = next
  }
}

/**
 * Resolves the current player's choice and moves on. `null` skips the action. A Fast
 * ability is free, so it resolves without using up one of the player's actions.
 */
export function takeAction(
  battle: BattleState,
  planned: PlannedCombat | null,
  rng: Rng,
): { battle: BattleState; steps: ResolutionStep[] } {
  const engine: Engine = { b: structuredClone(battle), rng, steps: [] }
  const { b } = engine
  b.opening = []
  const p = currentPlayer(b)
  if (!p) return { battle: b, steps: [] }

  let free = false
  if (planned) {
    free = availableCombatActions(b, p).find((o) => o.id === planned.actionId)?.slot === 'fast'
    performAction(engine, p, planned)
  }
  if (!free) b.actionsUsed += 1

  if (b.result === 'ongoing') advanceTurn(b)
  finalStep(engine)
  return { battle: b, steps: engine.steps }
}

/** The current player gives up their remaining actions this round. */
export function endTurn(battle: BattleState): BattleState {
  const b = structuredClone(battle)
  if (!currentPlayer(b)) return b
  b.actionsUsed = ACTIONS_PER_TURN
  advanceTurn(b)
  return b
}

/** Every player has acted: the enemies attack in random order, Defense resets, and a new round begins. */
export function runEnemyPhase(
  battle: BattleState,
  rng: Rng,
): { battle: BattleState; steps: ResolutionStep[] } {
  const engine: Engine = { b: structuredClone(battle), rng, steps: [] }
  const { b } = engine
  b.opening = []
  if (b.result !== 'ongoing' || b.phase !== 'enemies') return { battle: b, steps: [] }

  addStep(engine, {
    actor: null,
    title: 'Enemy phase',
    intro: 'Every adventurer has acted.',
    outcome: 'Now the enemies strike back!',
    tone: 'failure',
  })
  enemyActions(engine)
  resetRoundState(b)

  if (b.result === 'ongoing') {
    b.round += 1
    b.phase = 'players'
    b.turnIndex = Math.max(0, b.players.findIndex((p) => p.hp > 0))
    b.actionsUsed = 0
    addStep(engine, {
      actor: null,
      title: 'Round ends',
      intro: 'The dust settles for a moment.',
      outcome: `Defense scores reset. Round ${b.round} begins.`,
      tone: 'neutral',
    })
  }
  finalStep(engine)
  return { battle: b, steps: engine.steps }
}
