'use client'

import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/gsap'

type CountUpProps = {
  value: number
  /** Rupee amounts get the ₹ sign and Indian digit grouping. */
  currency?: boolean
  durationMs?: number
}

function format(amount: number, currency: boolean): string {
  const text = amount.toLocaleString('en-IN')
  return currency ? `₹${text}` : text
}

/**
 * Counts to `value` once the number scrolls into view, and tweens again when `value` changes. The
 * digits are written straight to the text node from a rAF loop: no React state per frame. With reduced
 * motion the number just shows.
 */
export default function CountUp({ value, currency = false, durationMs = 1200 }: CountUpProps) {
  // Hooks
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef(0)
  const visible = useRef(false)
  const frame = useRef(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (prefersReducedMotion()) {
      shown.current = value
      element.textContent = format(value, currency)
      return
    }
    const run = () => {
      cancelAnimationFrame(frame.current)
      const from = shown.current
      const begin = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - begin) / durationMs)
        shown.current = Math.round(from + (value - from) * (1 - (1 - t) ** 3))
        element.textContent = format(shown.current, currency)
        if (t < 1) frame.current = requestAnimationFrame(tick)
      }
      frame.current = requestAnimationFrame(tick)
    }
    if (visible.current) {
      run()
      return () => cancelAnimationFrame(frame.current)
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      visible.current = true
      observer.disconnect()
      run()
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame.current)
    }
  }, [value, currency, durationMs])

  return (
    <span ref={ref} className="tabular-nums">
      {format(value, currency)}
    </span>
  )
}
