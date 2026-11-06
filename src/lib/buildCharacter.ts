import { BACKGROUNDS } from '../data/backgrounds'
import { ITEMS_BY_ID, STARTING_COINS, type Item } from '../data/items'
import { PROFESSIONS } from '../data/professions'
import { SPECIES } from '../data/species'
import { STANDARD_BAG, TOKENS } from '../data/tokens'
import {
  SPECIAL_ARRAY,
  SPECIAL_KEYS,
  type Ability,
  type BagMod,
  type Background,
  type Profession,
  type SpecialKey,
  type SpecialSpread,
  type Species,
  type TokenStack,
} from '../data/types'

/** Everything the wizard collects. Serialised as-is for JSON export. */
export interface CharacterDraft {
  name: string
  professionId: string | null
  /** Index into SPECIAL_ARRAY assigned to each attribute, or absent if unassigned. */
  specialAssignment: Partial<Record<SpecialKey, number>>
  speciesId: string | null
  backgroundId: string | null
  /** Keyed by TokenChoice id, then token id -> count. */
  tokenChoices: Record<string, Record<string, number>>
  abilityIds: string[]
  /** Item id -> quantity bought with starting coins. */
  equipment: Record<string, number>
}

export function emptyDraft(): CharacterDraft {
  return {
    name: '',
    professionId: null,
    specialAssignment: {},
    speciesId: null,
    backgroundId: null,
    tokenChoices: {},
    abilityIds: [],
    equipment: {},
  }
}

// --- bag maths ---------------------------------------------------------

function toMap(stacks: TokenStack[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of stacks) m.set(s.tokenId, (m.get(s.tokenId) ?? 0) + s.count)
  return m
}

function toStacks(m: Map<string, number>): TokenStack[] {
  return [...m.entries()]
    .filter(([, count]) => count > 0)
    .map(([tokenId, count]) => ({ tokenId, count }))
}

export function applyBagMods(bag: TokenStack[], mods: BagMod[]): TokenStack[] {
  const m = toMap(bag)
  for (const mod of mods) {
    if (mod.kind === 'add') {
      m.set(mod.tokenId, (m.get(mod.tokenId) ?? 0) + mod.count)
    } else if (mod.kind === 'remove') {
      m.set(mod.tokenId, Math.max(0, (m.get(mod.tokenId) ?? 0) - mod.count))
    } else {
      // Replace only as many as actually exist, so a data error cannot
      // manufacture tokens out of nothing.
      const available = m.get(mod.fromTokenId) ?? 0
      const moved = Math.min(available, mod.count)
      m.set(mod.fromTokenId, available - moved)
      m.set(mod.toTokenId, (m.get(mod.toTokenId) ?? 0) + moved)
    }
  }
  return toStacks(m)
}

export interface BagStats {
  size: number
  expectedModifier: number
  expectedTokensDrawn: number
  critFailureChance: number
  critSuccessChance: number
  complicationChance: number
}

/**
 * Exact draw statistics for a bag.
 *
 * A test draws without replacement until it hits a token that ends the draw.
 * Think of the bag as a random permutation: a terminator is drawn iff it is
 * the first terminator, probability 1/T. A Chain token is drawn iff it
 * precedes every terminator, probability 1/(T+1). Summing modifier * P over
 * the bag gives the expected contribution with no simulation needed.
 */
export function bagStats(bag: TokenStack[]): BagStats {
  const size = bag.reduce((a, s) => a + s.count, 0)
  const terminators = bag
    .filter((s) => !TOKENS[s.tokenId]?.keywords.includes('chain'))
    .reduce((a, s) => a + s.count, 0)
  const chains = size - terminators

  if (size === 0 || terminators === 0) {
    return {
      size,
      expectedModifier: 0,
      expectedTokensDrawn: 0,
      critFailureChance: 0,
      critSuccessChance: 0,
      complicationChance: 0,
    }
  }

  const pTerminator = 1 / terminators
  const pChain = 1 / (terminators + 1)

  let expectedModifier = 0
  for (const stack of bag) {
    const def = TOKENS[stack.tokenId]
    if (!def || def.modifier === null) continue
    const p = def.keywords.includes('chain') ? pChain : pTerminator
    expectedModifier += def.modifier * stack.count * p
  }

  const countOf = (id: string) => bag.find((s) => s.tokenId === id)?.count ?? 0

  return {
    size,
    expectedModifier,
    expectedTokensDrawn: 1 + chains * pChain,
    critFailureChance: countOf('critFailure') * pTerminator,
    critSuccessChance: countOf('critSuccess') * pTerminator,
    complicationChance: countOf('complication') * pChain,
  }
}

// --- character assembly ------------------------------------------------

/** Wizard steps, in order. Issues are tagged with the step that owns them. */
export const STEP_IDS = ['profession', 'species', 'background', 'special', 'abilities', 'equipment'] as const
export type StepId = (typeof STEP_IDS)[number]

export interface Issue {
  step: StepId
  message: string
}

/**
 * The full pool a profession's picks come from: combat abilities and
 * exploration abilities are chosen together.
 */
export function allAbilities(profession: Profession | null): Ability[] {
  if (!profession) return []
  return [...profession.abilities, ...profession.explorationAbilities]
}

export interface InventoryEntry {
  item: Item
  count: number
}

export interface BuiltCharacter {
  name: string
  profession: Profession | null
  species: Species | null
  background: Background | null
  /** Values straight from the array, before species and background bonuses. */
  baseSpecial: SpecialSpread
  /** Final values after all bonuses. */
  special: SpecialSpread
  bonuses: Partial<Record<SpecialKey, { from: string; amount: number }[]>>
  startingHp: number | null
  /** Tokens in the bag at creation. Profession resources are not in here. */
  bag: TokenStack[]
  /** Profession resources, which the guide says begin in play. */
  inPlay: TokenStack[]
  stats: BagStats
  chosenAbilities: Ability[]
  inventory: InventoryEntry[]
  coinsSpent: number
  coinsLeft: number
  complete: boolean
  issues: Issue[]
  /** Issue messages for one step, for inline display. */
  issuesFor: (step: StepId) => string[]
}

const zeroSpread = (): SpecialSpread =>
  Object.fromEntries(SPECIAL_KEYS.map((k) => [k, 0])) as SpecialSpread

export function buildCharacter(draft: CharacterDraft): BuiltCharacter {
  const profession = PROFESSIONS.find((p) => p.id === draft.professionId) ?? null
  const species = SPECIES.find((s) => s.id === draft.speciesId) ?? null
  const background = BACKGROUNDS.find((b) => b.id === draft.backgroundId) ?? null

  const baseSpecial = zeroSpread()
  for (const key of SPECIAL_KEYS) {
    const idx = draft.specialAssignment[key]
    if (idx !== undefined && SPECIAL_ARRAY[idx] !== undefined) {
      baseSpecial[key] = SPECIAL_ARRAY[idx]
    }
  }

  const special = { ...baseSpecial }
  const bonuses: BuiltCharacter['bonuses'] = {}
  const addBonus = (key: SpecialKey, from: string, amount: number) => {
    special[key] += amount
    bonuses[key] = [...(bonuses[key] ?? []), { from, amount }]
  }
  if (species?.attributeBonus) addBonus(species.attributeBonus, species.name, 1)
  if (background) addBonus(background.attributeBonus, background.name, 1)

  // Standard bag, then species modifications. Profession resources start in play.
  let bag = STANDARD_BAG.map((s) => ({ ...s }))
  if (species) bag = applyBagMods(bag, species.bagMods)

  const inPlayMap = new Map<string, number>()
  if (profession) {
    for (const stack of profession.fixedStartingTokens) {
      inPlayMap.set(stack.tokenId, (inPlayMap.get(stack.tokenId) ?? 0) + stack.count)
    }
    for (const choice of profession.tokenChoices) {
      const picked = draft.tokenChoices[choice.id] ?? {}
      for (const [tokenId, count] of Object.entries(picked)) {
        if (count > 0) inPlayMap.set(tokenId, (inPlayMap.get(tokenId) ?? 0) + count)
      }
    }
  }

  const chosenAbilities = allAbilities(profession).filter((a) => draft.abilityIds.includes(a.id))

  const inventory = ownedItems(draft)
  const coinsSpent = inventory.reduce((a, e) => a + e.item.cost * e.count, 0)

  const issues = validate(draft, profession)

  return {
    name: draft.name,
    profession,
    species,
    background,
    baseSpecial,
    special,
    bonuses,
    startingHp: profession?.startingHp ?? null,
    bag,
    inPlay: toStacks(inPlayMap),
    stats: bagStats(bag),
    chosenAbilities,
    inventory,
    coinsSpent,
    coinsLeft: STARTING_COINS - coinsSpent,
    complete: issues.length === 0,
    issues,
    issuesFor: (step) => issues.filter((i) => i.step === step).map((i) => i.message),
  }
}

function ownedItems(draft: CharacterDraft): InventoryEntry[] {
  return Object.entries(draft.equipment)
    .map(([id, count]) => ({ item: ITEMS_BY_ID[id], count }))
    .filter((e): e is InventoryEntry => e.item !== undefined && e.count > 0)
}

export function validate(draft: CharacterDraft, profession: Profession | null): Issue[] {
  const issues: Issue[] = []
  const add = (step: StepId, message: string) => issues.push({ step, message })

  if (!profession) {
    add('profession', 'Choose a profession.')
  } else if (!profession.defined) {
    add('profession', `${profession.name} is not yet defined in the Player's Guide.`)
  }

  const assigned = Object.values(draft.specialAssignment).filter((v) => v !== undefined)
  if (assigned.length < SPECIAL_ARRAY.length) {
    add(
      'special',
      `Assign all ${SPECIAL_ARRAY.length} SPECIAL values (${SPECIAL_ARRAY.length - assigned.length} left).`,
    )
  } else if (new Set(assigned).size !== assigned.length) {
    add('special', 'Each value from the array may only be used once.')
  }

  if (!draft.speciesId) add('species', 'Choose a species.')
  if (!draft.backgroundId) add('background', 'Choose a background.')

  if (profession) {
    for (const choice of profession.tokenChoices) {
      const picked = draft.tokenChoices[choice.id] ?? {}
      const total = Object.values(picked).reduce((a, b) => a + b, 0)
      if (total !== choice.total) {
        add('abilities', `Allocate all ${choice.total} combat tokens (${total} of ${choice.total} chosen).`)
      }
    }
    if (profession.abilityPicks > 0 && draft.abilityIds.length !== profession.abilityPicks) {
      add(
        'abilities',
        `Choose ${profession.abilityPicks} abilities (${draft.abilityIds.length} of ${profession.abilityPicks} chosen).`,
      )
    }
  }

  const spent = ownedItems(draft).reduce((a, e) => a + e.item.cost * e.count, 0)
  if (spent > STARTING_COINS) {
    add('equipment', `You have spent ${spent} coins but only started with ${STARTING_COINS}.`)
  }

  return issues
}

/** Which array slots are still unused, for the SPECIAL assignment UI. */
export function remainingArrayIndices(draft: CharacterDraft): number[] {
  const used = new Set(Object.values(draft.specialAssignment).filter((v) => v !== undefined))
  return SPECIAL_ARRAY.map((_, i) => i).filter((i) => !used.has(i))
}

/**
 * Highest array values go to the profession's suggested attributes, in the
 * order the profession lists them, then the rest in canonical order.
 */
export function suggestedSpecialAssignment(
  profession: Profession | null,
): Partial<Record<SpecialKey, number>> {
  const suggested = profession?.importantSpecial ?? []
  const order: SpecialKey[] = [...suggested, ...SPECIAL_KEYS.filter((k) => !suggested.includes(k))]
  const byValue = SPECIAL_ARRAY.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v)
  const assignment: Partial<Record<SpecialKey, number>> = {}
  order.forEach((key, idx) => {
    assignment[key] = byValue[idx].i
  })
  return assignment
}
