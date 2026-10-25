'use client'

// Adapted from Aceternity UI 3D Card Effect (Aceternity UI licence, free component; builder use
// permitted by the owner, see docs/licences/aceternity-pro.md), https://ui.aceternity.com/components/3d-card-effect.
// The original's `CardContainer`: the card leans toward the pointer. Its `CardBody` is only a
// sized preserve-3d box (the caller's own markup is that), and its `CardItem` layers are left
// out until a section needs them (they only lift inside a card without `overflow: hidden`).
// Changes: pointer events with Zero Drift's guards (fine pointer with hover, never under reduced
// motion, as the theme's [data-tilt] had) and no forced padding or centring.
import { type PointerEvent, type ReactNode, useRef } from 'react'
import { cx } from '../slot-types'
import { useReducedMotion } from '../use-reduced-motion'

type Card3dContainerProps = {
  children: ReactNode
  /** Classes for the tilting element. */
  className?: string | undefined
  /** Classes for the outer box that holds the perspective. */
  containerClassName?: string | undefined
}

/** The original divides the pointer offset by 25: about 10 degrees at the edge of a 500px card. */
const TILT_DIVISOR = 25
const FINE_POINTER = '(hover: hover) and (pointer: fine)'

export default function Card3dContainer({
  children,
  className,
  containerClassName,
}: Card3dContainerProps) {
  // Hooks
  const reduce = useReducedMotion()
  const card = useRef<HTMLDivElement>(null)

  // Helpers
  const canTilt = () => !reduce && window.matchMedia(FINE_POINTER).matches

  // Event handlers
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const el = card.current
    if (!el || !canTilt()) return
    const { left, top, width, height } = el.getBoundingClientRect()
    const x = (event.clientX - left - width / 2) / TILT_DIVISOR
    const y = (event.clientY - top - height / 2) / TILT_DIVISOR
    el.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`
  }
  const handlePointerLeave = () => {
    if (card.current) card.current.style.transform = ''
  }

  return (
    <div className={cx('[perspective:62.5rem]', containerClassName)}>
      <div
        ref={card}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className={cx(
          'relative transition-transform duration-200 ease-linear [transform-style:preserve-3d]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
