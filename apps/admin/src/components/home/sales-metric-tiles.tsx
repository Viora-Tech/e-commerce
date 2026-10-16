'use client'

import { ArrowDown, ArrowUp } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import { useId } from 'react'
import CountUp from '@/components/layout/count-up'
import { instant, pill } from '@/lib/motion'

type SalesMetricTilesProps = {
  salesDisplay: string
  salesSpark: number[]
  salesChange: number | null
  ordersDisplay: string
  ordersSpark: number[]
  ordersChange: number | null
  visitorsDisplay: string
  visitorsSpark: number[]
  comparedTo: string
  totalSales: string
  ordersTitle: string
  visitorsTitle: string
  visitorsNow: string
  metric: 'sales' | 'orders'
  onSelect: (metric: 'sales' | 'orders') => void
}

/**
 * The hero's metric tiles: Total sales and Orders are selectable (the chart follows the
 * pick; the selected tile is raised), Visitors shows the live count with its own sparkline.
 * Conversion has no daily data source, so it stays out until one exists. Figures count up;
 * only the picked tile's sparkline is full colour; the highlight slides between tiles.
 */
export default function SalesMetricTiles({
  salesDisplay,
  salesSpark,
  salesChange,
  ordersDisplay,
  ordersSpark,
  ordersChange,
  visitorsDisplay,
  visitorsSpark,
  comparedTo,
  totalSales,
  ordersTitle,
  visitorsTitle,
  visitorsNow,
  metric,
  onSelect,
}: SalesMetricTilesProps) {
  // Hooks
  const reduced = useReducedMotion()
  const group = useId()

  // Event handlers
  const handleSales = () => {
    onSelect('sales')
  }

  const handleOrders = () => {
    onSelect('orders')
  }

  // Render logic
  const slide = reduced ? instant : pill

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <MetricTile
        label={totalSales}
        display={salesDisplay}
        spark={salesSpark}
        change={salesChange}
        comparedTo={comparedTo}
        selected={metric === 'sales'}
        markerId={`${group}-marker`}
        slide={slide}
        onSelect={handleSales}
      />
      <MetricTile
        label={ordersTitle}
        display={ordersDisplay}
        spark={ordersSpark}
        change={ordersChange}
        comparedTo={comparedTo}
        selected={metric === 'orders'}
        markerId={`${group}-marker`}
        slide={slide}
        onSelect={handleOrders}
      />
      <div className="flex flex-col gap-1 rounded-xl border border-transparent p-4">
        <span className="flex items-start justify-between gap-2">
          <span className="text-body text-muted-foreground">{visitorsTitle}</span>
          <Sparkline values={visitorsSpark} dim={false} />
        </span>
        <span className="text-[1.75rem] leading-[2rem] font-semibold text-ink-strong tabular-nums">
          <CountUp value={visitorsDisplay} />
        </span>
        <span className="text-caption text-muted-foreground">{visitorsNow}</span>
      </div>
    </div>
  )
}

type MetricTileProps = {
  label: string
  display: string
  spark: number[]
  change: number | null
  comparedTo: string
  selected: boolean
  markerId: string
  slide: typeof pill
  onSelect: () => void
}

function MetricTile({
  label,
  display,
  spark,
  change,
  comparedTo,
  selected,
  markerId,
  slide,
  onSelect,
}: MetricTileProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'relative isolate flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-border' : 'border-transparent hover:border-border',
      )}
    >
      {selected ? (
        <motion.span
          layoutId={markerId}
          transition={slide}
          className="absolute inset-0 -z-10 rounded-xl bg-card shadow-lift"
          aria-hidden
        />
      ) : null}
      <span className="flex items-start justify-between gap-2">
        <span className="text-body text-muted-foreground">{label}</span>
        <Sparkline values={spark} dim={!selected} />
      </span>
      <span className="text-[1.75rem] leading-[2rem] font-semibold text-ink-strong tabular-nums">
        <CountUp value={display} />
      </span>
      <MetricDelta change={change} comparedTo={comparedTo} />
    </button>
  )
}

type MetricDeltaProps = {
  change: number | null
  comparedTo: string
}

function MetricDelta({ change, comparedTo }: MetricDeltaProps) {
  if (change === null) return null
  const up = change >= 0
  return (
    <span className="flex flex-wrap items-center gap-1 text-caption text-muted-foreground">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 font-semibold',
          up ? 'text-success' : 'text-danger',
        )}
      >
        {up ? (
          <ArrowUp className="size-3" aria-hidden="true" />
        ) : (
          <ArrowDown className="size-3" aria-hidden="true" />
        )}
        {Math.abs(change)}%
      </span>
      {comparedTo}
    </span>
  )
}

type SparklineProps = {
  values: number[]
  /** Only the picked metric reads full colour; the rest sit back. */
  dim: boolean
}

/** A tiny trend line for a metric tile: theme-muted, no axes, flat when there is no data. */
function Sparkline({ values, dim }: SparklineProps) {
  const width = 96
  const height = 32
  const max = Math.max(...values, 0)
  const step = values.length > 1 ? width / (values.length - 1) : 0
  const points = values
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(height - 3 - (max > 0 ? (v / max) * (height - 6) : 0)).toFixed(1)}`,
    )
    .join(' ')
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn(
        'h-8 w-24 shrink-0 text-muted-foreground transition-opacity duration-200',
        dim && 'opacity-30',
      )}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
