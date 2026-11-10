import { normalizeHands } from '../data/weapons'
import { buildCharacter, type CharacterDraft } from './buildCharacter'
import type { PartyMember } from './dungeonState'

/** Snapshot of a finished character as they enter the dungeon. */
export function createPartyMember(key: string, draft: CharacterDraft): PartyMember {
  const built = buildCharacter(draft)
  const resources = Object.fromEntries(built.inPlay.map((s) => [s.tokenId, s.count]))
  const restResourceId = built.profession?.fixedStartingTokens[0]?.tokenId ?? ''
  return {
    key,
    name: built.name.trim() || 'Unnamed adventurer',
    professionId: built.profession?.id ?? '',
    speciesId: built.species?.id ?? '',
    hp: built.startingHp ?? 0,
    maxHp: built.startingHp ?? 0,
    special: built.special,
    bag: built.bag,
    inventory: Object.fromEntries(built.inventory.map((e) => [e.item.id, e.count])),
    resources,
    restResourceId,
    shieldsInPlay: 0,
    hands: normalizeHands(draft.hands),
    portrait: draft.portrait ?? null,
    abilityIds: built.chosenAbilities.map((a) => a.id),
  }
}
