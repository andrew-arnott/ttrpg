import { describe, expect, it } from 'vitest'
import { ENEMIES_BY_ID } from '../data/enemies'
import {
  availableCombatActions,
  currentPlayer,
  endTurn,
  enemyDefense,
  engageBreakdown,
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
import { mulberry32 } from './drawTest'
import {
  ALWAYS_FAIL,
  ALWAYS_PASS,
  bagOf,
  playRound,
  testMember,
  type BattlePlan,
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
    expect(battle.players[0].resources.resolve).toBe(3)
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

  it('lists abilities that are not built yet as unavailable, and hides Triggered and Interval ones', () => {
    const b = duel({ abilityIds: ['shieldWall', 'cleave', 'fortify'] })
    const options = availableCombatActions(b, b.players[0])
    expect(options.find((o) => o.id === 'ability:shieldWall')!.disabledReason).toMatch(/sample battle/)
    expect(options.some((o) => o.id === 'ability:cleave')).toBe(false)
    expect(options.some((o) => o.id === 'ability:fortify')).toBe(false)
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
