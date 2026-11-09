import { normalizeHands, type Hands } from '../data/weapons'
import { emptyDraft, type CharacterDraft } from './buildCharacter'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function numberMap(raw: unknown): Record<string, number> {
  if (!isRecord(raw)) return {}
  return Object.fromEntries(
    Object.entries(raw).filter(
      (entry): entry is [string, number] => Number.isInteger(entry[1]) && (entry[1] as number) >= 0,
    ),
  )
}

/**
 * Accepts only the fields we know about, so a hand-edited or stale file cannot
 * inject arbitrary keys into the draft. Accepts either a bare draft or an
 * export payload that wraps one under `draft`.
 */
export function parseDraft(raw: unknown): CharacterDraft | string {
  if (!isRecord(raw)) return 'File is not a character object.'
  const draft = isRecord(raw.draft) ? raw.draft : raw
  const base = emptyDraft()

  const tokenChoices: CharacterDraft['tokenChoices'] = {}
  if (isRecord(draft.tokenChoices)) {
    for (const [choiceId, picked] of Object.entries(draft.tokenChoices)) {
      tokenChoices[choiceId] = numberMap(picked)
    }
  }

  return {
    name: typeof draft.name === 'string' ? draft.name : base.name,
    professionId: typeof draft.professionId === 'string' ? draft.professionId : null,
    specialAssignment: numberMap(draft.specialAssignment) as CharacterDraft['specialAssignment'],
    speciesId: typeof draft.speciesId === 'string' ? draft.speciesId : null,
    backgroundId: typeof draft.backgroundId === 'string' ? draft.backgroundId : null,
    tokenChoices,
    abilityIds: Array.isArray(draft.abilityIds)
      ? draft.abilityIds.filter((a): a is string => typeof a === 'string')
      : [],
    equipment: numberMap(draft.equipment),
    hands: normalizeHands(isRecord(draft.hands) ? (draft.hands as Partial<Hands>) : undefined),
  }
}
