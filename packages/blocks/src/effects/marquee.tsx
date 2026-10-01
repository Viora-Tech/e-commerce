'use client'

// Adapted from Magic UI Marquee (MIT), https://magicui.design/docs/components/marquee.
// See THIRD_PARTY_NOTICES.md and packages/blocks/THIRD_PARTY_LICENSES.md.
// Changes: rem sizes and props instead of Tailwind config tokens, the repeated copies are
// aria-hidden and inert (screen readers and keyboards meet the content once), and under
// reduced motion nothing moves and only one copy is drawn (the caller may let it scroll). Keyframes: `styles/effects.css`.
import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../slot-types'
import { useReducedMotion } from '../use-reduced-motion'

type MarqueeProps = {
  children: ReactNode
  /** Run right-to-left (or bottom-to-top when vertical) the other way. */
  reverse?: boolean | undefined
  pauseOnHover?: boolean | undefined
  vertical?: boolean | undefined
  /** How many copies of the content the track holds (at least 2 for a seamless loop). */
  repeat?: number | undefined
  /** Seconds one copy takes to pass. */
  durationSeconds?: number | undefined
  gapRem?: number | undefined
  className?: string | undefined
  /** Classes for each copy (the flex row or column holding `children`). */
  groupClassName?: string | undefined
}

export default function Marquee({
  children,
  reverse = false,
  pauseOnHover = false,
  vertical = false,
  repeat = 2,
  durationSeconds = 40,
  gapRem = 1,
  className,
  groupClassName,
}: MarqueeProps) {
  // Hooks
  const reduce = useReducedMotion()

  // Render logic
  const copies = reduce ? 1 : Math.max(1, Math.round(repeat))
  const style = {
    '--duration': `${Math.max(1, durationSeconds)}s`,
    '--gap': `${gapRem}rem`,
  } as CSSProperties
  const motion = reduce
    ? false
    : vertical
      ? 'animate-[marquee-vertical_var(--duration)_linear_infinite]'
      : 'animate-[marquee_var(--duration)_linear_infinite]'

  return (
    <div
      className={cx(
        'group flex gap-(--gap) overflow-hidden',
        vertical ? 'flex-col' : 'flex-row',
        className,
      )}
      style={style}
    >
      {Array.from({ length: copies }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: the copies are identical and fixed in number.
          key={i}
          aria-hidden={i > 0 || undefined}
          inert={i > 0 || undefined}
          className={cx(
            'flex shrink-0 justify-around gap-(--gap)',
            vertical ? 'flex-col' : 'flex-row',
            motion,
            pauseOnHover && 'group-hover:[animation-play-state:paused]',
            reverse && '[animation-direction:reverse]',
            groupClassName,
          )}
        >
          {children}
        </div>
      ))}
    </div>
  )
}
