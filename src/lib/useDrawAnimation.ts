import { useCallback, useEffect, useRef, useState } from 'react'
import type { TestResult } from './drawTest'

export type DrawPhase = 'idle' | 'shaking' | 'revealing' | 'done'

const REVEAL_MS = 650
const REDUCED_REVEAL_MS = 120
const SHAKE_MS = 700

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Drives the pouch-shake then token-by-token reveal for a drawn test.
 * `onDone` fires once the last token has been shown.
 */
export function useDrawAnimation(onDone?: (result: TestResult) => void) {
  const [phase, setPhase] = useState<DrawPhase>('idle')
  const [result, setResult] = useState<TestResult | null>(null)
  const [revealed, setRevealed] = useState(0)
  const timer = useRef<number | undefined>(undefined)
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  })

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (phase === 'shaking') {
      timer.current = window.setTimeout(() => setPhase('revealing'), prefersReducedMotion() ? 0 : SHAKE_MS)
    } else if (phase === 'revealing' && result) {
      const delay = prefersReducedMotion() ? REDUCED_REVEAL_MS : REVEAL_MS
      if (revealed >= result.drawn.length) {
        timer.current = window.setTimeout(() => {
          setPhase('done')
          onDoneRef.current?.(result)
        }, delay / 2)
      } else {
        timer.current = window.setTimeout(() => setRevealed((n) => n + 1), delay)
      }
    }
    return () => window.clearTimeout(timer.current)
  }, [phase, revealed, result])

  const start = useCallback((next: TestResult) => {
    setResult(next)
    setRevealed(0)
    setPhase('shaking')
  }, [])

  const reset = useCallback(() => {
    window.clearTimeout(timer.current)
    setResult(null)
    setRevealed(0)
    setPhase('idle')
  }, [])

  const busy = phase === 'shaking' || phase === 'revealing'
  const shown = result ? result.drawn.slice(0, revealed) : []

  return { phase, result, revealed, shown, busy, start, reset }
}
