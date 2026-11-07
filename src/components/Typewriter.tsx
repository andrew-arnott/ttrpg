import { useEffect, useRef, useState } from 'react'

const CHAR_MS = 16

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Types `text` out one character at a time and calls `onDone` once it is complete. */
export function Typewriter({ text, onDone }: { text: string; onDone?: () => void }) {
  const [count, setCount] = useState(0)
  const done = useRef(onDone)

  useEffect(() => {
    done.current = onDone
  })

  useEffect(() => {
    if (reducedMotion()) {
      const timer = window.setTimeout(() => {
        setCount(text.length)
        done.current?.()
      }, 0)
      return () => window.clearTimeout(timer)
    }
    const shown = { value: 0 }
    const timer = window.setInterval(() => {
      shown.value += 1
      setCount(shown.value)
      if (shown.value >= text.length) {
        window.clearInterval(timer)
        done.current?.()
      }
    }, CHAR_MS)
    return () => window.clearInterval(timer)
  }, [text])

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, count)}
        {count < text.length && <span className="caret" />}
      </span>
    </>
  )
}
