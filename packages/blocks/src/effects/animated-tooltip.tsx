'use client'

// Adapted from Aceternity UI Animated Tooltip (Aceternity UI licence, free component; builder
// use permitted by the owner, see docs/licences/aceternity-pro.md), https://ui.aceternity.com/components/animated-tooltip.
// Same behaviour: overlapping avatars; the hovered one lifts and shows a card that swings with
// the pointer (rotate and shift follow the pointer's offset from the avatar's centre). Changes:
// CSS transitions with a springy curve replace Motion's springs (no animation library on the
// page), the card also opens on keyboard focus, avatars without a photo show initials on a hue
// (Zero Drift's reviewer avatars), theme colours and rem sizes, and nothing swings under reduced motion.
import { type CSSProperties, type MouseEvent, type ReactNode, useState } from 'react'
import Picture from '../components/picture'
import { cx } from '../slot-types'
import { useReducedMotion } from '../use-reduced-motion'

export type TooltipPerson = {
  id: string
  name: ReactNode
  designation: ReactNode
  /** Photo URL; without one the avatar shows `initials` on `hue`. */
  image?: string | undefined
  initials?: string | undefined
  /** 0 to 360, the avatar's background hue when there is no photo. */
  hue?: number | undefined
}

type AnimatedTooltipProps = {
  items: TooltipPerson[]
  /** A trailing chip such as "+120", drawn like an avatar without a card. */
  more?: ReactNode
  className?: string | undefined
}

/** The original maps a pointer offset of -100..100px to -45..45 degrees and a -50..50px (3.125rem) shift. */
const MAX_OFFSET = 100
const MAX_ROTATE = 45
const MAX_SHIFT_REM = 3.125
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

const clamp = (n: number) => Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, n)) / MAX_OFFSET

function swing(offset: number): CSSProperties {
  const k = clamp(offset)
  return {
    rotate: `${k * MAX_ROTATE}deg`,
    translate: `calc(-50% + ${k * MAX_SHIFT_REM}rem) 0`,
    transitionTimingFunction: SPRING,
  }
}

export default function AnimatedTooltip({ items, more, className }: AnimatedTooltipProps) {
  // Hooks
  const reduce = useReducedMotion()
  const [offset, setOffset] = useState(0)

  // Event handlers
  const handleMouseMove = (event: MouseEvent<HTMLElement>) => {
    if (reduce) return
    const box = event.currentTarget.getBoundingClientRect()
    setOffset(event.clientX - box.left - box.width / 2)
  }
  const handleMouseLeave = () => setOffset(0)

  return (
    <div className={cx('flex items-center justify-center', className)}>
      {items.map((item) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: the swing is decorative; the card's text is in the page and opens on focus too.
        <span
          key={item.id}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users open the same card hover shows.
          tabIndex={0}
          className="group relative -mr-[0.5rem] outline-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <span
            className="pointer-events-none absolute bottom-[calc(100%+0.625rem)] left-1/2 z-50 transition-[translate,rotate] duration-300"
            style={swing(offset)}
          >
            <span
              className={cx(
                'flex scale-[0.6] flex-col items-center whitespace-nowrap rounded-[0.375rem] bg-[var(--color-ink)] px-[1rem] py-[0.5rem] text-center text-[var(--color-bg)] opacity-0 shadow-xl',
                'relative translate-y-[1.25rem] transition-[opacity,scale,translate] duration-300',
                'group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100',
                'group-focus-visible:translate-y-0 group-focus-visible:scale-100 group-focus-visible:opacity-100',
              )}
              style={{ transitionTimingFunction: SPRING }}
            >
              <span className="absolute inset-x-[2.5rem] -bottom-px h-px w-1/5 bg-linear-to-r from-transparent via-[var(--color-accent)] to-transparent" />
              <span className="absolute -bottom-px left-[2.5rem] h-px w-2/5 bg-linear-to-r from-transparent via-[var(--color-brand)] to-transparent" />
              <span className="relative text-[0.8125rem] font-bold">{item.name}</span>
              <span className="text-[0.75rem]">{item.designation}</span>
            </span>
          </span>
          {item.image ? (
            <Picture
              image={{ url: item.image, alt: '' }}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              sizes="2.5rem"
              className="relative size-[2.5rem] rounded-full border-2 border-[var(--color-bg)] object-cover object-top transition duration-500 group-hover:z-30 group-hover:scale-105"
            />
          ) : (
            <span
              aria-hidden="true"
              className="relative grid size-[2.5rem] place-items-center rounded-full border-2 border-[var(--color-bg)] bg-[hsl(var(--hue)_45%_45%)] text-[0.875rem] font-bold text-[var(--color-on-brand)] transition duration-500 group-hover:z-30 group-hover:scale-105"
              style={{ '--hue': item.hue ?? 270 } as CSSProperties}
            >
              {item.initials}
            </span>
          )}
        </span>
      ))}
      {more ? (
        <span className="relative grid size-[2.5rem] place-items-center rounded-full border-2 border-[var(--color-bg)] bg-[color-mix(in_srgb,var(--color-ink)_18%,var(--color-bg))] text-[0.75rem] font-bold text-[var(--color-ink)]">
          {more}
        </span>
      ) : null}
    </div>
  )
}
