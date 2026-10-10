'use client'

// Adapted from Magic UI Border Beam (MIT), https://magicui.design/docs/components/border-beam.
// See THIRD_PARTY_NOTICES.md and packages/blocks/THIRD_PARTY_LICENSES.md.
// Changes: theme colours (`--color-brand` into `--color-accent`) instead of fixed hex, rem
// sizes, Motion's vanilla `animate` loaded after hydration instead of `motion/react`, and no
// beam at all under reduced motion (the container keeps its plain border).
import { useEffect, useRef } from 'react'
import { loadMotion } from '../lazy-motion'
import { useReducedMotion } from '../use-reduced-motion'

type BorderBeamProps = {
  /** Length of the beam in rem. */
  sizeRem?: number | undefined
  /** Seconds for one lap. */
  durationSeconds?: number | undefined
  /** Border width in rem. */
  widthRem?: number | undefined
}

/**
 * A short gradient of light that runs around the border of its parent (which needs `relative`
 * and a border radius). Purely decorative.
 */
export default function BorderBeam({
  sizeRem = 12,
  durationSeconds = 8,
  widthRem = 0.0625,
}: BorderBeamProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const beam = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = beam.current
    if (!el || reducedMotion) return
    let live = true
    let run: { stop(): void } | undefined
    loadMotion()
      .then(({ animate }) => {
        if (!live) return
        run = animate(
          el,
          { offsetDistance: ['0%', '100%'] },
          { duration: durationSeconds, repeat: Infinity, ease: 'linear' },
        )
      })
      .catch(() => {})
    return () => {
      live = false
      run?.stop()
    }
  }, [reducedMotion, durationSeconds])

  // Early returns
  if (reducedMotion) return null

  // Render logic
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-transparent mask-[linear-gradient(transparent,transparent),linear-gradient(black,black)] mask-intersect [mask-clip:padding-box,border-box]"
      style={{ borderWidth: `${widthRem}rem` }}
    >
      <div
        ref={beam}
        className="absolute aspect-square bg-linear-to-l from-[var(--color-brand)] via-[var(--color-accent)] to-transparent"
        style={{ width: `${sizeRem}rem`, offsetPath: `rect(0 auto auto 0 round ${sizeRem}rem)` }}
      />
    </div>
  )
}
