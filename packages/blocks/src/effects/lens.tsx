'use client'

// Adapted from Aceternity UI Lens (Aceternity UI licence, free component; builder use permitted
// by the owner, see docs/licences/aceternity-pro.md), https://ui.aceternity.com/components/lens.
// Same technique as the original: a second copy of the media, scaled by `zoomFactor` around
// the pointer and masked to a circle. Changes: pointer events instead of mouse events, the
// Zero Drift guards (only with a fine pointer and hover, from 990px up, as the theme's lens zoom
// did), the copy is aria-hidden and inert, a CSS fade replaces Motion's AnimatePresence (so
// the product page loads no animation library), a ring in the theme's colours marks the lens,
// and sizes are rem. The static `position` mode was dropped: the product gallery never uses it.
import { type CSSProperties, type PointerEvent, type ReactNode, useState } from 'react'
import { remToPx } from '../data/motion'
import { cx } from '../slot-types'

type LensProps = {
  children: ReactNode
  zoomFactor?: number | undefined
  /** Diameter of the lens. */
  lensSizeRem?: number | undefined
  className?: string | undefined
}

/** Where the lens is, in px inside the box; null while the pointer is away. */
type Spot = { x: number; y: number } | null

/** Zero Drift's lens zoom ran only on desktop layouts with a real pointer. */
const LENS_MEDIA = '(hover: hover) and (pointer: fine) and (min-width: 990px)'

function lensStyle(spot: { x: number; y: number }, radiusPx: number): CSSProperties {
  const mask = `radial-gradient(circle ${radiusPx}px at ${spot.x}px ${spot.y}px, black 100%, transparent 100%)`
  return { maskImage: mask, WebkitMaskImage: mask }
}

export default function Lens({
  children,
  zoomFactor = 2.4,
  lensSizeRem = 8.75,
  className,
}: LensProps) {
  // Hooks
  const [spot, setSpot] = useState<Spot>(null)
  const [radius, setRadius] = useState(0)

  // Event handlers
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || !window.matchMedia(LENS_MEDIA).matches) {
      if (spot) setSpot(null)
      return
    }
    const box = event.currentTarget.getBoundingClientRect()
    if (!radius) setRadius(remToPx(lensSizeRem) / 2)
    setSpot({ x: event.clientX - box.left, y: event.clientY - box.top })
  }
  const handlePointerLeave = () => setSpot(null)

  // Render logic
  const origin = spot ? `${spot.x}px ${spot.y}px` : undefined

  return (
    <div
      className={cx('relative overflow-hidden', className)}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {children}
      {spot && radius ? (
        <div
          aria-hidden="true"
          inert
          className="pointer-events-none absolute inset-0 z-[5] overflow-hidden bg-[var(--color-bg)] animate-[fade-in_0.3s_ease-out_both]"
          style={lensStyle(spot, radius)}
        >
          <div
            className="absolute inset-0"
            style={{ transform: `scale(${zoomFactor})`, transformOrigin: origin }}
          >
            {children}
          </div>
          <span
            className="absolute rounded-full border-2 border-[var(--color-bg)] shadow-[0_0.875rem_2.125rem_rgb(0_0_0/0.35)]"
            style={{
              left: spot.x - radius,
              top: spot.y - radius,
              width: radius * 2,
              height: radius * 2,
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
