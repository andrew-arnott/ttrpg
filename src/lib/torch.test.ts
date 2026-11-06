import { describe, expect, it } from 'vitest'
import { HOLY_TORCH, ORDINARY_TORCH } from '../data/items'
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

  it('burns an ordinary torch Bright 1, Steady 3, Dim 2', () => {
    expect([ORDINARY_TORCH.bright, ORDINARY_TORCH.steady, ORDINARY_TORCH.dim]).toEqual([1, 3, 2])
  })

  it('burns a holy torch Bright 3, Steady 3, Dim 2 for 8 Intervals', () => {
    expect([HOLY_TORCH.bright, HOLY_TORCH.steady, HOLY_TORCH.dim]).toEqual([3, 3, 2])
    expect(totalIntervals(HOLY_TORCH)).toBe(8)
  })
})
