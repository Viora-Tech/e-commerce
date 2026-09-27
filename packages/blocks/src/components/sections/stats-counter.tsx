'use client'

import { useEffect, useRef, useState } from 'react'
// Adapted from Magic UI's Number Ticker (MIT). See THIRD_PARTY_NOTICES.md and
// packages/blocks/THIRD_PARTY_LICENSES.md.
import { useReducedMotion } from '../../use-reduced-motion'

type Stat = { value: number; prefix: string; suffix: string; label: string }

type StatsCounterProps = { heading: string; stats: Stat[] }

const DURATION_MS = 1400

function formatValue(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString('en-IN') : value.toFixed(1)
}

// Counts up when scrolled into view via IntersectionObserver; reduced motion (and any
// environment without IntersectionObserver, e.g. the admin's static preview render) shows the
// final value immediately, no layout shift.
export default function StatsCounter({ heading, stats }: StatsCounterProps) {
  // Early returns
  if (stats.length === 0) return null

  return (
    <div className="page-width">
      {heading ? <h2 className="h2 text-center text-[var(--color-ink)]">{heading}</h2> : null}
      <div className="mt-[1.5rem] grid grid-cols-2 gap-[1.5rem] text-center md:grid-cols-4">
        {stats.map((stat, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
          <div key={`${stat.label}-${i}`} className="flex flex-col items-center gap-[0.25rem]">
            <Counter stat={stat} />
            {stat.label ? (
              <p className="text-body text-[var(--color-muted)]">{stat.label}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function Counter({ stat }: { stat: Stat }) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  // Starts at the final value so server-rendered/no-JS output already shows real numbers
  // (never a blank "0"); the animation, when it runs, counts up from 0 to that same value.
  const [display, setDisplay] = useState(stat.value)
  useEffect(() => {
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
          setDisplay(stat.value * (1 - (1 - progress) ** 3))
          if (progress < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
        observer.disconnect()
      },
      { threshold: 0.4 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [reducedMotion, stat.value])

  // Render logic
  return (
    <span ref={ref} className="h1 text-[var(--color-ink)]">
      {stat.prefix}
      {formatValue(display)}
      {stat.suffix}
    </span>
  )
}
