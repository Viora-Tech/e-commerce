'use client'

// Adapted from Magic UI Number Ticker (MIT), https://magicui.design/docs/components/number-ticker.
// See THIRD_PARTY_NOTICES.md and packages/blocks/THIRD_PARTY_LICENSES.md.
// Changes: an IntersectionObserver and requestAnimationFrame instead of `motion/react` springs,
// Indian digit grouping, and the final value rendered first (server, no script, reduced motion),
// so a number never shows as a blank "0".
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../use-reduced-motion'

type NumberTickerProps = {
  value: number
  /** Copy is a string in storage, a React node while edited on the canvas. */
  prefix?: ReactNode
  suffix?: ReactNode
  className?: string | undefined
}

const DURATION_MS = 1400

function formatValue(value: number, decimals: number): string {
  return decimals === 0 ? Math.round(value).toLocaleString('en-IN') : value.toFixed(decimals)
}

/** A number that counts up from zero the first time it scrolls into view. */
export default function NumberTicker({ value, prefix, suffix, className }: NumberTickerProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(value)
  useEffect(() => {
    setDisplay(value)
    if (reducedMotion) return
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        setDisplay(0)
        const start = performance.now()
        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / DURATION_MS)
          setDisplay(value * (1 - (1 - progress) ** 3))
          if (progress < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
        observer.disconnect()
      },
      { threshold: 0.4 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [reducedMotion, value])

  // Render logic
  const decimals = Number.isInteger(value) ? 0 : 1

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatValue(display, decimals)}
      {suffix}
    </span>
  )
}
