import type { TorchSpec } from '../data/items'
import type { TestBonus } from './skillTest'

export type TorchLevel = 'bright' | 'steady' | 'dim' | 'out'

export interface TorchState {
  spec: TorchSpec
  /** Intervals of burn time left. */
  remaining: number
}

export function totalIntervals(spec: TorchSpec): number {
  return spec.bright + spec.steady + spec.dim
}

export function lightTorch(spec: TorchSpec): TorchState {
  return { spec, remaining: totalIntervals(spec) }
}

/** A torch burns Bright first, then Steady, then Dim, then goes out. */
export function torchLevel(torch: TorchState): TorchLevel {
  const { spec, remaining } = torch
  if (remaining <= 0) return 'out'
  if (remaining > spec.steady + spec.dim) return 'bright'
  if (remaining > spec.dim) return 'steady'
  return 'dim'
}

export function burnInterval(torch: TorchState): TorchState {
  return { ...torch, remaining: Math.max(0, torch.remaining - 1) }
}

export const TORCH_LEVEL_LABEL: Record<TorchLevel, string> = {
  bright: 'Bright',
  steady: 'Steady',
  dim: 'Dim',
  out: 'Out',
}

/** Tutorial prompt for the torch HUD, or null while the light is healthy. */
export function torchAdvice(level: TorchLevel, spareTorches: number): string | null {
  if (level === 'dim') {
    return spareTorches > 0
      ? 'Uh oh. Your torch is running out. You can light a new one by right-clicking it in a pack.'
      : 'Uh oh. Your torch is running out and nobody is carrying a spare.'
  }
  if (level === 'out') {
    return spareTorches > 0
      ? 'Right-click a torch in a pack to light it. Tests are harder in the dark.'
      : 'No spare torches left. The party is in the dark.'
  }
  return null
}

/** What the popup says when the torch goes out, for a tutorial player who has not seen it happen before. */
export function torchOutPopup(spareTorches: number): string[] {
  return [
    'Uh oh... without light the party can only see its own room, and every test is at -2, attacks and defence included. A dim torch is -1 and a bright one is +1, so the light you carry matters in a fight too.',
    spareTorches > 0
      ? 'You still have a spare. Right-click a torch in someone\u2019s pack to light it. Lighting a torch takes no time.'
      : 'Nobody is carrying a spare torch. Rooms you have not searched may hold one, so feel your way back to somewhere promising.',
  ]
}

const LIGHT_BONUS: Record<TorchLevel, { label: string; value: number } | null> = {
  bright: { label: 'Bright torch', value: 1 },
  steady: null,
  dim: { label: 'Dim torch', value: -1 },
  out: { label: 'No torch', value: -2 },
}

/** Light is a modifier on every test the party makes: Bright +1, Steady 0, Dim -1, no torch -2. */
export const lightBonus = (torch: TorchState): TestBonus | null => LIGHT_BONUS[torchLevel(torch)]
