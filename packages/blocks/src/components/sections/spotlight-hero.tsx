'use client'

// Pattern after Aceternity UI's Spotlight (our own implementation, not copied code).
// See THIRD_PARTY_NOTICES.md.
import { motion, useReducedMotion } from 'motion/react'
import { type PointerEvent, useState } from 'react'
import { linkTarget } from '../../link'
import type { Link } from '../../sections/framed'

type SpotlightHeroProps = {
  heading: string
  text: string
  primary: Link
  secondary: Link
}

const DOT_BACKDROP =
  'radial-gradient(circle,color-mix(in_oklab,var(--color-ink)_14%,transparent) 1px,transparent 1px)'
const STATIC_GLOW =
  'radial-gradient(circle,color-mix(in_oklab,var(--color-brand)_32%,transparent),transparent 70%)'

// Pattern after Aceternity UI's Spotlight (our own implementation): a soft glow that follows the
// pointer on desktop and drifts slowly when there is no pointer to follow.
export default function SpotlightHero({ heading, text, primary, secondary }: SpotlightHeroProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)

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

  // Render logic
  const drifting = !pointer && !reducedMotion
  const glowLeft = pointer ? `${pointer.x}%` : '45%'
  const glowTop = pointer ? `${pointer.y}%` : '40%'

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
        <motion.div
          aria-hidden
          className="pointer-events-none absolute size-[32rem] rounded-full blur-3xl"
          style={{
            left: glowLeft,
            top: glowTop,
            translateX: '-50%',
            translateY: '-50%',
            background: STATIC_GLOW,
          }}
          animate={
            drifting
              ? { left: ['30%', '68%', '42%', '30%'], top: ['35%', '55%', '28%', '35%'] }
              : { left: glowLeft, top: glowTop }
          }
          transition={
            drifting ? { duration: 16, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }
          }
        />
      )}
      <div className="page-width relative flex flex-col items-center gap-[1.25rem]">
        <h1 className="h1 text-[var(--color-ink)]">{heading}</h1>
        {text ? <p className="text-body max-w-[36rem] text-[var(--color-muted)]">{text}</p> : null}
        <div className="flex flex-wrap items-center justify-center gap-[0.75rem]">
          {primary?.label ? (
            <a className="btn btn--primary" href={primary.href || '#'} {...linkTarget(primary)}>
              {primary.label}
            </a>
          ) : null}
          {secondary?.label ? (
            <a
              className="btn btn--secondary"
              href={secondary.href || '#'}
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
