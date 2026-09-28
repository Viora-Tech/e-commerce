'use client'

// Pattern after Aceternity UI's Spotlight (our own implementation, not copied code).
// See THIRD_PARTY_NOTICES.md.
import { type PointerEvent, useEffect, useRef, useState } from 'react'
import { loadMotion } from '../../lazy-motion'
import { linkTarget } from '../../link'
import type { Link } from '../../sections/framed'
import { safeHref } from '../../slot-types'
import { useReducedMotion } from '../../use-reduced-motion'

type SpotlightHeroProps = {
  heading: string
  text: string
  primary: Link
  secondary: Link
}

const DOT_BACKDROP =
  'radial-gradient(circle,color-mix(in_oklab,var(--color-ink)_14%,transparent) 1px,transparent 1px)'
/** Where the glow sits before motion takes over (and in the server HTML). */
const REST = { left: '45%', top: '40%' } as const
const STATIC_GLOW =
  'radial-gradient(circle,color-mix(in_oklab,var(--color-brand)_32%,transparent),transparent 70%)'

// Pattern after Aceternity UI's Spotlight (our own implementation): a soft glow that follows the
// pointer on desktop and drifts slowly when there is no pointer to follow.
export default function SpotlightHero({ heading, text, primary, secondary }: SpotlightHeroProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const glow = useRef<HTMLDivElement>(null)
  // Drift while nothing is pointing, glide after the pointer when something is. Motion
  // is fetched after hydration; until it lands the glow rests where the server drew it.
  useEffect(() => {
    const el = glow.current
    if (!el || reducedMotion) return
    let live = true
    let run: { stop(): void } | undefined
    loadMotion()
      .then(({ animate }) => {
        if (!live) return
        run = pointer
          ? animate(el, { left: `${pointer.x}%`, top: `${pointer.y}%` }, { duration: 0.2 })
          : animate(
              el,
              { left: ['30%', '68%', '42%', '30%'], top: ['35%', '55%', '28%', '35%'] },
              { duration: 16, repeat: Infinity, ease: 'easeInOut' },
            )
      })
      .catch(() => {})
    return () => {
      live = false
      run?.stop()
    }
  }, [pointer, reducedMotion])

  // Event handlers
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion) return
    const rect = event.currentTarget.getBoundingClientRect()
    setPointer({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    })
  }
  const handlePointerLeave = () => setPointer(null)

  return (
    <div
      className="relative isolate flex min-h-[28rem] flex-col items-center justify-center overflow-hidden px-[1rem] py-[4rem] text-center"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ backgroundImage: DOT_BACKDROP, backgroundSize: '1.5rem 1.5rem' }}
      />
      {reducedMotion ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: STATIC_GLOW }}
        />
      ) : (
        <div
          ref={glow}
          aria-hidden
          className="pointer-events-none absolute size-[32rem] rounded-full blur-3xl"
          // The resting spot only: after hydration motion owns left/top, and a constant
          // here means React never writes over a glide in progress.
          style={{
            left: REST.left,
            top: REST.top,
            transform: 'translateX(-50%) translateY(-50%)',
            background: STATIC_GLOW,
          }}
        />
      )}
      <div className="page-width relative flex flex-col items-center gap-[1.25rem]">
        <h1 className="h1 text-[var(--color-ink)]">{heading}</h1>
        {text ? <p className="text-body max-w-[36rem] text-[var(--color-muted)]">{text}</p> : null}
        <div className="flex flex-wrap items-center justify-center gap-[0.75rem]">
          {primary?.label ? (
            <a
              className="btn btn--primary"
              href={safeHref(primary.href) ?? '#'}
              {...linkTarget(primary)}
            >
              {primary.label}
            </a>
          ) : null}
          {secondary?.label ? (
            <a
              className="btn btn--secondary"
              href={safeHref(secondary.href) ?? '#'}
              {...linkTarget(secondary)}
            >
              {secondary.label}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
