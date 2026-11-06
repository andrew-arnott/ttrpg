import { describe, expect, it } from 'vitest'
import { emptyDraft, buildCharacter } from './buildCharacter'
import { parseDraft } from './draftIO'
import { buildRoster, sampleRoster } from './roster'
import {
  deleteSaved,
  listSaved,
  saveCharacter,
  STORAGE_KEY,
  type KeyValueStorage,
} from './savedCharacters'

function fakeStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v
    },
  }
}

describe('parseDraft', () => {
  it('rejects non-objects', () => {
    expect(typeof parseDraft(null)).toBe('string')
    expect(typeof parseDraft([])).toBe('string')
    expect(typeof parseDraft('hi')).toBe('string')
  })

  it('unwraps an export payload and keeps known fields only', () => {
    const parsed = parseDraft({
      version: 1,
      draft: { name: 'Ada', professionId: 'rogue', equipment: { torch: 2 }, evil: 'x' },
    })
    expect(parsed).toEqual({ ...emptyDraft(), name: 'Ada', professionId: 'rogue', equipment: { torch: 2 } })
  })

  it('defaults equipment for files saved before equipment existed', () => {
    const parsed = parseDraft({ name: 'Old', professionId: 'warrior' })
    expect(parsed).toMatchObject({ equipment: {} })
  })

  it('drops invalid quantities', () => {
    const parsed = parseDraft({ equipment: { torch: 2, ration: -1, potion: 1.5, bomb: 'x' } })
    expect(parsed).toMatchObject({ equipment: { torch: 2 } })
  })
})

describe('saved characters', () => {
  const draft = { ...emptyDraft(), name: 'Saved' }

  it('starts empty and survives corrupt storage', () => {
    expect(listSaved(fakeStorage())).toEqual([])
    expect(listSaved(fakeStorage({ [STORAGE_KEY]: '{not json' }))).toEqual([])
    expect(listSaved(fakeStorage({ [STORAGE_KEY]: '{"a":1}' }))).toEqual([])
  })

  it('saves new characters and lists them in order', () => {
    const storage = fakeStorage()
    const a = saveCharacter(storage, draft, null)
    const b = saveCharacter(storage, { ...draft, name: 'Second' }, null)
    expect(a.id).not.toBe(b.id)
    expect(listSaved(storage).map((c) => c.draft.name)).toEqual(['Saved', 'Second'])
  })

  it('overwrites an existing entry when given its id', () => {
    const storage = fakeStorage()
    const a = saveCharacter(storage, draft, null, new Date('2026-01-01T00:00:00Z'))
    const updated = saveCharacter(storage, { ...draft, name: 'Renamed' }, a.id, new Date('2026-02-01T00:00:00Z'))
    expect(updated.id).toBe(a.id)
    const list = listSaved(storage)
    expect(list).toHaveLength(1)
    expect(list[0].draft.name).toBe('Renamed')
    expect(list[0].savedAt).toBe('2026-02-01T00:00:00.000Z')
  })

  it('appends rather than failing when the id is unknown', () => {
    const storage = fakeStorage()
    saveCharacter(storage, draft, 'missing')
    expect(listSaved(storage)).toHaveLength(1)
  })

  it('deletes by id', () => {
    const storage = fakeStorage()
    const a = saveCharacter(storage, draft, null)
    saveCharacter(storage, { ...draft, name: 'Keep' }, null)
    deleteSaved(storage, a.id)
    expect(listSaved(storage).map((c) => c.draft.name)).toEqual(['Keep'])
  })

  it('skips entries that are malformed', () => {
    const storage = fakeStorage({
      [STORAGE_KEY]: JSON.stringify([
        { id: 'ok', savedAt: '2026-01-01', draft: { name: 'Fine' } },
        { id: 3 },
        null,
        { id: 'bad', savedAt: 'x', draft: 'nope' },
      ]),
    })
    expect(listSaved(storage).map((c) => c.id)).toEqual(['ok'])
  })
})

describe('roster', () => {
  it('ships complete sample characters', () => {
    const samples = sampleRoster()
    expect(samples.length).toBeGreaterThanOrEqual(4)
    for (const s of samples) {
      const built = buildCharacter(s.draft)
      expect(built.issues, s.label).toEqual([])
      expect(built.coinsLeft, s.label).toBeGreaterThanOrEqual(0)
      expect(built.inventory.find((e) => e.item.id === 'torch')?.count, s.label).toBeGreaterThan(0)
    }
  })

  it('includes the current and saved characters only when they are finished', () => {
    const [sample] = sampleRoster()
    const unfinished = { ...emptyDraft(), name: 'WIP' }
    const saved = [
      { id: 'done', savedAt: 'x', draft: { ...sample.draft, name: 'Done' } },
      { id: 'wip', savedAt: 'x', draft: unfinished },
    ]
    const roster = buildRoster({ ...sample.draft, name: 'Live' }, saved, [])
    expect(roster.map((r) => [r.key, r.source])).toEqual([
      ['current', 'current'],
      ['saved:done', 'saved'],
    ])
    expect(buildRoster(unfinished, [], []).map((r) => r.key)).toEqual([])
  })
})
