'use client'

import { useEffect, useRef } from 'react'
import { isCoarsePointer, prefersReducedMotion } from '@/lib/gsap'

const SIZE_REM = 44

/** A very soft grey light that trails the cursor across the dark page. Transform only. */
export default function CursorLight() {
  // Hooks
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || isCoarsePointer() || prefersReducedMotion()) return
    const half =
      (SIZE_REM * Number.parseFloat(getComputedStyle(document.documentElement).fontSize)) / 2
    let targetX = -half * 2
    let targetY = -half * 2
    let x = targetX
    let y = targetY
    let frame = 0
    const loop = () => {
      x += (targetX - x) * 0.12
      y += (targetY - y) * 0.12
      element.style.transform = `translate3d(${x - half}px, ${y - half}px, 0)`
      frame = requestAnimationFrame(loop)
    }
    const move = (event: PointerEvent) => {
      targetX = event.clientX
      targetY = event.clientY
      element.style.opacity = '1'
    }
    const leave = () => {
      element.style.opacity = '0'
    }
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    frame = requestAnimationFrame(loop)
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
