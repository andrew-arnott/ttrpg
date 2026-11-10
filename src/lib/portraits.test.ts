import { describe, expect, it } from 'vitest'
import { portraitOptions, PORTRAIT_COUNT } from '../data/portraits'
import { PROFESSIONS } from '../data/professions'
import { artUrl, characterArtUrl } from './art'
import { emptyDraft } from './buildCharacter'
import { parseDraft } from './draftIO'
import { createPartyMember } from './partyMember'
import { sampleRoster } from './roster'

const UPLOAD = 'data:image/webp;base64,AAAA'

describe('portraits', () => {
  it('has portraits for every profession and a symbol for each', () => {
    for (const profession of PROFESSIONS) {
      expect(portraitOptions(profession.id)).toHaveLength(PORTRAIT_COUNT)
      for (const id of portraitOptions(profession.id)) expect(artUrl('portrait', id), id).toBeTruthy()
      expect(artUrl('profession', profession.id), profession.id).toBeTruthy()
    }
  })

  it('shows an upload, a chosen portrait, or the first portrait for the profession', () => {
    expect(characterArtUrl('warrior', UPLOAD)).toBe(UPLOAD)
    expect(characterArtUrl('warrior', 'warrior-3')).toBe(artUrl('portrait', 'warrior-3'))
    expect(characterArtUrl('warrior', null)).toBe(artUrl('portrait', 'warrior-1'))
    expect(characterArtUrl('warrior', 'nonsense')).toBe(artUrl('portrait', 'warrior-1'))
  })

  it('falls back to the profession symbol when a portrait is missing', () => {
    expect(characterArtUrl('warrior', 'warrior-9')).toBe(artUrl('profession', 'warrior'))
    expect(characterArtUrl(null, null)).toBeUndefined()
  })

  it('keeps a built-in id or a small upload when a character is imported, and drops the rest', () => {
    const load = (portrait: unknown) => (parseDraft({ ...emptyDraft(), portrait }) as { portrait: string | null }).portrait
    expect(load('rogue-2')).toBe('rogue-2')
    expect(load(UPLOAD)).toBe(UPLOAD)
    expect(load(`data:image/png;base64,${'A'.repeat(300_000)}`)).toBeNull()
    expect(load('javascript:alert(1)')).toBeNull()
    expect(load(42)).toBeNull()
    expect((parseDraft({ name: 'Old' }) as { portrait: string | null }).portrait).toBeNull()
  })

  it('gives the sample characters portraits that carry into the dungeon', () => {
    const portraits = Object.fromEntries(sampleRoster().map((s) => [s.label, createPartyMember(s.key, s.draft).portrait]))
    expect(portraits).toEqual({
      'Brann Ironhold': 'warrior-1',
      'Wren Quickfingers': 'rogue-2',
      'Sister Maren': 'priest-1',
      'Ilvara Dawnleaf': 'wizard-2',
    })
  })
})
