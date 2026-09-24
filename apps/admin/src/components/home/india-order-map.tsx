'use client'

import type { DashboardSummary } from '@commerce/api'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import { homeContent } from '@/data/home'
import {
  INDIA_MAP_LOCATIONS,
  INDIA_MAP_VIEWBOX,
  MAP_ID_CENTER,
  STATE_CODE_TO_MAP_ID,
} from '@/data/india-map'
import { formatPaise } from '@/lib/money'

type IndiaOrderMapProps = {
  orders: DashboardSummary['mapOrders']
}

type MapStat = { orders: number; revenuePaise: number }

const LEGEND_STEPS = [0.18, 0.4, 0.62, 0.85, 1] as const

/** Orders and revenue per map path (our state codes folded onto the package's location ids). */
function buildStats(orders: IndiaOrderMapProps['orders']): Map<string, MapStat> {
  const stats = new Map<string, MapStat>()
  for (const o of orders) {
    const mapId = STATE_CODE_TO_MAP_ID[o.stateCode]
    if (!mapId) continue
    const prev = stats.get(mapId) ?? { orders: 0, revenuePaise: 0 }
    stats.set(mapId, { orders: prev.orders + 1, revenuePaise: prev.revenuePaise + o.totalPaise })
  }
  return stats
}

/** 0.18 (barely there) to 1 (the busiest state), so an empty state still reads as "on the map". */
function opacityFor(count: number, max: number): number {
  if (max <= 0 || count <= 0) return 0
  return 0.18 + (count / max) * 0.82
}

/** The path's plain-language name; J&K's path also carries Ladakh (see `data/india-map.ts`). */
function nameFor(mapId: string, fallback: string): string {
  return mapId === 'jk' ? homeContent.map.jkLaName : fallback
}

/**
 * The real India outline (`@svg-maps/india`, CC BY 4.0; see `data/india-map.ts`), shaded by
 * order count with pulsing dots over the busiest states. Hover or focus a state for its count
 * and revenue.
 */
export default function IndiaOrderMap({ orders }: IndiaOrderMapProps) {
  // Hooks
  const reduced = useReducedMotion()
  const [activeId, setActiveId] = useState<string | null>(null)

  // Render logic
  const c = homeContent.map
  const stats = buildStats(orders)
  const maxCount = Math.max(0, ...[...stats.values()].map((s) => s.orders))
  const active = activeId ? stats.get(activeId) : undefined
  const activeName = activeId
    ? nameFor(activeId, INDIA_MAP_LOCATIONS.find((l) => l.id === activeId)?.name ?? activeId)
    : null

  return (
    <DataCard title={c.title} meta={c.subtitle(orders.length)}>
      {orders.length === 0 ? (
        <p className="text-body text-muted-foreground">{c.empty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <svg
              viewBox={INDIA_MAP_VIEWBOX}
              className="h-72 w-full"
              role="img"
              aria-label={c.title}
            >
              <g>
                {INDIA_MAP_LOCATIONS.map((loc) => {
                  const stat = stats.get(loc.id)
                  const opacity = opacityFor(stat?.orders ?? 0, maxCount)
                  const label = nameFor(loc.id, loc.name)
                  const desc = stat
                    ? `${label}: ${c.tooltipOrders(stat.orders)}, ${formatPaise(stat.revenuePaise)}`
                    : label
                  return (
                    // biome-ignore lint/a11y/useSemanticElements: an SVG map region can't be a real <button>.
                    <g
                      key={loc.id}
                      role="button"
                      tabIndex={0}
                      aria-label={desc}
                      onMouseEnter={() => setActiveId(loc.id)}
                      onMouseLeave={() => setActiveId((cur) => (cur === loc.id ? null : cur))}
                      onFocus={() => setActiveId(loc.id)}
                      onBlur={() => setActiveId((cur) => (cur === loc.id ? null : cur))}
                      className="outline-none"
                    >
                      <path
                        d={loc.path}
                        className="stroke-border transition-opacity focus-visible:stroke-ring focus-visible:stroke-2"
                        style={{ fill: 'var(--chart-1)', fillOpacity: opacity || 0.06 }}
                        strokeWidth={0.6}
                      />
                    </g>
                  )
                })}
              </g>
              {[...stats.entries()].map(([mapId, stat]) => {
                const pos = MAP_ID_CENTER[mapId]
                if (!pos || stat.orders === 0) return null
                return (
                  <g key={mapId} transform={`translate(${pos.x} ${pos.y})`} aria-hidden>
                    {!reduced ? (
                      <motion.circle
                        r={6}
                        className="fill-primary/30"
                        animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{
                          duration: 2.2,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: 'easeOut',
                        }}
                      />
                    ) : null}
                    <circle r={4} className="fill-primary" />
                  </g>
                )
              })}
            </svg>
            {active && activeName ? (
              <div className="pointer-events-none absolute top-2 left-2 rounded-lg border border-border bg-popover px-3 py-2 text-caption shadow-lift">
                <p className="font-medium text-popover-foreground">{activeName}</p>
                <p className="text-muted-foreground">
                  {c.tooltipOrders(active.orders)} · {formatPaise(active.revenuePaise)}
                </p>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span>{c.legendLow}</span>
              <div className="flex items-center gap-0.5" aria-hidden>
                {LEGEND_STEPS.map((step) => (
                  <span
                    key={step}
                    className="size-3 rounded-sm"
                    style={{ backgroundColor: 'var(--chart-1)', opacity: step }}
                  />
                ))}
              </div>
              <span>{c.legendHigh}</span>
            </div>
            <span>{c.credit}</span>
          </div>
        </div>
      )}
    </DataCard>
  )
}
