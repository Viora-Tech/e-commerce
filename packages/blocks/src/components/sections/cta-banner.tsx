'use client'

// Adapted from Magic UI's Shine Border (MIT). See THIRD_PARTY_NOTICES.md and
// packages/blocks/THIRD_PARTY_LICENSES.md.
import { type ReactNode, useEffect, useRef } from 'react'
import { loadMotion } from '../../lazy-motion'
import { linkTarget } from '../../link'
import type { Link } from '../../sections/framed'
import { safeHref } from '../../slot-types'
import { useReducedMotion } from '../../use-reduced-motion'
import RichCopy from '../rich-copy'

/** Copy is a string in storage, a React node while edited on the canvas. */
type CtaBannerProps = {
  heading: ReactNode
  text: ReactNode
  button: Link
  secondaryButton: Link
}

const GLOW_GRADIENT =
  'conic-gradient(from 0deg,var(--color-brand),var(--color-accent),var(--color-brand))'

// Rounded card with an animated glow behind it. Reduced motion renders the glow as a static ring.
// The spin is added once motion loads after hydration; until then the ring sits still.
export default function CtaBanner({ heading, text, button, secondaryButton }: CtaBannerProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const glow = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = glow.current
    if (!el || reducedMotion) return
    let live = true
    let spin: { stop(): void } | undefined
    loadMotion()
      .then(({ animate }) => {
        if (live)
          spin = animate(el, { rotate: 360 }, { duration: 6, repeat: Infinity, ease: 'linear' })
      })
      .catch(() => {})
    return () => {
      live = false
      spin?.stop()
    }
  }, [reducedMotion])

  return (
    <div className="page-width flex justify-center">
      <div className="relative max-w-[48rem] rounded-[var(--radius-card)] p-[2px]">
        {reducedMotion ? (
          <div
            aria-hidden
            className="absolute inset-0 rounded-[var(--radius-card)] opacity-70"
            style={{ backgroundImage: GLOW_GRADIENT }}
          />
        ) : (
          <div
            ref={glow}
            aria-hidden
            className="absolute inset-0 rounded-[var(--radius-card)]"
            style={{ backgroundImage: GLOW_GRADIENT }}
          />
        )}
        <div className="relative flex flex-col items-center gap-[1rem] rounded-[calc(var(--radius-card)-2px)] bg-[var(--color-surface)] px-[2rem] py-[3rem] text-center">
          {heading ? <h2 className="h2 text-[var(--color-ink)]">{heading}</h2> : null}
          <RichCopy value={text} className="text-body text-[var(--color-muted)]" />
          <div className="flex flex-wrap items-center justify-center gap-[0.75rem]">
            {button?.label ? (
              <a
                className="btn btn--primary"
                href={safeHref(button.href) ?? '#'}
                {...linkTarget(button)}
              >
                {button.label}
              </a>
            ) : null}
            {secondaryButton?.label ? (
              <a
                className="btn btn--secondary"
                href={safeHref(secondaryButton.href) ?? '#'}
                {...linkTarget(secondaryButton)}
              >
                {secondaryButton.label}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
