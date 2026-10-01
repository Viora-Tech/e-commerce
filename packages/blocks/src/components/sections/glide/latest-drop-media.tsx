'use client'

import { type PointerEvent, type ReactNode, useRef } from 'react'
import { useReducedMotion } from '../../../use-reduced-motion'

type LatestDropMediaProps = { children: ReactNode }

/** Degrees the panel leans at its edges (Glide's aceternity-extras.js, "3D tilt"). */
const TILT_DEGREES = 12

// Port of the [data-tilt] behaviour in assets/aceternity-extras.js: the image well leans toward
// the pointer on devices with a fine pointer and hover. The resting state is plain markup.
export default function LatestDropMedia({ children }: LatestDropMediaProps) {
  // Hooks
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  // Event handlers
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el || reduce || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const box = el.getBoundingClientRect()
    const px = (event.clientX - box.left) / box.width - 0.5
    const py = (event.clientY - box.top) / box.height - 0.5
    el.style.transform = `rotateY(${px * TILT_DEGREES}deg) rotateX(${-py * TILT_DEGREES}deg)`
  }
  const handlePointerLeave = () => {
    if (ref.current) ref.current.style.transform = ''
  }

  return (
    <div className="latest-drop__media-wrap">
      <div
        ref={ref}
        className="latest-drop__media"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {children}
      </div>
    </div>
  )
}
