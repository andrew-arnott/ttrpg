import type { CharacterDraft } from './buildCharacter'
import { parseDraft } from './draftIO'

export const STORAGE_KEY = 'ttrpg.savedCharacters.v1'

export interface SavedCharacter {
  id: string
  savedAt: string
  draft: CharacterDraft
}

/** The slice of the Web Storage API the store needs, so tests can fake it. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

export function listSaved(storage: KeyValueStorage): SavedCharacter[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const saved: SavedCharacter[] = []
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue
    const { id, savedAt, draft } = entry as Record<string, unknown>
    if (typeof id !== 'string' || typeof savedAt !== 'string') continue
    const draftOrError = parseDraft(draft)
    if (typeof draftOrError === 'string') continue
    saved.push({ id, savedAt, draft: draftOrError })
  }
  return saved
}

function write(storage: KeyValueStorage, list: SavedCharacter[]) {
  storage.setItem(STORAGE_KEY, JSON.stringify(list))
}

let idCounter = 0
function newId(): string {
  idCounter += 1
  return `${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Updates the entry with `id` in place, or appends a new one when `id` is null or unknown. */
export function saveCharacter(
  storage: KeyValueStorage,
  draft: CharacterDraft,
  id: string | null,
  now: Date = new Date(),
): SavedCharacter {
  const list = listSaved(storage)
  const existing = id === null ? undefined : list.find((c) => c.id === id)
  const entry: SavedCharacter = {
    id: existing?.id ?? newId(),
    savedAt: now.toISOString(),
    draft,
  }
  write(storage, existing ? list.map((c) => (c.id === entry.id ? entry : c)) : [...list, entry])
  return entry
}

export function deleteSaved(storage: KeyValueStorage, id: string): void {
  write(
    storage,
    listSaved(storage).filter((c) => c.id !== id),
  )
}
