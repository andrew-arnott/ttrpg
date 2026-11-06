import { PROFESSIONS } from '../data/professions'
import {
  buildCharacter,
  emptyDraft,
  suggestedSpecialAssignment,
  type CharacterDraft,
} from './buildCharacter'
import type { SavedCharacter } from './savedCharacters'

export type RosterSource = 'current' | 'saved' | 'sample'

export interface RosterEntry {
  key: string
  source: RosterSource
  label: string
  draft: CharacterDraft
}

const UNNAMED = 'Unnamed adventurer'

const SAMPLE_RECIPES = [
  { name: 'Brann Ironhold', professionId: 'warrior', speciesId: 'dwarf', backgroundId: 'soldier' },
  { name: 'Wren Quickfingers', professionId: 'rogue', speciesId: 'halfling', backgroundId: 'urchin' },
  { name: 'Sister Maren', professionId: 'priest', speciesId: 'human', backgroundId: 'scholar' },
  { name: 'Ilvara Dawnleaf', professionId: 'wizard', speciesId: 'elf', backgroundId: 'scholar' },
] as const

/**
 * A complete character for the given profession, taking the first listed
 * option wherever the rules ask for a choice. Used for ready-made party members.
 */
function sampleDraft(recipe: (typeof SAMPLE_RECIPES)[number]): CharacterDraft {
  const profession = PROFESSIONS.find((p) => p.id === recipe.professionId)
  if (!profession) throw new Error(`Unknown profession ${recipe.professionId}`)

  const tokenChoices: CharacterDraft['tokenChoices'] = {}
  for (const choice of profession.tokenChoices) {
    tokenChoices[choice.id] = { [choice.options[0]]: choice.total }
  }
  const pool = [...profession.abilities, ...profession.explorationAbilities]

  return {
    ...emptyDraft(),
    name: recipe.name,
    professionId: recipe.professionId,
    speciesId: recipe.speciesId,
    backgroundId: recipe.backgroundId,
    specialAssignment: suggestedSpecialAssignment(profession),
    tokenChoices,
    abilityIds: pool.slice(0, profession.abilityPicks).map((a) => a.id),
    equipment: { torch: 3, ration: 1, healingPotion: 1 },
  }
}

export function sampleRoster(): RosterEntry[] {
  return SAMPLE_RECIPES.map((recipe) => ({
    key: `sample:${recipe.professionId}`,
    source: 'sample' as const,
    label: recipe.name,
    draft: sampleDraft(recipe),
  }))
}

/**
 * Everyone selectable in the simulators: the character being edited (when it
 * is finished), saved characters, then the ready-made samples. The saved copy
 * of the character being edited is left out since the live draft supersedes it. Unfinished
 * characters are left out since the simulators need a full bag and inventory.
 */
export function buildRoster(
  current: CharacterDraft,
  currentSavedId: string | null,
  saved: SavedCharacter[],
  samples: RosterEntry[] = sampleRoster(),
): RosterEntry[] {
  const entries: RosterEntry[] = []
  if (buildCharacter(current).complete) {
    entries.push({
      key: 'current',
      source: 'current',
      label: `${current.name.trim() || UNNAMED} (editing)`,
      draft: current,
    })
  }
  for (const s of saved) {
    if (s.id === currentSavedId) continue
    if (!buildCharacter(s.draft).complete) continue
    entries.push({
      key: `saved:${s.id}`,
      source: 'saved',
      label: s.draft.name.trim() || UNNAMED,
      draft: s.draft,
    })
  }
  return [...entries, ...samples]
}
