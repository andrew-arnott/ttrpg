import { adjustBag } from '../tokenFlow'
import type { Commitment } from '../tokenFlow'
import type { BattlePlayer, BattleState, Pulse } from './types'

const sealedMana = (pulse: Pulse) => pulse.tokens.reduce((sum, t) => sum + (t.value ?? 1), 0)

/** Everyone still standing in a group, in a stable order so memberships can be compared. */
function livingIn(b: BattleState, groupId: string): string[] {
  const standing = new Set([
    ...b.players.filter((p) => p.hp > 0).map((p) => p.key),
    ...b.enemies.filter((e) => e.hp > 0).map((e) => e.id),
  ])
  return Object.entries(b.groups)
    .filter(([id, g]) => g === groupId && standing.has(id))
    .map(([id]) => id)
    .sort()
}

function giveBack(b: BattleState, pulse: Pulse, count: number): number {
  const wizard = b.players.find((p) => p.key === pulse.byKey)
  const returned = pulse.tokens.splice(0, count)
  if (wizard) for (const token of returned) wizard.bag = adjustBag(wizard.bag, token.tokenId, 1)
  return returned.length
}

/**
 * Dissonant Pulse ends for any group whose membership has changed (someone joined, left or died)
 * or that has no enemy left in it: all the Mana sealed there returns to the Wizard's bag. Each
 * enemy's Defense penalty is then set from the pulses that remain.
 */
export function syncPulses(b: BattleState) {
  const kept: Pulse[] = []
  for (const pulse of b.pulses ?? []) {
    const members = livingIn(b, pulse.groupId)
    const intact = members.join('|') === pulse.members.join('|') && b.enemies.some((e) => e.hp > 0 && members.includes(e.id))
    if (intact) kept.push(pulse)
    else giveBack(b, pulse, pulse.tokens.length)
  }
  b.pulses = kept
  for (const e of b.enemies) {
    e.defensePenalty = kept.filter((p) => b.groups[e.id] === p.groupId).reduce((sum, p) => sum + sealedMana(p), 0)
  }
}

/** Seals the committed Mana on a group. More Mana on the same group stacks its penalty. */
export function sealPulse(b: BattleState, wizard: BattlePlayer, groupId: string, commit: Commitment) {
  const tokens = commit.tokens.map((token) => {
    token.sealed = true
    const stoodIn = token.tokenId !== commit.resourceId
    return { tokenId: token.tokenId, byKey: wizard.key, ...(stoodIn ? { as: commit.resourceId, value: token.value } : {}) }
  })
  const existing = (b.pulses ?? []).find((p) => p.groupId === groupId && p.byKey === wizard.key)
  if (existing) existing.tokens.push(...tokens)
  else b.pulses = [...(b.pulses ?? []), { groupId, byKey: wizard.key, tokens, members: livingIn(b, groupId) }]
  syncPulses(b)
}

/** At the start of the Wizard's turn, 1 sealed Mana returns from each of their pulses. */
export function returnPulseMana(b: BattleState, wizard: BattlePlayer): number {
  let returned = 0
  for (const pulse of (b.pulses ?? []).filter((p) => p.byKey === wizard.key)) returned += giveBack(b, pulse, 1)
  b.pulses = (b.pulses ?? []).filter((p) => p.tokens.length > 0)
  syncPulses(b)
  return returned
}
