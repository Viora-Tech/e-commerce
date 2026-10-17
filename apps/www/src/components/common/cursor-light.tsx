'use client'

import { useEffect, useRef } from 'react'
import { isCoarsePointer, prefersReducedMotion } from '@/lib/gsap'

const SIZE_REM = 44
const EASE = 0.12
const SETTLED_PX = 0.5

/**
 * A very soft grey light that trails the cursor. Transform only, written from a rAF loop that runs
 * only while the light is still catching up with the pointer, so it costs nothing at rest.
 */
export default function CursorLight() {
  // Hooks
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || isCoarsePointer() || prefersReducedMotion()) return
    const half =
      (SIZE_REM * Number.parseFloat(getComputedStyle(document.documentElement).fontSize)) / 2
    let targetX = 0
    let targetY = 0
    let x = 0
    let y = 0
    let frame = 0
    let started = false
    const loop = () => {
      x += (targetX - x) * EASE
      y += (targetY - y) * EASE
      element.style.transform = `translate3d(${x - half}px, ${y - half}px, 0)`
      frame =
        Math.abs(targetX - x) > SETTLED_PX || Math.abs(targetY - y) > SETTLED_PX
          ? requestAnimationFrame(loop)
          : 0
    }
    const move = (event: PointerEvent) => {
      targetX = event.clientX
      targetY = event.clientY
      if (!started) {
        started = true
        x = targetX
        y = targetY
      }
      element.style.opacity = '1'
      if (!frame) frame = requestAnimationFrame(loop)
    }
    const leave = () => {
      element.style.opacity = '0'
    }
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', leave)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-0 size-[44rem] rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.055),transparent)] opacity-0 transition-opacity duration-500 print:hidden"
    />
  )
}
