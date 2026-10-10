'use client'

// Adapted from Magic UI Magic Card (MIT), https://magicui.design/docs/components/magic-card.
// See THIRD_PARTY_NOTICES.md and packages/blocks/THIRD_PARTY_LICENSES.md.
// Changes: the "gradient" mode only, driven by two CSS custom properties set on pointer move
// (no motion values, no next-themes), theme colours (`--color-brand`, `--color-accent`,
// `--color-line`, `--color-surface`) so every scheme and dark mode follow, rem sizes, and the
// glow only answers a real mouse (the Tailwind `hover:` variant is mouse-only in this project).
import type { CSSProperties, PointerEvent, ReactNode } from 'react'
import { cx } from '../slot-types'

type MagicCardProps = {
  children: ReactNode
  className?: string | undefined
  /** Radius of the spotlight in rem. */
  sizeRem?: number | undefined
}

/** Where the light sits before the pointer arrives: off the card, so nothing glows. */
const OFF = '-20rem'

function track(event: PointerEvent<HTMLDivElement>) {
  const el = event.currentTarget
  const rect = el.getBoundingClientRect()
  el.style.setProperty('--magic-x', `${event.clientX - rect.left}px`)
  el.style.setProperty('--magic-y', `${event.clientY - rect.top}px`)
}

function reset(event: PointerEvent<HTMLDivElement>) {
  event.currentTarget.style.setProperty('--magic-x', OFF)
  event.currentTarget.style.setProperty('--magic-y', OFF)
}

/**
 * A card whose border lights up in the brand colours where the mouse is, with a soft glow
 * inside. Without a mouse it is a plain bordered card.
 */
export default function MagicCard({ children, className, sizeRem = 14 }: MagicCardProps) {
  // Render logic
  const style = {
    '--magic-x': OFF,
    '--magic-y': OFF,
    '--magic-size': `${sizeRem}rem`,
    background:
      'linear-gradient(var(--color-surface) 0 0) padding-box,radial-gradient(var(--magic-size) circle at var(--magic-x) var(--magic-y),var(--color-brand),var(--color-accent),var(--color-line) 100%) border-box',
  } as CSSProperties

  return (
    <div
      className={cx(
        'group/magic relative isolate overflow-hidden rounded-[var(--radius-card)] border border-transparent',
        className,
      )}
      style={style}
      onPointerMove={track}
      onPointerLeave={reset}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover/magic:opacity-100"
        style={{
          background:
            'radial-gradient(var(--magic-size) circle at var(--magic-x) var(--magic-y),color-mix(in oklab,var(--color-brand) 12%,transparent),transparent 100%)',
        }}
      />
      {children}
    </div>
  )
}
