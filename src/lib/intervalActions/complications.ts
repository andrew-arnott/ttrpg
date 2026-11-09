import type { RoomComplication } from '../../data/dungeon'
import { ITEMS_BY_ID } from '../../data/items'
import { takeDamage } from '../characterTest'
import { revealVisible, type DungeonState, type PartyMember } from '../dungeonState'
import { playerActor, type StepTone } from '../resolution'
import { burnInterval, TORCH_LEVEL_LABEL, torchLevel } from '../torch'
import { updateMember, type Resolution } from './context'

/** What a Complication does in a room, applied to the character who drew it. */
export function applyComplication(
  state: DungeonState,
  member: PartyMember,
  trigger: RoomComplication,
  colorIndex: number,
): Resolution {
  const { effect } = trigger
  let next = state
  let outcome = ''
  let tone: StepTone = 'failure'

  switch (effect.kind) {
    case 'damage': {
      next = updateMember(state, member.key, (m) => {
        const hurt = { ...m }
        takeDamage(hurt, effect.amount, false)
        return hurt
      })
      const hurt = next.party.find((m) => m.key === member.key)!
      outcome = `${member.name} takes ${effect.amount} damage (${hurt.hp}/${hurt.maxHp} HP).`
      break
    }
    case 'torch': {
      const torch = burnInterval(state.torch)
      next = revealVisible({ ...state, torch })
      const level = torchLevel(torch)
      outcome =
        level === 'out'
          ? 'The torch burns down an extra step and goes out.'
          : `The torch burns down an extra step and is now ${TORCH_LEVEL_LABEL[level]}.`
      break
    }
    case 'noise': {
      if (state.patrolStartedAt !== null && !state.patrolTriggered) {
        next = { ...state, patrolStartedAt: state.patrolStartedAt - 1 }
        outcome = 'The noise carries through the halls. The patrol will arrive an Interval sooner.'
      } else {
        outcome = 'The noise echoes through the empty halls. For now, nothing answers.'
        tone = 'neutral'
      }
      break
    }
    case 'drop': {
      const item = ITEMS_BY_ID[effect.itemId]
      if ((member.inventory[effect.itemId] ?? 0) > 0) {
        next = updateMember(state, member.key, (m) => ({
          ...m,
          inventory: { ...m.inventory, [effect.itemId]: (m.inventory[effect.itemId] ?? 0) - 1 },
        }))
        outcome = `${member.name} loses a ${item?.name.toLowerCase() ?? effect.itemId}.`
      } else {
        outcome = `Something nearly slips away, but ${member.name} has nothing of that kind to lose.`
        tone = 'neutral'
      }
      break
    }
  }

  return {
    state: next,
    step: { actor: playerActor(member, colorIndex), title: 'Complication!', intro: trigger.text, outcome, tone },
  }
}
