import type { TorchSpec } from '../data/items'

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
