'use client'

import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { COUNT_UP_MS, EASE_OUT } from '@/lib/motion'

type CountUpProps = {
  /** The final, already formatted value, e.g. "₹2.7L", "1,240", "28". */
  value: string
  className?: string
}

type Parsed = { prefix: string; number: number; decimals: number; grouped: boolean; suffix: string }

const grouper = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/** Splits "₹2.7L" into prefix "₹", 2.7, one decimal, suffix "L"; null when there is no number. */
function parseValue(value: string): Parsed | null {
  const m = value.match(/^([^\d]*)(\d[\d,]*)(?:\.(\d+))?(.*)$/)
  if (!m) return null
  const [, prefix = '', whole = '', frac, suffix = ''] = m
  const number = Number(`${whole.replaceAll(',', '')}${frac ? `.${frac}` : ''}`)
  if (!Number.isFinite(number)) return null
  return { prefix, number, decimals: frac?.length ?? 0, grouped: whole.includes(','), suffix }
}

function formatFrame(parsed: Parsed, n: number): string {
  const whole = Math.floor(n)
  const wholeText = parsed.grouped ? grouper.format(whole) : String(whole)
  const fracText = parsed.decimals > 0 ? `.${(n - whole).toFixed(parsed.decimals).slice(2)}` : ''
  return `${parsed.prefix}${wholeText}${fracText}${parsed.suffix}`
}

/** Counts a stat from 0 to its value on first paint, then shows the exact formatted string. */
export default function CountUp({ value, className }: CountUpProps) {
  // Hooks
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(value)
  useEffect(() => {
    const parsed = parseValue(value)
    if (reduced || !parsed || parsed.number === 0) {
      setShown(value)
      return
    }
    const controls = animate(0, parsed.number, {
      duration: COUNT_UP_MS / 1000,
      ease: EASE_OUT,
      onUpdate: (n) => setShown(formatFrame(parsed, n)),
      onComplete: () => setShown(value),
    })
    return () => controls.stop()
  }, [value, reduced])

  // Render logic
  return (
    <span className={className} data-value={value}>
      {shown}
    </span>
  )
}
