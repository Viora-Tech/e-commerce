'use client'

// Adapted from Aceternity UI Meteors (Aceternity UI licence, free component; builder use
// permitted by the owner, see docs/licences/aceternity-pro.md), https://ui.aceternity.com/components/meteors.
// Changes: the meteors are spread and timed from their index instead of Math.random(), so
// the server and the browser draw the same markup (no hydration mismatch); colours come from
// the theme (`--color-ink` head, `--color-brand` tail, as Zero Drift's newsletter card had them);
// rem sizes; the CSS fade-in replaces the Motion wrapper; nothing renders under reduced
// motion. Keyframes: `styles/effects.css`. Place it as the first child of a
// `relative overflow-hidden isolate` box.
import type { CSSProperties } from 'react'
import { cx } from '../slot-types'
import { useReducedMotion } from '../use-reduced-motion'

type MeteorsProps = {
  count?: number | undefined
  className?: string | undefined
}

/** Spread across a little more than the box, so the slanted trails also cross its left edge. */
const SPREAD_PERCENT = 110
const MAX_DELAY_SECONDS = 6
const MIN_SECONDS = 3
const SPAN_SECONDS = 5

/** A repeatable 0..1 value per meteor (golden-ratio steps look random without being random). */
const fraction = (index: number, salt: number) => ((index + 1) * 0.618_034 * salt) % 1

function meteorStyle(index: number, count: number): CSSProperties {
  return {
    left: `${((index / count) * SPREAD_PERCENT).toFixed(2)}%`,
    animationDelay: `${(fraction(index, 7) * MAX_DELAY_SECONDS).toFixed(2)}s`,
    animationDuration: `${(MIN_SECONDS + fraction(index, 13) * SPAN_SECONDS).toFixed(2)}s`,
  }
}

export default function Meteors({ count = 16, className }: MeteorsProps) {
  // Hooks
  const reduce = useReducedMotion()

  // Early returns
  if (reduce || count < 1) return null

  return (
    <span
      aria-hidden="true"
      className={cx(
        'pointer-events-none absolute inset-0 -z-10 animate-[fade-in_0.5s_ease-out_both]',
        className,
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: meteors are decorative and fixed in number.
          key={i}
          style={meteorStyle(i, count)}
          className={cx(
            'absolute top-[-0.5rem] h-[0.125rem] w-[0.125rem] rotate-[215deg] rounded-full bg-[var(--color-ink)]',
            'animate-[meteor-effect_5s_linear_infinite]',
            "before:absolute before:top-1/2 before:h-px before:w-[5rem] before:-translate-y-1/2 before:bg-linear-to-r before:from-[var(--color-brand)] before:to-transparent before:content-['']",
          )}
        />
      ))}
    </span>
  )
}
