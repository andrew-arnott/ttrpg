import { describe, expect, it } from 'vitest'
import { ORDINARY_TORCH } from '../data/items'
import { burnInterval, lightTorch, torchLevel, totalIntervals, type TorchLevel } from './torch'

describe('torch', () => {
  it('burns Bright, then Steady, then Dim, then goes out', () => {
    let torch = lightTorch(ORDINARY_TORCH)
    const levels: TorchLevel[] = []
    for (let i = 0; i <= totalIntervals(ORDINARY_TORCH); i++) {
      levels.push(torchLevel(torch))
      torch = burnInterval(torch)
    }
    expect(levels).toEqual([
      ...Array(ORDINARY_TORCH.bright).fill('bright'),
      ...Array(ORDINARY_TORCH.steady).fill('steady'),
      ...Array(ORDINARY_TORCH.dim).fill('dim'),
      'out',
    ])
  })

  it('never burns below zero', () => {
    let torch = lightTorch(ORDINARY_TORCH)
    for (let i = 0; i < 20; i++) torch = burnInterval(torch)
    expect(torch.remaining).toBe(0)
    expect(torchLevel(torch)).toBe('out')
  })
})
