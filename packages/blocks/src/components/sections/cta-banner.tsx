'use client'

// Adapted from Magic UI's Shine Border (MIT). See THIRD_PARTY_NOTICES.md and
// packages/blocks/THIRD_PARTY_LICENSES.md.
import { motion, useReducedMotion } from 'motion/react'
import type { Link } from '../../sections/framed'

type CtaBannerProps = {
  heading: string
  text: string
  button: Link
  secondaryButton: Link
}

const GLOW_GRADIENT =
  'conic-gradient(from 0deg,var(--color-brand),var(--color-accent),var(--color-brand))'

// Rounded card with an animated glow behind it. Reduced motion renders the glow as a static ring.
export default function CtaBanner({ heading, text, button, secondaryButton }: CtaBannerProps) {
  // Hooks
  const reducedMotion = useReducedMotion()

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
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-[var(--radius-card)]"
            style={{ backgroundImage: GLOW_GRADIENT }}
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          />
        )}
        <div className="relative flex flex-col items-center gap-[1rem] rounded-[calc(var(--radius-card)-2px)] bg-[var(--color-surface)] px-[2rem] py-[3rem] text-center">
          {heading ? <h2 className="h2 text-[var(--color-ink)]">{heading}</h2> : null}
          {text ? <p className="text-body text-[var(--color-muted)]">{text}</p> : null}
          <div className="flex flex-wrap items-center justify-center gap-[0.75rem]">
            {button?.label ? (
              <a className="btn btn--primary" href={button.href || '#'}>
                {button.label}
              </a>
            ) : null}
            {secondaryButton?.label ? (
              <a className="btn btn--secondary" href={secondaryButton.href || '#'}>
                {secondaryButton.label}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
