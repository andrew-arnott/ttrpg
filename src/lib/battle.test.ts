import { describe, expect, it } from 'vitest'
import { ENEMIES_BY_ID } from '../data/enemies'
import { PROFESSIONS } from '../data/professions'
import {
  availableCombatActions,
  currentPlayer,
  endTurn,
  actionsThisTurn,
  enemyDefense,
  engageBreakdown,
  respondToReaction,
  engageDifficulty,
  runEnemyPhase,
  startBattle,
  suggestedAction,
  takeAction,
  type BattleEnemy,
  type BattlePlayer,
  type BattleState,
  type PlannedCombat,
} from './battle'
import { releaseAllConditions } from './characterTest'
import { mulberry32 } from './drawTest'
import { countInBag } from './tokenFlow'
import {
  ALWAYS_FAIL,
  ALWAYS_PASS,
  bagOf,
  acceptAll,
  declineAll,
  playRound,
  testMember,
  type BattlePlan,
  type Reactions,
} from './testFixtures'

const flat = { strength: 1, perception: 1, endurance: 1, charisma: 1, intelligence: 1, agility: 1, luck: 1 }
const rng = () => mulberry32(3)

function player(key: string, over: Partial<BattlePlayer> = {}): BattlePlayer {
  return {
    key,
    name: key,
    professionId: 'warrior',
    hp: 10,
    maxHp: 10,
    special: flat,
    bag: bagOf('plus3'),
    resources: { resolve: 3, cunning: 3, faith: 3, mana: 3 },
    abilityIds: [],
    shieldsInPlay: 0,
    defense: 0,
    colorIndex: 0,
    ...over,
  }
}

function enemy(defId: string, id = defId, over: Partial<BattleEnemy> = {}): BattleEnemy {
  const def = ENEMIES_BY_ID[defId]
  return {
    id,
    defId,
    name: id,
    hp: def.hp,
    maxHp: def.hp,
    defense: def.defense,
    sealed: [],
    disabled: false,
    provokedBy: null,
    empowered: 0,
    ...over,
  }
}

/** `groups` maps each combatant id to its engagement group. */
function battleOf(players: BattlePlayer[], enemies: BattleEnemy[], groups: Record<string, string>): BattleState {
  return {
    round: 1,
    players,
    enemies,
    groups,
    nextGroup: 10,
    log: [],
    result: 'ongoing',
    phase: 'players',
    turnIndex: Math.max(0, players.findIndex((p) => p.hp > 0)),
    actionsUsed: 0,
    opening: [],
  }
}

const turn = (...actions: (PlannedCombat | null)[]): BattlePlan[string] => ({
  actions: [actions[0] ?? null, actions[1] ?? null],
  fast: null,
})

const attack = (targetId: string): PlannedCombat => ({ actionId: 'attack', targetId })
const defend: PlannedCombat = { actionId: 'defend' }

const duel = (p: Partial<BattlePlayer> = {}, e: Partial<BattleEnemy> = {}, defId = 'goblin') =>
  battleOf([player('p', p)], [enemy(defId, 'e', e)], { p: 'g1', e: 'g1' })

describe('defending', () => {
  it('adds Agility plus the token result to the Defense score, and resets at the end of the round', () => {
    const b = duel({ special: { ...flat, agility: 2 } })
    const { battle, steps } = playRound(b, { p: turn(defend) }, rng())
    const step = steps.find((s) => s.title === 'Defend')!
    expect(step.test?.total).toBe(5)
    expect(step.testMode).toBe('score')
    expect(step.resultLine).toMatch(/Defense 0 \u2192 5/)
    expect(battle.players[0].defense).toBe(0)
  })

  it('stacks when both actions are used on it', () => {
    const b = battleOf([player('p', { special: { ...flat, agility: 2 } })], [enemy('goblin', 'e', { hp: 99 })], {
      p: 'g1',
      e: 'g1',
    })
    const { steps } = playRound(b, { p: turn(defend, defend) }, rng())
    const lines = steps.filter((s) => s.title === 'Defend').map((s) => s.resultLine)
    expect(lines[1]).toMatch(/Defense 5 \u2192 10/)
  })

  it('adds nothing on a Critical Failure, which also draws a Complication', () => {
    const b = duel({ bag: ALWAYS_FAIL })
    const { steps } = playRound(b, { p: turn(defend) }, rng())
    expect(steps.find((s) => s.title === 'Defend')!.tone).toBe('failure')
    expect(steps.find((s) => s.title === 'Opportunist')).toBeDefined()
  })
})

describe('enemy attacks', () => {
  it('deal 1 damage when the attack value exceeds Defense', () => {
    const { battle } = playRound(duel(), { p: turn() }, rng())
    expect(battle.players[0].hp).toBe(9)
  })

  it('are blocked when Defense is equal to the attack value', () => {
    const b = battleOf([player('p', { defense: 4 })], [enemy('goblin', 'e')], { p: 'g1', e: 'g1' })
    const { battle } = playRound(b, { p: turn() }, rng())
    expect(battle.players[0].hp).toBe(10)
  })

  it('wear Defense down so that later attacks get through', () => {
    const b = battleOf(
      [player('p', { special: { ...flat, agility: 2 } })],
      [enemy('goblin', 'a'), enemy('goblin', 'b')],
      { p: 'g1', a: 'g1', b: 'g1' },
    )
    const { battle, steps } = playRound(b, { p: turn(defend) }, rng())
    const knife = steps.filter((s) => s.title === 'Rusty Knife')
    expect(knife.map((s) => s.tone).sort()).toEqual(['failure', 'success'])
    expect(battle.players[0].hp).toBe(9)
  })

  it('reset Defense at the end of the round', () => {
    const b = duel({ special: { ...flat, agility: 2 } })
    const { battle } = playRound(b, { p: turn(defend, defend) }, rng())
    expect(battle.players[0].defense).toBe(0)
    expect(battle.round).toBe(2)
  })

  it('resolve after every player has acted', () => {
    const b = battleOf([player('p1'), player('p2')], [enemy('goblin', 'e', { hp: 99 })], {
      p1: 'g1',
      p2: 'g2',
      e: 'g1',
    })
    const { steps } = playRound(b, { p1: turn(defend), p2: turn(defend) }, rng())
    const firstEnemyStep = steps.findIndex((s) => s.actor?.artKind === 'enemy')
    const lastPlayerStep = steps.map((s) => s.actor?.artKind).lastIndexOf('profession')
    expect(firstEnemyStep).toBeGreaterThan(lastPlayerStep)
  })

  it('make an enemy with nobody in its group engage a random player first', () => {
    const b = battleOf([player('p')], [enemy('goblin', 'e')], { p: 'g1', e: 'g9' })
    const { battle, steps } = playRound(b, { p: turn() }, rng())
    expect(battle.groups.e).toBe('g1')
    expect(steps.find((s) => s.title === 'Rusty Knife')!.intro).toMatch(/closes in/)
  })

  it('hit every player in the room with an area attack', () => {
    const b = battleOf([player('p1'), player('p2'), player('p3')], [enemy('troll', 't')], {
      p1: 'g1',
      p2: 'g2',
      p3: 'g3',
      t: 'g1',
    })
    const { steps } = playRound(b, { p1: turn(), p2: turn(), p3: turn() }, rng())
    expect(steps.filter((s) => s.title === 'Ground Slam')).toHaveLength(3)
  })

  it('hit only the Provoker with an area attack once Provoked', () => {
    const b = battleOf([player('p1'), player('p2')], [enemy('troll', 't', { provokedBy: 'p2' })], {
      p1: 'g1',
      p2: 'g2',
      t: 'g2',
    })
    const { steps } = playRound(b, { p1: turn(), p2: turn() }, rng())
    const slam = steps.filter((s) => s.title === 'Ground Slam')
    expect(slam).toHaveLength(1)
    expect(slam[0].intro).toMatch(/p2/)
  })

  it('end the fight in defeat when every player is down', () => {
    const b = battleOf([player('p', { hp: 1 })], [enemy('goblin', 'e')], { p: 'g1', e: 'g1' })
    const { battle } = playRound(b, { p: turn() }, rng())
    expect(battle.players[0].hp).toBe(0)
    expect(battle.result).toBe('defeat')
  })

  it('skip a player who is down', () => {
    const b = battleOf([player('p1', { hp: 0 }), player('p2')], [enemy('goblin', 'e', { hp: 99 })], {
      p1: 'g1',
      p2: 'g1',
      e: 'g1',
    })
    const { steps } = playRound(b, { p1: turn(attack('e'), attack('e')), p2: turn() }, rng())
    expect(steps.some((s) => s.actor?.key === 'p1')).toBe(false)
  })
})

describe('player attacks', () => {
  it('test against the enemy Defense and deal 1 damage on a hit', () => {
    const b = duel({ bag: ALWAYS_PASS })
    const { battle, steps } = playRound(b, { p: turn(attack('e')) }, rng())
    expect(steps[0].test?.difficulty).toBe(3)
    expect(battle.enemies[0].hp).toBe(2)
  })

  it('miss when the total falls short', () => {
    const b = duel({ bag: bagOf('plus1') })
    const { battle, steps } = playRound(b, { p: turn(attack('e')) }, rng())
    expect(steps[0].test?.passed).toBe(false)
    expect(battle.enemies[0].hp).toBe(3)
  })

  it('add 1 damage for each Might token drawn on a hit', () => {
    const b = duel({ bag: bagOf('might'), special: { ...flat, strength: 3 } })
    const { battle } = playRound(b, { p: turn(attack('e')) }, rng())
    expect(battle.enemies[0].hp).toBe(1)
  })

  it('only reach enemies in the same engagement group', () => {
    const b = battleOf([player('p')], [enemy('goblin', 'e')], { p: 'g1', e: 'g2' })
    const options = availableCombatActions(b, b.players[0])
    expect(options.find((o) => o.id === 'attack')!.targets![0].label).toMatch(/not engaged/)
    const { steps } = playRound(b, { p: turn(attack('e')) }, rng())
    expect(steps[0].title).toBe('No move')
  })

  it('can follow a successful change of engagement within the same turn', () => {
    const b = battleOf([player('p', { bag: ALWAYS_PASS })], [enemy('goblin', 'e')], { p: 'g1', e: 'g2' })
    const { battle } = playRound(
      b,
      { p: turn({ actionId: 'engage', targetId: 'g2' }, attack('e')) },
      rng(),
    )
    expect(battle.enemies[0].hp).toBe(2)
  })

  it('fall through to no move if the change of engagement failed', () => {
    const b = battleOf([player('p', { bag: ALWAYS_FAIL })], [enemy('goblin', 'e')], { p: 'g1', e: 'g2' })
    const { steps } = playRound(
      b,
      { p: turn({ actionId: 'engage', targetId: 'g2' }, attack('e')) },
      rng(),
    )
    expect(steps.some((s) => s.title === 'No move')).toBe(true)
  })

  it('win the fight when the last enemy falls and skip the enemy phase', () => {
    const b = duel({ bag: ALWAYS_PASS }, { hp: 1 })
    const { battle, steps } = playRound(b, { p: turn(attack('e')) }, rng())
    expect(battle.result).toBe('victory')
    expect(steps.some((s) => s.title === 'Rusty Knife')).toBe(false)
    expect(steps[steps.length - 1].title).toBe('Victory!')
  })

  it('stop an enemy that was defeated from acting', () => {
    const b = battleOf(
      [player('p', { bag: ALWAYS_PASS })],
      [enemy('goblin', 'a', { hp: 1 }), enemy('goblin', 'b', { hp: 99 })],
      { p: 'g1', a: 'g1', b: 'g1' },
    )
    const { steps } = playRound(b, { p: turn(attack('a')) }, rng())
    expect(steps.filter((s) => s.title === 'Rusty Knife')).toHaveLength(1)
  })
})

describe('complications', () => {
  it('make a goblin lunge at the character who drew it', () => {
    const b = duel({ bag: bagOf('complication') })
    const { steps, battle } = playRound(b, { p: turn(attack('e')) }, rng())
    const lunge = steps.find((s) => s.title === 'Opportunist')!
    expect(lunge.actor?.artKind).toBe('enemy')
    expect(lunge.intro).toMatch(/lunges at p/)
    expect(battle.players[0].hp).toBeLessThan(10)
  })

  it('make a troll bellow for extra attack value until the round ends', () => {
    const b = duel({ bag: ALWAYS_FAIL }, {}, 'troll')
    const { steps, battle } = playRound(b, { p: turn(attack('e')) }, rng())
    expect(steps.find((s) => s.title === 'Bellow')).toBeDefined()
    expect(steps.find((s) => s.title === 'Club Smash')!.resultLine).toMatch(/Attack 8/)
    expect(battle.enemies[0].empowered).toBe(0)
  })

  it('do not fire for a normal draw', () => {
    const { steps } = playRound(duel({ bag: ALWAYS_PASS }), { p: turn(attack('e')) }, rng())
    expect(steps.some((s) => s.title === 'Opportunist')).toBe(false)
  })
})

describe('boss abilities', () => {
  it('lets the Barrow Warden heal itself when a Complication is drawn', () => {
    const b = duel({ bag: bagOf('complication') }, { hp: 5 }, 'warden')
    const { steps, battle } = playRound(b, { p: turn(attack('e')) }, rng())
    const heal = steps.find((s) => s.title === 'Undying')!
    expect(heal.outcome).toMatch(/regains 1 HP/)
    expect(battle.enemies[0].hp).toBeLessThanOrEqual(6)
  })

  it('does not heal past full strength', () => {
    const b = duel({ bag: bagOf('complication') }, {}, 'warden')
    const { steps } = playRound(b, { p: turn(attack('e')) }, rng())
    expect(steps.find((s) => s.title === 'Undying')!.tone).toBe('neutral')
  })

  it('rattles a skeleton up by one attack value on a Complication', () => {
    const b = duel({ bag: ALWAYS_FAIL }, {}, 'skeleton')
    const { steps } = playRound(b, { p: turn(attack('e')) }, rng())
    expect(steps.find((s) => s.title === 'Bone Claws')!.resultLine).toMatch(/Attack 5/)
  })
})

describe('shields and bless', () => {
  it('put drawn Shield tokens in play, then use them up to absorb damage', () => {
    const b = duel({ bag: bagOf('shield') })
    const after = playRound(b, { p: turn(attack('e')) }, rng())
    expect(after.battle.players[0].hp).toBe(10)
    expect(after.battle.players[0].shieldsInPlay).toBe(0)
    expect(after.battle.players[0].bag).toEqual(bagOf('shield'))
    expect(after.steps.find((s) => s.title === 'Rusty Knife')!.outcome).toMatch(/absorbed by Shield/)
  })

  it('use up Bless tokens once drawn', () => {
    const b = duel({
      bag: [
        { tokenId: 'bless', count: 2 },
        { tokenId: 'plus3', count: 3 },
      ],
    })
    const { battle } = playRound(b, { p: turn(defend, defend) }, mulberry32(1))
    const total = battle.players[0].bag.reduce((n, s) => n + s.count, 0)
    const blessLeft = battle.players[0].bag.find((s) => s.tokenId === 'bless')?.count ?? 0
    expect(blessLeft).toBeLessThanOrEqual(2)
    expect(total).toBe(5 - (2 - blessLeft))
  })
})

describe('engagement', () => {
  const split = () =>
    battleOf([player('p1'), player('p2')], [enemy('goblin', 'e', { hp: 99 })], {
      p1: 'g1',
      p2: 'g2',
      e: 'g2',
    })

  it('lets a player move to another group with a passed Agility test', () => {
    const b = split()
    b.players[0].bag = ALWAYS_PASS
    const { battle, steps } = playRound(b, { p1: turn({ actionId: 'engage', targetId: 'g2' }) }, rng())
    expect(battle.groups.p1).toBe('g2')
    expect(steps[0].test?.attribute).toBe('agility')
  })

  it('keeps the player where they are on a failed test', () => {
    const b = split()
    b.players[0].bag = ALWAYS_FAIL
    const { battle } = playRound(b, { p1: turn({ actionId: 'engage', targetId: 'g2' }) }, rng())
    expect(battle.groups.p1).toBe('g1')
  })

  it('lets a player break away into a new group', () => {
    const b = battleOf([player('p1', { bag: ALWAYS_PASS }), player('p2')], [enemy('goblin', 'e')], {
      p1: 'g1',
      p2: 'g1',
      e: 'g1',
    })
    const options = availableCombatActions(b, b.players[0])
    expect(options.find((o) => o.id === 'engage')!.targets!.some((t) => t.id === 'new')).toBe(true)
    const { battle } = playRound(b, { p1: turn({ actionId: 'engage', targetId: 'new' }) }, rng())
    expect(battle.groups.p1).not.toBe('g1')
  })
})

const bagCount = (p: BattlePlayer, tokenId: string) => countInBag(p.bag, tokenId)

describe('spending resources', () => {
  const heal: PlannedCombat = { actionId: 'ability:heal', targetId: 'p' }

  it('returns a spent token to the bag', () => {
    const b = duel({ professionId: 'priest', abilityIds: ['heal'], resources: { faith: 3 }, hp: 5 })
    const { battle } = playRound(b, { p: turn(heal) }, rng())
    expect(battle.players[0].resources.faith).toBe(2)
    expect(bagCount(battle.players[0], 'faith')).toBe(1)
  })

  it('returns the Resolve behind a Fight ability to the bag when the attack misses', () => {
    const b = duel({ bag: ALWAYS_FAIL, abilityIds: ['provoke'], resources: { resolve: 3 } }, { hp: 99 })
    const { battle } = playRound(b, { p: turn({ actionId: 'ability:provoke', targetId: 'e' }) }, rng())
    expect(battle.enemies[0].sealed).toEqual([])
    expect(battle.players[0].resources.resolve).toBe(2)
    expect(bagCount(battle.players[0], 'resolve')).toBe(1)
  })

  it('pays with Expertise when the profession resource has run out, and seals the Expertise', () => {
    const b = duel(
      { bag: ALWAYS_PASS, abilityIds: ['disable'], resources: { resolve: 0, expertise: 1 } },
      { hp: 99 },
      'troll',
    )
    const { battle } = playRound(b, { p: turn({ actionId: 'ability:disable', targetId: 'e' }) }, rng())
    expect(battle.enemies[0].sealed).toEqual([{ tokenId: 'expertise', byKey: 'p', as: 'resolve', value: 1 }])
    expect(battle.enemies[0].disabled).toBe(true)
  })

  it('counts a Critical Success as 2 Expertise and spends it whole', () => {
    const b = duel(
      { bag: ALWAYS_PASS, abilityIds: ['cheapShot'], resources: { cunning: 0, critSuccess: 1 } },
      { hp: 99 },
      'troll',
    )
    const { battle } = playRound(b, { p: turn({ actionId: 'ability:cheapShot', targetId: 'e' }) }, rng())
    expect(battle.enemies[0].sealed).toEqual([{ tokenId: 'critSuccess', byKey: 'p', as: 'cunning', value: 2 }])
    expect(enemyDefense(battle.enemies[0])).toBe(ENEMIES_BY_ID.troll.defense - 2)
  })

  it('does not offer an ability the player cannot pay for, even with Expertise', () => {
    const b = duel({ abilityIds: ['provoke'], resources: { resolve: 0, expertise: 0 } })
    const option = availableCombatActions(b, b.players[0]).find((o) => o.id === 'ability:provoke')!
    expect(option.disabledReason).toMatch(/Needs 1 Resolve/)
  })
})

describe('drawn resource tokens', () => {
  const chainBag = (tokenId: string, ender: string) => [
    { tokenId, count: 10 },
    { tokenId: ender, count: 1 },
  ]
  const drawnCount = (steps: { test?: { result: { drawn: { tokenId: string }[] } } }[], tokenId: string) =>
    steps.flatMap((s) => s.test?.result.drawn ?? []).filter((d) => d.tokenId === tokenId).length

  it('go into play after the test', () => {
    const b = duel({ bag: chainBag('expertise', 'critSuccess'), resources: {} })
    const { battle, steps } = playRound(b, { p: turn(attack('e')) }, rng())
    const drawn = drawnCount(steps, 'expertise')
    expect(drawn).toBeGreaterThan(0)
    expect(battle.players[0].resources.expertise).toBe(drawn)
    expect(bagCount(battle.players[0], 'expertise')).toBe(10 - drawn)
  })

  it('put a Critical Success in play, out of the bag', () => {
    const b = duel({ bag: [{ tokenId: 'critSuccess', count: 2 }], resources: {} })
    const { battle } = playRound(b, { p: turn(attack('e')) }, rng())
    expect(battle.players[0].resources.critSuccess).toBe(1)
    expect(bagCount(battle.players[0], 'critSuccess')).toBe(1)
  })

  it('keep Mana in the bag when the test fails, and put it in play when it succeeds', () => {
    const failing = duel({ bag: chainBag('mana', 'critFailure'), resources: {} })
    const lost = playRound(failing, { p: turn(attack('e')) }, rng())
    expect(lost.battle.players[0].resources.mana ?? 0).toBe(0)
    expect(bagCount(lost.battle.players[0], 'mana')).toBe(10)

    const passing = duel({ bag: chainBag('mana', 'critSuccess'), resources: {} })
    const won = playRound(passing, { p: turn(attack('e')) }, rng())
    const drawn = drawnCount(won.steps, 'mana')
    expect(drawn).toBeGreaterThan(0)
    expect(won.battle.players[0].resources.mana).toBe(drawn)
  })
})

describe('Power and Armor', () => {
  const warrior = (over: Partial<BattlePlayer> = {}) =>
    duel({ bag: bagOf('plus1'), resources: { power: 2, armor: 2 }, ...over }, { hp: 99 })

  it('are offered only to professions that use them, with Expertise and Critical Success counted in', () => {
    const b = warrior({ resources: { power: 1, expertise: 1, critSuccess: 1, armor: 0 } })
    const options = availableCombatActions(b, b.players[0])
    expect(options.find((o) => o.id === 'attack')!.boost).toEqual({ tokenId: 'power', max: 4 })
    expect(options.find((o) => o.id === 'defend')!.boost).toEqual({ tokenId: 'armor', max: 3 })

    const priest = duel({ professionId: 'priest', resources: { power: 2 } })
    expect(availableCombatActions(priest, priest.players[0]).find((o) => o.id === 'attack')!.boost).toBeUndefined()
  })

  it('add +1 per Power committed to an attack, turning a miss into a hit', () => {
    const miss = playRound(warrior(), { p: turn(attack('e')) }, rng())
    expect(miss.steps[0].outcome).toMatch(/misses/)

    const hit = playRound(warrior(), { p: turn({ ...attack('e'), boost: 2 }) }, rng())
    expect(hit.steps[0].test?.bonuses).toEqual([{ label: 'Power', value: 2 }])
    expect(hit.steps[0].test?.total).toBe(4)
    expect(hit.steps[0].outcome).toMatch(/hits/)
    expect(hit.battle.players[0].resources.power).toBe(0)
    expect(bagCount(hit.battle.players[0], 'power')).toBe(2)
  })

  it('cannot commit more than the player has', () => {
    const { steps, battle } = playRound(warrior({ resources: { power: 1 } }), { p: turn({ ...attack('e'), boost: 5 }) }, rng())
    expect(steps[0].test?.bonuses[0]?.value).toBe(1)
    expect(battle.players[0].resources.power).toBe(0)
  })

  it('add +1 per Armor to a Defend result', () => {
    const plain = playRound(warrior(), { p: turn(defend) }, rng())
    const boosted = playRound(warrior(), { p: turn({ actionId: 'defend', boost: 2 }) }, rng())
    const gain = (r: typeof plain) => r.steps.find((s) => s.title === 'Defend')!.test!.total
    expect(gain(boosted)).toBe(gain(plain) + 2)
    expect(boosted.steps[0].resultLine).toMatch(/Armor 2/)
    expect(bagCount(boosted.battle.players[0], 'armor')).toBe(2)
  })

  it('stack with the ability cost: Power goes to the attack, Resolve to the ability', () => {
    const b = warrior({ abilityIds: ['disable'], resources: { power: 1, resolve: 1 } })
    const { battle, steps } = playRound(b, { p: turn({ actionId: 'ability:disable', targetId: 'e', boost: 1 }) }, rng())
    expect(steps[0].test?.bonuses[0]?.value).toBe(1)
    expect(steps[0].outcome).toMatch(/hits/)
    expect(battle.enemies[0].sealed).toHaveLength(1)
    expect(bagCount(battle.players[0], 'power')).toBe(1)
  })
})

describe('Triggered abilities', () => {
  const weak = (id: string) => enemy('goblin', id, { hp: 1 })
  const asks = (abilityId: string, answer: Reactions = acceptAll): { seen: string[]; reactions: Reactions } => {
    const seen: string[] = []
    return {
      seen,
      reactions: (request) => {
        seen.push(request.abilityId)
        return request.abilityId === abilityId ? answer(request) : { use: false }
      },
    }
  }

  describe('pausing', () => {
    it('stops the action at the question and carries on from it once answered', () => {
      const b = battleOf(
        [player('p', { bag: ALWAYS_PASS, abilityIds: ['cleave'] })],
        [weak('a'), weak('b')],
        { p: 'g1', a: 'g1', b: 'g1' },
      )
      const first = takeAction(b, attack('a'), rng())
      expect(first.battle.pending?.request).toMatchObject({ abilityId: 'cleave', reactorKey: 'p' })
      expect(first.steps.map((s) => s.title)).toEqual(['Attack'])
      expect(currentPlayer(first.battle)).toBeNull()
      expect(takeAction(first.battle, attack('b'), rng()).steps).toEqual([])

      const second = respondToReaction(first.battle, { use: true, targetId: 'b' }, rng())
      expect(second.battle.pending).toBeNull()
      expect(second.steps.map((s) => s.title)).toEqual(['Cleave', 'Victory!'])
      expect(second.battle.result).toBe('victory')
    })

    it('does not ask when nobody could use a Triggered ability', () => {
      const b = battleOf([player('p', { bag: ALWAYS_PASS })], [weak('a'), weak('b')], { p: 'g1', a: 'g1', b: 'g1' })
      expect(takeAction(b, attack('a'), rng()).battle.pending).toBeFalsy()
    })

    it('does not ask when the reactor cannot pay', () => {
      const b = battleOf(
        [player('p', { abilityIds: ['cleave'], resources: { resolve: 0 } })],
        [weak('a'), weak('b')],
        { p: 'g1', a: 'g1', b: 'g1' },
      )
      expect(takeAction(b, attack('a'), rng()).battle.pending).toBeFalsy()
    })
  })

  describe('Cleave', () => {
    const cleaver = () =>
      battleOf(
        [player('p', { bag: ALWAYS_PASS, abilityIds: ['cleave'] })],
        [weak('a'), weak('b'), enemy('goblin', 'far', { hp: 5 })],
        { p: 'g1', a: 'g1', b: 'g1', far: 'g2' },
      )

    it('spends 1 Resolve to attack another enemy the cleaver can reach', () => {
      const { battle, steps } = playRound(cleaver(), { p: turn(attack('a')) }, rng(), acceptAll)
      expect(battle.enemies.find((e) => e.id === 'b')!.hp).toBe(0)
      expect(steps.map((s) => s.title)).toContain('Cleave')
      expect(battle.players[0].resources.resolve).toBe(2)
      expect(bagCount(battle.players[0], 'resolve')).toBe(1)
    })

    it('offers only enemies in the cleaver’s own group', () => {
      let targets: string[] = []
      playRound(cleaver(), { p: turn(attack('a')) }, rng(), (r) => {
        targets = r.targets!.map((t) => t.id)
        return { use: false }
      })
      expect(targets).toEqual(['b'])
    })

    it('does nothing when declined', () => {
      const { battle } = playRound(cleaver(), { p: turn(attack('a')) }, rng(), declineAll)
      expect(battle.enemies.find((e) => e.id === 'b')!.hp).toBe(1)
      expect(battle.players[0].resources.resolve).toBe(3)
    })

    it('can chain when the follow-up attack defeats another enemy', () => {
      const b = battleOf(
        [player('p', { bag: ALWAYS_PASS, abilityIds: ['cleave'] })],
        [weak('a'), weak('b'), weak('c'), enemy('goblin', 'd', { hp: 9 })],
        { p: 'g1', a: 'g1', b: 'g1', c: 'g1', d: 'g1' },
      )
      const { battle } = playRound(b, { p: turn(attack('a')) }, rng(), acceptAll)
      expect(battle.enemies.filter((e) => e.hp === 0).map((e) => e.id)).toEqual(['a', 'b', 'c'])
      expect(battle.enemies.find((e) => e.id === 'd')!.hp).toBe(8)
      expect(battle.players[0].resources.resolve).toBe(0)
    })

    it('is not offered for a kill that was not an attack', () => {
      const b = battleOf(
        [player('p', { abilityIds: ['magicMissile', 'cleave'] }), player('q')],
        [weak('a'), weak('b')],
        { p: 'g1', q: 'g2', a: 'g2', b: 'g1' },
      )
      const { seen, reactions } = asks('cleave')
      playRound(b, { p: turn({ actionId: 'ability:magicMissile', targetId: 'a' }) }, rng(), reactions)
      expect(seen).not.toContain('cleave')
    })
  })

  describe('Opportunist', () => {
    const duo = () =>
      battleOf(
        [player('p', { bag: ALWAYS_PASS }), player('r', { abilityIds: ['opportunist'], bag: ALWAYS_PASS })],
        [weak('a'), weak('b')],
        { p: 'g1', r: 'g1', a: 'g1', b: 'g1' },
      )

    it('lets an ally in the same group attack another enemy when someone else defeats one', () => {
      const { battle, steps } = playRound(duo(), { p: turn(attack('a')) }, rng(), acceptAll)
      expect(steps.map((s) => s.title)).toContain('Opportunist')
      expect(battle.enemies.find((e) => e.id === 'b')!.hp).toBe(0)
      expect(bagCount(battle.players[1], 'cunning')).toBe(1)
    })

    it('does not react to a defeat in another group, or to their own', () => {
      const b = duo()
      b.groups.r = 'g9'
      expect(takeAction(b, attack('a'), rng()).battle.pending).toBeFalsy()
      const own = battleOf(
        [player('r', { abilityIds: ['opportunist'], bag: ALWAYS_PASS })],
        [weak('a'), weak('b')],
        { r: 'g1', a: 'g1', b: 'g1' },
      )
      expect(takeAction(own, attack('a'), rng()).battle.pending).toBeFalsy()
    })
  })

  describe('Intercept', () => {
    const guarded = (over: Partial<BattlePlayer> = {}) =>
      battleOf(
        [
          player('w', { abilityIds: ['intercept'], ...over }),
          player('q', { hp: 10 }),
        ],
        [enemy('goblin', 'e', { hp: 9 })],
        { w: 'g1', q: 'g2', e: 'g2' },
      )
    const endAll: BattlePlan = { w: turn(), q: turn() }

    it('lets a warrior take an attack meant for an ally, with +2 Defense against it', () => {
      const { battle, steps } = playRound(guarded(), endAll, rng(), acceptAll)
      const strike = steps.find((s) => s.clash)!
      expect(strike.clash!.target.key).toBe('w')
      expect(strike.resultLine).toMatch(/Attack 4 - 2 Intercept/)
      expect(battle.players.find((p) => p.key === 'q')!.hp).toBe(10)
      expect(battle.players.find((p) => p.key === 'w')!.resources.resolve).toBe(2)
    })

    it('leaves the ally to take the attack when declined', () => {
      const { battle } = playRound(guarded(), endAll, rng(), declineAll)
      expect(battle.players.find((p) => p.key === 'q')!.hp).toBe(9)
      expect(battle.players.find((p) => p.key === 'w')!.hp).toBe(10)
    })

    it('is not offered to the one being attacked', () => {
      const b = battleOf([player('w', { abilityIds: ['intercept'] })], [enemy('goblin', 'e', { hp: 9 })], {
        w: 'g1',
        e: 'g1',
      })
      const { seen, reactions } = asks('intercept')
      playRound(b, { w: turn() }, rng(), reactions)
      expect(seen).toEqual([])
    })

    it('is not offered during a surprise round', () => {
      const party = [testMember('w', 0), testMember('q', 0)]
      const warrior = { ...party[0], abilityIds: ['intercept'] }
      const b = startBattle([warrior, party[1]], [], ['goblin'], rng(), 'A patrol appears.', {
        perception: 99,
        modifiers: [],
      })
      expect(b.pending).toBeFalsy()
    })
  })

  describe('Prayer', () => {
    const praying = (over: Partial<BattlePlayer> = {}) =>
      battleOf(
        [player('p', { bag: bagOf('plus1') }), player('r', { professionId: 'priest', abilityIds: ['prayer'], ...over })],
        [enemy('goblin', 'e', { hp: 9 })],
        { p: 'g1', r: 'g1', e: 'g1' },
      )

    it('adds +2 to an ally’s failed test and spends 2 Faith', () => {
      const { battle, steps } = playRound(praying(), { p: turn(attack('e')) }, rng(), acceptAll)
      const test = steps[0].test!
      expect(test.bonuses).toEqual([{ label: 'Prayer (r)', value: 2 }])
      expect(test.total).toBe(4)
      expect(test.passed).toBe(true)
      expect(steps[0].outcome).toMatch(/hits/)
      expect(battle.players[1].resources.faith).toBe(1)
      expect(bagCount(battle.players[1], 'faith')).toBe(2)
    })

    it('asks only when the failure could be saved', () => {
      const { seen, reactions } = asks('prayer')
      const tooFar = praying()
      tooFar.players[0].bag = bagOf('plus0')
      playRound(tooFar, { p: turn(attack('e')) }, rng(), reactions)
      expect(seen).toEqual(['prayer'])

      const crit = praying()
      crit.players[0].bag = ALWAYS_FAIL
      expect(takeAction(crit, attack('e'), rng()).battle.pending).toBeFalsy()
    })

    it('is not offered for the priest’s own test, or without 2 Faith', () => {
      const self = battleOf(
        [player('r', { professionId: 'priest', abilityIds: ['prayer'], bag: bagOf('plus1') })],
        [enemy('goblin', 'e', { hp: 9 })],
        { r: 'g1', e: 'g1' },
      )
      expect(takeAction(self, attack('e'), rng()).battle.pending).toBeFalsy()
      expect(takeAction(praying({ resources: { faith: 1 } }), attack('e'), rng()).battle.pending).toBeFalsy()
    })
  })

  describe('Flanking', () => {
    const flank = (over: Partial<BattlePlayer> = {}) =>
      battleOf(
        [
          player('r', { abilityIds: ['flanking'], bag: [...ALWAYS_PASS, { tokenId: 'cunning', count: 2 }], resources: { cunning: 1 }, ...over }),
          player('q'),
        ],
        [enemy('goblin', 'e', { hp: 99 })],
        { r: 'g1', q: 'g1', e: 'g1' },
      )

    it('recovers a Cunning on a hit beside an ally, once a round', () => {
      const { battle, steps } = playRound(flank(), { r: turn(attack('e'), attack('e')) }, rng())
      expect(steps[0].outcome).toMatch(/Flanking: recovers 1 Cunning/)
      expect(steps[1].outcome).not.toMatch(/Flanking/)
      expect(battle.players[0].resources.cunning).toBe(2)
    })

    it('needs an ally in the enemy’s group', () => {
      const alone = flank()
      alone.groups.q = 'g2'
      const { battle } = playRound(alone, { r: turn(attack('e')) }, rng())
      expect(battle.players[0].resources.cunning).toBe(1)
    })

    it('works again the next round', () => {
      const { battle } = playRound(flank(), { r: turn(attack('e')) }, rng())
      expect(battle.players[0].usedThisRound).toEqual([])
    })
  })
})

describe('conditions', () => {
  const sealedTypes = (p: BattlePlayer) => (p.sealedConditions ?? []).map((c) => c.tokenId)

  it('seals a condition drawn in a failed test, and poison hurts for each Poison sealed', () => {
    const b = duel({ bag: [{ tokenId: 'poison', count: 1 }], hp: 10 }, { hp: 9 })
    const { battle, steps } = playRound(b, { p: turn(attack('e')) }, rng())
    const me = battle.players[0]
    expect(sealedTypes(me)).toEqual(['poison'])
    expect(countInBag(me.bag, 'poison')).toBe(0)
    expect(steps[0].outcome).toMatch(/\(9\/10 HP\)/)
    expect(steps[0].outcome).toMatch(/Poison is sealed on p\./)
    expect(steps[0].outcome).toMatch(/takes 1 poison damage/)
  })

  it('leaves a condition in the bag when the test succeeds', () => {
    const b = duel({ bag: [{ tokenId: 'poison', count: 1 }, ...ALWAYS_PASS], hp: 10 }, { hp: 9 })
    b.players[0].special = { ...flat, strength: 9 }
    const { battle } = playRound(b, { p: turn(attack('e')) }, rng())
    expect(sealedTypes(battle.players[0])).toEqual([])
  })

  it('makes a second Wound a Critical Failure and seals it', () => {
    const b = duel({ bag: [{ tokenId: 'wound', count: 1 }], sealedConditions: [{ tokenId: 'wound', round: 1 }] }, { hp: 9 })
    const { battle, steps } = playRound(b, { p: turn(attack('e')) }, rng())
    expect(steps[0].test?.result.outcome).toBe('critical-failure')
    expect(sealedTypes(battle.players[0])).toEqual(['wound', 'wound'])
  })

  it('starts a test with a sealed Curse, which is released if the test succeeds and stays sealed if it fails', () => {
    const cursed = { sealedConditions: [{ tokenId: 'curse', round: 1 }] }
    const won = duel({ bag: ALWAYS_PASS, ...cursed }, { hp: 9 })
    const passed = playRound(won, { p: turn(attack('e')) }, rng())
    expect(passed.steps[0].test?.result.drawn[0].tokenId).toBe('curse')
    expect(sealedTypes(passed.battle.players[0])).toEqual([])
    expect(countInBag(passed.battle.players[0].bag, 'curse')).toBe(1)

    const lost = duel({ bag: ALWAYS_FAIL, ...cursed }, { hp: 9 })
    expect(sealedTypes(playRound(lost, { p: turn(attack('e')) }, rng()).battle.players[0])).toEqual(['curse'])
  })

  it('Fear stops attacks, Insanity stops Fast abilities and Reactions', () => {
    const afraid = duel({ abilityIds: ['provoke', 'slipAway'], sealedConditions: [{ tokenId: 'fear', round: 1 }] })
    const options = availableCombatActions(afraid, afraid.players[0])
    expect(options.find((o) => o.id === 'attack')!.disabledReason).toMatch(/Fear/)
    expect(options.find((o) => o.id === 'ability:provoke')!.disabledReason).toMatch(/Fear/)
    expect(options.find((o) => o.id === 'ability:slipAway')!.disabledReason).toBeUndefined()
    expect(suggestedAction(afraid, afraid.players[0])).toEqual({ actionId: 'defend' })

    const mad = duel({ abilityIds: ['slipAway'], sealedConditions: [{ tokenId: 'insanity', round: 1 }] })
    expect(availableCombatActions(mad, mad.players[0]).find((o) => o.id === 'ability:slipAway')!.disabledReason).toMatch(/Insanity/)

    const unsound = battleOf(
      [player('p', { bag: ALWAYS_PASS }), player('r', { professionId: 'priest', abilityIds: ['prayer'], sealedConditions: [{ tokenId: 'insanity', round: 1 }] })],
      [enemy('goblin', 'e', { hp: 9 })],
      { p: 'g1', r: 'g1', e: 'g1' },
    )
    unsound.players[0].bag = bagOf('plus0')
    expect(takeAction(unsound, attack('e'), rng()).battle.pending).toBeFalsy()
  })

  it('Fatigue costs an action from the round after it was sealed', () => {
    const tired = player('p', { sealedConditions: [{ tokenId: 'fatigue', round: 1 }] })
    expect(actionsThisTurn(tired, 1)).toBe(2)
    expect(actionsThisTurn(tired, 2)).toBe(1)
    expect(actionsThisTurn({ ...tired, sealedConditions: [{ tokenId: 'fatigue', round: 1 }, { tokenId: 'fatigue', round: 1 }] }, 2)).toBe(1)
  })

  describe('from enemy attacks', () => {
    const smashed = (others: Partial<BattlePlayer> = {}) =>
      battleOf(
        [player('p', { hp: 20 }), player('r', { professionId: 'priest', abilityIds: ['divineIntervention'], ...others })],
        [enemy('troll', 't')],
        { p: 'g1', r: 'g2', t: 'g1' },
      )
    const endAll: BattlePlan = { p: turn(), r: turn() }

    it('adds the condition token to the bag of whoever is hit', () => {
      const { battle, steps } = playRound(smashed(), endAll, rng())
      expect(countInBag(battle.players[0].bag, 'wound')).toBe(1)
      expect(steps.find((s) => s.title === 'Club Smash')!.outcome).toMatch(/gains a Wound token/)
    })

    it('comes from a trigger, but only for someone engaged with the enemy', () => {
      const complicated = { bag: [{ tokenId: 'complication', count: 1 }], hp: 20 }
      const engaged = duel(complicated, { hp: 9 })
      const near = playRound(engaged, { p: turn(attack('e')) }, rng())
      expect(countInBag(near.battle.players[0].bag, 'poison')).toBe(1)

      const apart = battleOf([player('p', complicated), player('q')], [enemy('goblin', 'e', { hp: 9 })], {
        p: 'g1',
        q: 'g2',
        e: 'g2',
      })
      const far = playRound(apart, { p: turn({ actionId: 'engage', targetId: 'g2' }) }, rng())
      expect(far.steps[0].test?.result.complication).toBe(true)
      expect(countInBag(far.battle.players[0].bag, 'poison')).toBe(0)
    })

    it('can be prevented by Divine Intervention, which costs 1 Faith', () => {
      const { battle } = playRound(smashed(), endAll, rng(), acceptAll)
      expect(countInBag(battle.players[0].bag, 'wound')).toBe(0)
      expect(battle.players[1].resources.faith).toBe(2)
      expect(countInBag(battle.players[1].bag, 'faith')).toBe(1)
    })

    it('is not offered to the one who would gain it', () => {
      const b = battleOf([player('r', { hp: 20, professionId: 'priest', abilityIds: ['divineIntervention'] })], [enemy('troll', 't')], { r: 'g1', t: 'g1' })
      const { seen, reactions } = (() => {
        const seen: string[] = []
        return { seen, reactions: ((r) => (seen.push(r.abilityId), { use: false })) as Reactions }
      })()
      playRound(b, { r: turn() }, rng(), reactions)
      expect(seen).not.toContain('divineIntervention')
    })
  })

  describe('releasing', () => {
    const afflicted = (...conditions: { tokenId: string; round: number }[]) =>
      battleOf([player('p', { sealedConditions: conditions }), player('q')], [enemy('goblin', 'e', { hp: 99 })], {
        p: 'g1',
        q: 'g2',
        e: 'g2',
      })
    const endAll: BattlePlan = { p: turn(), q: turn() }

    it('releases the only eligible condition at the end of the round', () => {
      const { battle, steps } = playRound(afflicted({ tokenId: 'wound', round: 0 }), endAll, rng())
      expect(sealedTypes(battle.players[0])).toEqual([])
      expect(countInBag(battle.players[0].bag, 'wound')).toBe(1)
      expect(steps.map((s) => s.title)).toContain('Condition released')
    })

    it('keeps a condition sealed during the round that is ending', () => {
      const { battle } = playRound(afflicted({ tokenId: 'wound', round: 1 }), endAll, rng())
      expect(sealedTypes(battle.players[0])).toEqual(['wound'])
    })

    it('asks which to release when there is a choice', () => {
      let asked: string[] = []
      const { battle } = playRound(afflicted({ tokenId: 'wound', round: 0 }, { tokenId: 'fear', round: 0 }), endAll, rng(), (r) => {
        asked = r.targets!.map((t) => t.label)
        return { use: true, targetId: '1' }
      })
      expect(asked).toEqual(['Wound', 'Fear'])
      expect(sealedTypes(battle.players[0])).toEqual(['wound'])
    })

    it('returns everything to the bag when the fight is over', () => {
      const p = player('p', { sealedConditions: [{ tokenId: 'wound', round: 1 }, { tokenId: 'poison', round: 1 }] })
      releaseAllConditions(p)
      expect(p.sealedConditions).toEqual([])
      expect(countInBag(p.bag, 'poison')).toBe(1)
    })

    it('Cleanse releases all conditions on an ally', () => {
      const b = battleOf(
        [player('p', { sealedConditions: [{ tokenId: 'wound', round: 1 }, { tokenId: 'fear', round: 1 }] }), player('r', { professionId: 'priest', abilityIds: ['cleanse'] })],
        [enemy('goblin', 'e', { hp: 99 })],
        { p: 'g1', r: 'g1', e: 'g1' },
      )
      const { battle } = playRound(b, { p: turn(), r: turn({ actionId: 'ability:cleanse', targetId: 'p' }) }, rng())
      expect(sealedTypes(battle.players[0])).toEqual([])
      expect(countInBag(battle.players[0].bag, 'wound')).toBe(1)
    })
  })
})

describe('Shield Wall', () => {
  const wall = () =>
    battleOf(
      [
        player('w', { abilityIds: ['shieldWall'], bag: bagOf('plus3'), resources: { resolve: 3 } }),
        player('q', { hp: 20 }),
      ],
      [enemy('troll', 't', { hp: 99 })],
      { w: 'g1', q: 'g1', t: 'g1' },
    )
  const useWall: BattlePlan = { w: turn({ actionId: 'ability:shieldWall' }), q: turn() }

  it('spends 1 Resolve on a Defend test and keeps the score for the round', () => {
    const { battle, steps } = playRound(wall(), { w: turn({ actionId: 'ability:shieldWall' }) }, rng(), declineAll)
    expect(steps[0].title).toBe('Shield Wall')
    expect(steps[0].test?.total).toBe(4)
    expect(battle.players[0].resources.resolve).toBe(2)
  })

  it('lets the warrior spend their Defense on an attack against an ally in the same group', () => {
    const seen: string[] = []
    const { steps } = playRound(wall(), useWall, rng(), (r) => {
      seen.push(r.abilityId)
      return { use: true }
    })
    expect(seen).toContain('shieldWall')
    expect(steps.some((s) => /Shield Wall absorbs/.test(s.resultLine ?? ''))).toBe(true)
  })

  it('does nothing for allies in another group, or once the score is spent', () => {
    const b = wall()
    b.groups.q = 'g2'
    const { seen, reactions } = (() => {
      const seen: string[] = []
      return { seen, reactions: ((r) => (seen.push(r.abilityId), { use: true })) as Reactions }
    })()
    playRound(b, useWall, rng(), reactions)
    expect(seen).not.toContain('shieldWall')
  })
})

describe('Chain Lightning', () => {
  const storm = (mana = 6) =>
    battleOf(
      [player('p', { abilityIds: ['chainLightning'], bag: ALWAYS_PASS, resources: { mana } })],
      [enemy('goblin', 'a', { hp: 2 }), enemy('goblin', 'b', { hp: 2 }), enemy('goblin', 'c', { hp: 2 })],
      { p: 'g1', a: 'g1', b: 'g2', c: 'g2' },
    )
  const cast = { actionId: 'ability:chainLightning', targetId: 'a' }

  it('hits the first enemy for 2 and stops when the caster declines', () => {
    const { battle } = playRound(storm(), { p: turn(cast) }, rng(), declineAll)
    expect(battle.enemies.map((e) => e.hp)).toEqual([0, 2, 2])
    expect(battle.players[0].resources.mana).toBe(5)
  })

  it('offers each further target at an escalating cost, and tests Intelligence for each', () => {
    const costs: string[] = []
    const { battle, steps } = playRound(storm(), { p: turn(cast) }, rng(), (r) => {
      costs.push(r.cost)
      return { use: true, targetId: r.targets![0].id }
    })
    expect(costs).toEqual(['2 Mana', '3 Mana'])
    expect(steps.filter((s) => s.title === 'Chain Lightning').every((s) => s.test?.attribute === 'intelligence')).toBe(true)
    expect(battle.enemies.every((e) => e.hp === 0)).toBe(true)
    expect(battle.players[0].resources.mana).toBe(0)
    expect(bagCount(battle.players[0], 'mana')).toBe(6)
  })

  it('does not offer a target the caster cannot afford', () => {
    const { seen, reactions } = (() => {
      const seen: string[] = []
      return { seen, reactions: ((r) => (seen.push(r.abilityId), { use: false })) as Reactions }
    })()
    const weak = storm(2)
    weak.players[0].bag = bagOf('plus3')
    playRound(weak, { p: turn(cast) }, rng(), reactions)
    expect(seen).toEqual([])
  })

  it('never hits the same enemy twice', () => {
    const targets: string[][] = []
    playRound(storm(), { p: turn(cast) }, rng(), (r) => {
      targets.push(r.targets!.map((t) => t.id))
      return { use: true, targetId: 'b' }
    })
    expect(targets).toEqual([['b', 'c'], ['c']])
  })
})

describe('Transpose and Arcane Focus', () => {
  it('Transpose swaps engagement groups with an enemy or ally for 1 Mana, with no test', () => {
    const b = battleOf(
      [player('p', { abilityIds: ['transpose'] }), player('q')],
      [enemy('goblin', 'e1'), enemy('goblin', 'e2')],
      { p: 'g1', q: 'g2', e1: 'g1', e2: 'g2' },
    )
    const { battle, steps } = takeAction(b, { actionId: 'ability:transpose', targetId: 'e2' }, rng())
    expect(steps[0].test).toBeUndefined()
    expect(battle.groups.p).toBe('g2')
    expect(battle.groups.e2).toBe('g1')
    expect(battle.players[0].resources.mana).toBe(2)

    const ally = takeAction(b, { actionId: 'ability:transpose', targetId: 'q' }, rng()).battle
    expect([ally.groups.p, ally.groups.q]).toEqual(['g2', 'g1'])
  })

  it('Arcane Focus draws exactly 5 tokens, putting Mana in play and hurting for Complications', () => {
    const bag = [
      { tokenId: 'mana', count: 3 },
      { tokenId: 'complication', count: 2 },
      { tokenId: 'plus1', count: 5 },
    ]
    const b = duel({ abilityIds: ['arcaneFocus'], bag, resources: { mana: 0 }, hp: 10 }, { hp: 9 })
    const { battle, steps } = playRound(b, { p: turn({ actionId: 'ability:arcaneFocus' }) }, rng())
    const drawn = steps[0].test!.result.drawn
    const count = (id: string) => drawn.filter((d) => d.tokenId === id).length
    expect(drawn).toHaveLength(5)
    const me = battle.players[0]
    expect(me.resources.mana).toBe(count('mana'))
    expect(bagCount(me, 'mana')).toBe(3 - count('mana'))
    expect(bagCount(me, 'complication')).toBe(2)
    expect(steps[0].outcome).toMatch(count('complication') > 0 ? /takes \d damage/ : /recovers/)
  })

  it('Arcane Focus recovers Mana only, never other resources', () => {
    const bag = [{ tokenId: 'expertise', count: 10 }]
    const b = duel({ abilityIds: ['arcaneFocus'], bag, resources: {} })
    const { battle } = playRound(b, { p: turn({ actionId: 'ability:arcaneFocus' }) }, rng())
    expect(battle.players[0].resources.expertise ?? 0).toBe(0)
    expect(bagCount(battle.players[0], 'expertise')).toBe(10)
  })
})

describe('Smite', () => {
  it('deals 2 extra damage to undead and other supernatural enemies', () => {
    const smite = (defId: string) => {
      const b = duel({ abilityIds: ['smite'], bag: ALWAYS_PASS, professionId: 'priest' }, { hp: 9 }, defId)
      return playRound(b, { p: turn({ actionId: 'ability:smite', targetId: 'e' }) }, rng()).steps[0]
    }
    expect(smite('skeleton').outcome).toMatch(/hits e for 3 damage/)
    expect(smite('skeleton').outcome).toMatch(/Divine power/)
    expect(smite('goblin').outcome).toMatch(/hits e for 1 damage/)
  })
})

describe('engage Difficulty', () => {
  const crowd = () =>
    battleOf(
      [player('p1'), player('p2'), player('p3')],
      [enemy('goblin', 'a'), enemy('goblin', 'b'), enemy('goblin', 'c')],
      { p1: 'g1', p2: 'g1', p3: 'g2', a: 'g1', b: 'g1', c: 'g2' },
    )

  it('starts at 4 for a lone character with nobody around', () => {
    const b = battleOf([player('p'), player('q')], [enemy('goblin', 'e')], { p: 'g1', q: 'g2', e: 'g2' })
    expect(engageDifficulty(b, b.players[0], 'new').total).toBe(4)
  })

  it('rises with the enemies in the group being left and the group being joined', () => {
    const b = crowd()
    const d = engageDifficulty(b, b.players[0], 'g2')
    expect(d).toMatchObject({ enemiesLeaving: 2, enemiesJoining: 1, alliesLeaving: 1 })
    expect(d.total).toBe(4 + 2 + 1 - 1)
  })

  it('falls with the allies who stay behind, but never below 2', () => {
    const b = battleOf(
      [player('p1'), player('p2'), player('p3'), player('p4'), player('p5'), player('p6')],
      [enemy('goblin', 'e')],
      { p1: 'g1', p2: 'g1', p3: 'g1', p4: 'g1', p5: 'g1', p6: 'g1', e: 'g2' },
    )
    const d = engageDifficulty(b, b.players[0], 'g2')
    expect(d.total).toBe(2)
    expect(d.floored).toBe(true)
    expect(engageBreakdown(d)).toContain('minimum Difficulty 2')
  })

  it('is shown on each destination and used by the test', () => {
    const b = crowd()
    b.players[0].bag = ALWAYS_PASS
    const option = availableCombatActions(b, b.players[0]).find((o) => o.id === 'engage')!
    expect(option.targets!.find((t) => t.id === 'g2')!.label).toMatch(/Difficulty 6/)
    const { steps } = playRound(b, { p1: turn({ actionId: 'engage', targetId: 'g2' }) }, rng())
    expect(steps[0].test?.difficulty).toBe(6)
    expect(steps[0].testHeading).toMatch(/Difficulty 6/)
  })
})

describe('class abilities', () => {
  it('Provoke spends Resolve, seals it on the enemy, and pulls the enemy into the Provoker’s group', () => {
    const b = battleOf(
      [player('p1', { bag: ALWAYS_PASS, abilityIds: ['provoke'] }), player('p2')],
      [enemy('troll', 't')],
      { p1: 'g1', p2: 'g2', t: 'g1' },
    )
    const { battle } = playRound(b, { p1: turn({ actionId: 'ability:provoke', targetId: 't' }) }, rng())
    expect(battle.players[0].resources.resolve).toBe(2)
    expect(battle.enemies[0].sealed).toEqual([{ tokenId: 'resolve', byKey: 'p1' }])
    expect(battle.enemies[0].provokedBy).toBe('p1')
    expect(battle.groups.t).toBe(battle.groups.p1)
  })

  it('pulls a Provoked enemy out of another group into the Provoker’s', () => {
    const b = battleOf(
      [player('p1', { bag: ALWAYS_PASS, abilityIds: ['provoke'] }), player('p2')],
      [enemy('troll', 't'), enemy('goblin', 'g')],
      { p1: 'g1', p2: 'g2', t: 'g1', g: 'g2' },
    )
    const { battle } = playRound(b, { p1: turn({ actionId: 'ability:provoke', targetId: 't' }) }, rng())
    expect(battle.groups.t).toBe('g1')
  })

  it('gives sealed tokens back when the enemy is defeated', () => {
    const b = duel({ bag: ALWAYS_PASS, abilityIds: ['provoke'], resources: { resolve: 3 } }, { hp: 1 })
    const { battle } = playRound(b, { p: turn({ actionId: 'ability:provoke', targetId: 'e' }) }, rng())
    expect(battle.enemies[0].hp).toBe(0)
    expect(battle.enemies[0].sealed).toEqual([])
    const me = battle.players[0]
    expect(me.resources.resolve).toBe(2)
    expect(me.bag.find((t) => t.tokenId === 'resolve')?.count).toBe(1)
  })

  it('Disable reduces enemy damage by the Resolve sealed on it', () => {
    const b = duel({ bag: ALWAYS_PASS, abilityIds: ['disable'] }, { hp: 99 }, 'troll')
    const { battle } = playRound(b, { p: turn({ actionId: 'ability:disable', targetId: 'e' }) }, rng())
    // Club Smash deals 2 and Ground Slam deals 1. One sealed Resolve takes 1 off each, so only the Club gets through.
    expect(battle.players[0].hp).toBe(10 - 1)
  })

  it('Cheap Shot exposes an enemy, lowering its Defense', () => {
    const b = duel({ bag: ALWAYS_PASS, abilityIds: ['cheapShot'] }, { hp: 99 })
    const { battle } = playRound(b, { p: turn({ actionId: 'ability:cheapShot', targetId: 'e' }) }, rng())
    expect(enemyDefense(battle.enemies[0])).toBe(2)
  })

  it('Backstab needs you to be unengaged, then engages and deals 2 extra damage', () => {
    const engaged = duel({ abilityIds: ['backstab'] })
    expect(
      availableCombatActions(engaged, engaged.players[0]).find((o) => o.id === 'ability:backstab')!.disabledReason,
    ).toBe('You must not be engaged')

    const b = battleOf(
      [player('p', { bag: ALWAYS_PASS, abilityIds: ['backstab'] })],
      [enemy('troll', 't', { hp: 99 })],
      { p: 'g1', t: 'g2' },
    )
    const { battle } = playRound(b, { p: turn({ actionId: 'ability:backstab', targetId: 't' }) }, rng())
    expect(battle.enemies[0].hp).toBe(99 - 3)
    expect(battle.groups.p).toBe('g2')
  })

  it('Slip Away is a free Fast move with no test', () => {
    const b = battleOf(
      [player('p', { abilityIds: ['slipAway'] }), player('q')],
      [enemy('goblin', 'e', { hp: 99 })],
      { p: 'g1', q: 'g2', e: 'g1' },
    )
    const plan: BattlePlan = {
      p: { actions: [null, null], fast: { actionId: 'ability:slipAway', targetId: 'g2' } },
    }
    const { battle, steps } = playRound(b, plan, rng())
    expect(steps[0].test).toBeUndefined()
    expect(battle.groups.p).toBe('g2')
    expect(battle.players[0].resources.cunning).toBe(2)
  })

  it('Magic Missile hits an enemy you are not engaged with for 1 damage with no test', () => {
    const b = battleOf(
      [player('p', { abilityIds: ['magicMissile'] })],
      [enemy('goblin', 'e', { hp: 3 }), enemy('goblin', 'f', { hp: 3 })],
      { p: 'g1', e: 'g1', f: 'g2' },
    )
    const options = availableCombatActions(b, b.players[0])
    expect(options.find((o) => o.id === 'ability:magicMissile')!.targets!.map((t) => t.id)).toEqual(['f'])
    const { battle } = playRound(b, { p: turn({ actionId: 'ability:magicMissile', targetId: 'f' }) }, rng())
    expect(battle.enemies[1].hp).toBe(2)
    expect(battle.players[0].resources.mana).toBe(2)
  })

  it('Fireball hits each enemy in the group for X and burns allies in it too', () => {
    const b = battleOf(
      [
        player('p', { abilityIds: ['fireball'], bag: ALWAYS_PASS, resources: { mana: 3 } }),
        player('ally'),
      ],
      [enemy('goblin', 'a', { hp: 9 }), enemy('goblin', 'b', { hp: 9 })],
      { p: 'g2', ally: 'g1', a: 'g1', b: 'g1' },
    )
    const { battle } = playRound(b, { p: turn({ actionId: 'ability:fireball:3', targetId: 'g1' }) }, rng())
    expect(battle.enemies.map((e) => e.hp)).toEqual([6, 6])
    expect(battle.players[1].hp).toBeLessThan(10)
    expect(battle.players[0].resources.mana).toBe(0)
    expect(battle.players[0].bag.find((s) => s.tokenId === 'fatigue')?.count).toBe(1)
  })

  it('Heal restores 2 HP but not past the maximum', () => {
    const b = battleOf(
      [player('p', { abilityIds: ['heal'] }), player('q', { hp: 9 })],
      [enemy('goblin', 'e', { hp: 99, defense: 99 })],
      { p: 'g1', q: 'g2', e: 'g3' },
    )
    const { steps } = playRound(b, { p: turn({ actionId: 'ability:heal', targetId: 'q' }) }, rng())
    expect(steps[0].outcome).toMatch(/recovers 1 HP \(10\/10\)/)
  })

  it('Bless adds a Bless token to an ally’s bag', () => {
    const b = battleOf(
      [player('p', { abilityIds: ['blessAbility'] }), player('q')],
      [enemy('goblin', 'e', { hp: 99 })],
      { p: 'g1', q: 'g2', e: 'g3' },
    )
    const plan: BattlePlan = {
      p: { actions: [null, null], fast: { actionId: 'ability:blessAbility', targetId: 'q' } },
    }
    const { battle } = playRound(b, plan, rng())
    expect(battle.players[1].bag.find((s) => s.tokenId === 'bless')?.count).toBe(1)
  })

  it('disables abilities that need more resource than the character has', () => {
    const b = duel({ abilityIds: ['provoke'], resources: { resolve: 0 } })
    const option = availableCombatActions(b, b.players[0]).find((o) => o.id === 'ability:provoke')!
    expect(option.disabledReason).toBe('Needs 1 Resolve')
  })

  it('hides Triggered and Interval abilities from the menu', () => {
    const b = duel({ abilityIds: ['cleave', 'fortify'] })
    const options = availableCombatActions(b, b.players[0])
    expect(options.some((o) => o.id === 'ability:cleave')).toBe(false)
    expect(options.some((o) => o.id === 'ability:fortify')).toBe(false)
  })

  it('has a handler for every combat ability in the guide', () => {
    const every = PROFESSIONS.flatMap((prof) =>
      prof.abilities.filter((a) => !(a.types.length === 1 && a.types[0] === 'Triggered')).map((a) => a.id),
    )
    const b = duel({ abilityIds: every, resources: { resolve: 3, cunning: 3, faith: 3, mana: 6 } })
    const unsupported = availableCombatActions(b, b.players[0])
      .filter((o) => /sample battle/.test(o.disabledReason ?? ''))
      .map((o) => o.id)
    expect(unsupported).toEqual([])
  })
})

describe('startBattle', () => {
  const party = () => [testMember('a', 0), testMember('b', 0), testMember('c', 0), testMember('d', 0)]

  it('starts each player in their own group and engages every enemy with a random player', () => {
    const b = startBattle(party(), [], ['goblin', 'goblin', 'troll'], rng(), 'They arrive.', null)
    const playerGroups = b.players.map((p) => b.groups[p.key])
    expect(new Set(playerGroups).size).toBe(4)
    for (const e of b.enemies) expect(playerGroups).toContain(b.groups[e.id])
    expect(b.round).toBe(1)
    expect(b.opening[0].title).toBe('Battle!')
  })

  it('tells duplicate enemies apart', () => {
    const b = startBattle(party(), [], ['goblin', 'goblin', 'troll'], rng(), 'x', null)
    expect(b.enemies.map((e) => e.name)).toEqual(['Goblin Scout A', 'Goblin Scout B', 'Cave Troll'])
  })

  it('applies Fortify to the player who prepared it', () => {
    const b = startBattle(party(), [{ tag: 'Fortified', memberKey: 'b' }], ['goblin'], rng(), 'x', null)
    expect(b.players.map((p) => p.defense)).toEqual([0, 2, 0, 0])
  })

  it('gives the player who set an ambush a free attack', () => {
    const members = party()
    members[0] = { ...members[0], bag: ALWAYS_PASS }
    const b = startBattle(members, [{ tag: 'Ambush set', memberKey: 'a' }], ['troll'], rng(), 'x', null)
    expect(b.opening.some((s) => s.title === 'Ambush!')).toBe(true)
    expect(b.enemies[0].hp).toBeLessThan(b.enemies[0].maxHp)
  })

  it('does not mutate the battle it resolves a round on', () => {
    const b = startBattle(party(), [], ['goblin'], rng(), 'x', null)
    const snapshot = JSON.stringify(b)
    playRound(b, {}, rng())
    expect(JSON.stringify(b)).toBe(snapshot)
  })
})

describe('step-by-step turns', () => {
  const three = () =>
    battleOf([player('p1'), player('p2'), player('p3')], [enemy('goblin', 'e', { hp: 99 })], {
      p1: 'g1',
      p2: 'g2',
      p3: 'g3',
      e: 'g1',
    })

  it('starts with the first living player on their first action', () => {
    const b = three()
    expect(currentPlayer(b)!.key).toBe('p1')
    expect(b.actionsUsed).toBe(0)
  })

  it('moves to the same player’s second action, then to the next player', () => {
    let b = three()
    b = takeAction(b, defend, rng()).battle
    expect([currentPlayer(b)!.key, b.actionsUsed]).toEqual(['p1', 1])
    b = takeAction(b, defend, rng()).battle
    expect([currentPlayer(b)!.key, b.actionsUsed]).toEqual(['p2', 0])
  })

  it('moves to the enemy phase once the last player has used their actions', () => {
    let b = three()
    for (let i = 0; i < 6; i++) b = takeAction(b, null, rng()).battle
    expect(b.phase).toBe('enemies')
    expect(currentPlayer(b)).toBeNull()
  })

  it('treats skipping as using the action, with nothing to play back', () => {
    const { battle, steps } = takeAction(three(), null, rng())
    expect(steps).toEqual([])
    expect(battle.actionsUsed).toBe(1)
  })

  it('lets a player end their turn early', () => {
    const b = endTurn(three())
    expect(currentPlayer(b)!.key).toBe('p2')
    expect(b.actionsUsed).toBe(0)
  })

  it('does not use up an action for a Fast ability', () => {
    const b = battleOf(
      [player('p', { abilityIds: ['slipAway'] }), player('q')],
      [enemy('goblin', 'e', { hp: 99 })],
      { p: 'g1', q: 'g2', e: 'g1' },
    )
    const after = takeAction(b, { actionId: 'ability:slipAway', targetId: 'g2' }, rng()).battle
    expect(after.actionsUsed).toBe(0)
    expect(currentPlayer(after)!.key).toBe('p')
  })

  it('skips players who are down', () => {
    const b = battleOf([player('p1'), player('p2', { hp: 0 }), player('p3')], [enemy('goblin', 'e', { hp: 99 })], {
      p1: 'g1',
      p2: 'g2',
      p3: 'g3',
      e: 'g1',
    })
    const after = endTurn(b)
    expect(currentPlayer(after)!.key).toBe('p3')
  })

  it('does nothing when it is not a player’s turn', () => {
    const b = { ...three(), phase: 'enemies' as const }
    expect(takeAction(b, defend, rng()).steps).toEqual([])
  })

  it('ends the fight straight away when the last enemy falls', () => {
    const b = duel({ bag: ALWAYS_PASS }, { hp: 1 })
    const { battle, steps } = takeAction(b, attack('e'), rng())
    expect(battle.result).toBe('victory')
    expect(steps[steps.length - 1].title).toBe('Victory!')
    expect(currentPlayer(battle)).toBeNull()
  })

  it('suggests attacking an engaged enemy, or defending when there is none', () => {
    expect(suggestedAction(duel(), duel().players[0])).toEqual({ actionId: 'attack', targetId: 'e' })
    const apart = battleOf([player('p')], [enemy('goblin', 'e')], { p: 'g1', e: 'g2' })
    expect(suggestedAction(apart, apart.players[0])).toEqual({ actionId: 'defend' })
  })
})

describe('the enemy phase', () => {
  const ready = () => ({ ...duel({ special: { ...flat, agility: 2 } }), phase: 'enemies' as const })

  it('opens with an announcement, then each attack, and carries on to the next round', () => {
    const { battle, steps } = runEnemyPhase(ready(), rng())
    expect(steps[0].title).toBe('Enemy phase')
    expect(steps.some((s) => s.title === 'Rusty Knife')).toBe(true)
    expect(battle.round).toBe(2)
    expect(battle.phase).toBe('players')
    expect(battle.actionsUsed).toBe(0)
  })

  it('describes each attack as a clash of attack value and Defense', () => {
    const b = { ...ready(), players: [player('p', { defense: 6 })] }
    const { steps } = runEnemyPhase(b, rng())
    const clash = steps.find((s) => s.title === 'Rusty Knife')!.clash!
    expect(clash).toMatchObject({ attack: 4, defenseBefore: 6, defenseAfter: 2, breaks: false })
    expect(clash.target.name).toBe('p')
  })

  it('shows a hit as a clash that breaks through', () => {
    const { steps } = runEnemyPhase(ready(), rng())
    expect(steps.find((s) => s.title === 'Rusty Knife')!.clash).toMatchObject({ breaks: true, defenseAfter: 0 })
  })

  it('does nothing before every player has acted', () => {
    const b = duel()
    expect(runEnemyPhase(b, rng()).steps).toEqual([])
  })

  it('ends the fight when the party falls', () => {
    const b = { ...battleOf([player('p', { hp: 1 })], [enemy('goblin', 'e')], { p: 'g1', e: 'g1' }), phase: 'enemies' as const }
    const { battle, steps } = runEnemyPhase(b, rng())
    expect(battle.result).toBe('defeat')
    expect(steps[steps.length - 1].title).toBe('Defeat')
  })
})

describe('surprise', () => {
  const party = () => [testMember('a', 0), testMember('b', 0)]
  const check = (perception: number, modifiers: { label: string; value: number }[] = []) => ({
    perception,
    modifiers,
  })

  it('has no check at all when none is given', () => {
    const b = startBattle(party(), [], ['goblin'], rng(), 'x', null)
    expect(b.opening.some((s) => s.title === 'Surprise?')).toBe(false)
  })

  it('builds the Difficulty from the base and each modifier', () => {
    const b = startBattle(
      party(),
      [],
      ['goblin'],
      rng(),
      'x',
      check(2, [
        { label: 'Stand Watch', value: 2 },
        { label: 'Bright torch', value: 1 },
      ]),
    )
    const step = b.opening.find((s) => s.title === 'Surprise?')!
    expect(step.test?.difficulty).toBe(7)
    expect(step.testHeading).toMatch(/Difficulty 7/)
    expect(step.testHeading).toMatch(/\+2 Stand Watch/)
    expect(step.testHeading).toMatch(/\+1 Bright torch/)
    expect(step.test?.attribute).toBe('perception')
  })

  it('lets the enemies strike first when they succeed, and then hands over to the players', () => {
    const b = startBattle(party(), [], ['goblin', 'troll'], rng(), 'x', check(99, [{ label: 'x', value: -3 }]))
    const titles = b.opening.map((s) => s.title)
    expect(titles).toContain('Surprise round')
    expect(b.opening.some((s) => s.actor?.artKind === 'enemy' && s.clash)).toBe(true)
    expect(b.round).toBe(1)
    expect(b.phase).toBe('players')
    expect(currentPlayer(b)).not.toBeNull()
    expect(b.players.every((p) => p.defense === 0)).toBe(true)
  })

  /** Finds a seed whose Perception draw comes out the wanted way, since the draw is random. */
  const withOutcome = (
    surprised: boolean,
    prepared: Parameters<typeof startBattle>[1] = [],
    members = party(),
  ) => {
    for (let seed = 1; seed < 500; seed++) {
      const b = startBattle(members, prepared, ['goblin', 'troll'], mulberry32(seed), 'x', check(2))
      if (b.opening.find((s) => s.title === 'Surprise?')!.test!.passed === surprised) return b
    }
    throw new Error('no seed found')
  }

  it('leaves the party untouched when the enemies fail', () => {
    const b = withOutcome(false)
    const step = b.opening.find((s) => s.title === 'Surprise?')!
    expect(step.tone).toBe('success')
    expect(b.opening.some((s) => s.title === 'Surprise round')).toBe(false)
    expect(b.players.every((p) => p.hp === p.maxHp)).toBe(true)
  })

  it('reports whether they were surprised in the step itself', () => {
    const b = startBattle(party(), [], ['goblin'], rng(), 'x', check(2))
    const step = b.opening.find((s) => s.title === 'Surprise?')!
    expect(step.tone).toBe(step.test!.passed ? 'failure' : 'success')
    expect(b.opening.some((s) => s.title === 'Surprise round')).toBe(step.test!.passed)
  })

  it('uses up Fortify against the surprise round', () => {
    const b = withOutcome(true, [{ tag: 'Fortified', memberKey: 'a' }], [testMember('a', 0)])
    const first = b.opening.find((s) => s.clash)!.clash!
    expect(first.defenseBefore).toBe(2)
  })
})
