'use client'

import { useEffect, useRef, useState } from 'react'

type CountUpProps = {
  value: number
  /** Rupee amounts get the ₹ sign and Indian digit grouping. */
  currency?: boolean
  durationMs?: number
}

/** Counts from zero to `value` once the number scrolls into view; static with reduced motion. */
export default function CountUp({ value, currency = false, durationMs = 1200 }: CountUpProps) {
  // Hooks
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)
  const [started, setStarted] = useState(false)
  const fromRef = useRef(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setStarted(true)
        observer.disconnect()
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    const begin = performance.now()
    const from = fromRef.current
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - begin) / durationMs)
      const next = Math.round(from + (value - from) * (1 - (1 - t) ** 3))
      fromRef.current = next
      setShown(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [started, value, durationMs])

  return (
    <span ref={ref} className="tabular-nums">
      {currency ? `₹${shown.toLocaleString('en-IN')}` : shown.toLocaleString('en-IN')}
    </span>
  )
}
