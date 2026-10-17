'use client'

import { cn } from '@commerce/ui/lib/utils'
import { type ReactNode, useEffect, useRef } from 'react'
import { isCoarsePointer, prefersReducedMotion } from '@/lib/gsap'

type MagneticProps = {
  children: ReactNode
  /** How far the child follows the pointer, as a share of the offset from its centre. */
  strength?: number
  className?: string
}

/** Pulls its child a little toward the pointer while it is near, and eases back on leave. */
export default function Magnetic({ children, strength = 0.28, className }: MagneticProps) {
  // Hooks
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || isCoarsePointer() || prefersReducedMotion()) return
    let frame = 0
    const move = (event: PointerEvent) => {
      const box = element.getBoundingClientRect()
      const dx = event.clientX - (box.left + box.width / 2)
      const dy = event.clientY - (box.top + box.height / 2)
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        element.style.translate = `${dx * strength}px ${dy * strength}px`
      })
    }
    const leave = () => {
      cancelAnimationFrame(frame)
      element.style.translate = '0 0'
    }
    element.addEventListener('pointermove', move)
    element.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(frame)
      element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerleave', leave)
    }
  }, [strength])

  return (
    <span
      ref={ref}
      className={cn(
        '-m-3 inline-flex p-3 transition-[translate] duration-300 ease-(--ease-out) motion-reduce:transition-none',
        className,
      )}
    >
      {children}
    </span>
  )
}
