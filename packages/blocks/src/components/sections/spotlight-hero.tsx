'use client'

// Pattern after Aceternity UI's Spotlight (our own implementation, not copied code).
// See THIRD_PARTY_NOTICES.md.
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { focalStyle } from '../../focal-point'
import { loadMotion } from '../../lazy-motion'
import type { Image, Link } from '../../sections/framed'
import { useReducedMotion } from '../../use-reduced-motion'
import HeroCopy from '../hero-copy'
import Picture from '../picture'

/** Copy is a string in storage, a React node while edited on the canvas. */
type SpotlightHeroProps = {
  eyebrow?: ReactNode
  heading: ReactNode
  text: ReactNode
  primary: Link
  secondary: Link
  /** The product photo on a surface panel under the buttons; none hides the panel. */
  image?: Image | undefined
}

/** Where the glow sits before motion takes over (and in the server HTML). */
const REST = { left: '45%', top: '40%' } as const

// Figma Section / Spotlight hero (704:113606), pattern after Aceternity UI's Spotlight (our own
// implementation): centred copy under a soft brand glow that follows the pointer on desktop and
// drifts when there is none, then the product on a surface panel.
export default function SpotlightHero({
  eyebrow,
  heading,
  text,
  primary,
  secondary,
  image,
}: SpotlightHeroProps) {
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
      className="spotlight-hero"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {reducedMotion ? (
        <div aria-hidden className="spotlight-hero__glow spotlight-hero__glow--static" />
      ) : (
        <div
          ref={glow}
          aria-hidden
          className="spotlight-hero__glow"
          // The resting spot only: after hydration motion owns left/top, and a constant
          // here means React never writes over a glide in progress.
          style={{ left: REST.left, top: REST.top }}
        />
      )}
      <div className="spotlight-hero__inner page-width">
        <HeroCopy
          eyebrow={eyebrow}
          heading={heading}
          text={text}
          primary={primary}
          secondary={secondary}
          className="hero-copy--center"
        />
        {image?.url ? (
          <div className="spotlight-hero__media">
            <Picture
              image={image}
              alt={image.alt}
              className="spotlight-hero__image"
              style={focalStyle(image.focal)}
              fill
              sizes="(min-width: 990px) 880px, 100vw"
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
