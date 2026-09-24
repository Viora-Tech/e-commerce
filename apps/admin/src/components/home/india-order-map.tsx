'use client'

import type { DashboardSummary } from '@commerce/api'
import { motion, useReducedMotion } from 'motion/react'
import DataCard from '@/components/layout/data-card'
import { homeContent } from '@/data/home'
import { INDIAN_STATE_POSITIONS } from '@/data/india'

type IndiaOrderMapProps = {
  orders: DashboardSummary['mapOrders']
}

type StateDot = { stateCode: string; x: number; y: number; count: number }

/** One dot per state that has a recent order, sized by how many. */
function buildDots(orders: IndiaOrderMapProps['orders']): StateDot[] {
  const counts = new Map<string, number>()
  for (const o of orders) counts.set(o.stateCode, (counts.get(o.stateCode) ?? 0) + 1)
  const dots: StateDot[] = []
  for (const [stateCode, count] of counts) {
    const pos = INDIAN_STATE_POSITIONS[stateCode]
    if (pos) dots.push({ stateCode, x: pos.x, y: pos.y, count })
  }
  return dots
}

/** Radius in viewBox units, largest dot at 3.4, smallest at 1.6. */
function radiusFor(count: number, max: number): number {
  if (max <= 1) return 2.2
  return 1.6 + (count / max) * 1.8
}

/**
 * A light, original state grid (not a traced map, see data/india.ts) with a pulsing
 * dot per state that has a recent order. Bigger dot, more orders from that state.
 */
export default function IndiaOrderMap({ orders }: IndiaOrderMapProps) {
  // Hooks
  const reduced = useReducedMotion()

  // Render logic
  const c = homeContent.map
  const dots = buildDots(orders)
  const maxCount = dots.reduce((n, d) => Math.max(n, d.count), 1)

  return (
    <DataCard title={c.title} meta={c.subtitle(orders.length)}>
      {dots.length === 0 ? (
        <p className="text-body text-muted-foreground">{c.empty}</p>
      ) : (
        <svg viewBox="0 0 100 82" className="h-56 w-full" role="img" aria-label={c.title}>
          {dots.map((d) => {
            const r = radiusFor(d.count, maxCount)
            return (
              <g key={d.stateCode} transform={`translate(${d.x} ${d.y})`}>
                {!reduced ? (
                  <motion.circle
                    r={r}
                    className="fill-primary/25"
                    animate={{ scale: [1, 1.9, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{
                      duration: 2.2,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: 'easeOut',
                    }}
                  />
                ) : null}
                <circle r={r} className="fill-primary" />
              </g>
            )
          })}
        </svg>
      )}
    </DataCard>
  )
}
