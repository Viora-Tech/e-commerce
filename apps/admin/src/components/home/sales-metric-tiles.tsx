'use client'

import { ArrowDown, ArrowUp } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import { useId } from 'react'
import CountUp from '@/components/layout/count-up'
import { instant, pill } from '@/lib/motion'

/** Figma "Analytics · Metric tab" (580:739): 13/20 medium label with a dotted underline. */
const LABEL =
  'text-[0.8125rem] leading-5 font-medium text-muted-foreground underline decoration-dotted underline-offset-4'
/** 24/29 semibold, -0.48px tracking. */
const VALUE =
  'text-2xl leading-[1.8125rem] font-semibold tracking-[-0.03rem] whitespace-nowrap text-ink-strong tabular-nums'

type SalesMetricTilesProps = {
  salesDisplay: string
  salesSpark: number[]
  salesChange: number | null
  ordersDisplay: string
  ordersSpark: number[]
  ordersChange: number | null
  visitorsDisplay: string
  visitorsSpark: number[]
  visitorsChange: number | null
  conversionDisplay: string
  conversionSpark: number[]
  /** Change in percentage points, one decimal. */
  conversionChange: number | null
  comparedTo: string
  totalSales: string
  ordersTitle: string
  visitorsTitle: string
  conversionTitle: string
  /** Unit for the conversion change ("pts"). */
  points: string
  metric: 'sales' | 'orders'
  onSelect: (metric: 'sales' | 'orders') => void
}

/**
 * The hero's metric tiles (Figma 583:1865): Total sales and Orders are selectable (the chart
 * follows the pick; the selected tile is raised); Visitors and Conversion rate are read-only
 * tiles with their own sparkline and change line. Figures count up;
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
  visitorsChange,
  conversionDisplay,
  conversionSpark,
  conversionChange,
  comparedTo,
  totalSales,
  ordersTitle,
  visitorsTitle,
  conversionTitle,
  points,
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
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
      <StaticTile
        label={visitorsTitle}
        display={visitorsDisplay}
        spark={visitorsSpark}
        change={visitorsChange}
        unit="%"
        comparedTo={comparedTo}
      />
      <StaticTile
        label={conversionTitle}
        display={conversionDisplay}
        spark={conversionSpark}
        change={conversionChange}
        unit={` ${points}`}
        comparedTo={comparedTo}
      />
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
        'relative isolate flex flex-col gap-1 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-border' : 'border-transparent hover:border-border',
      )}
    >
      {selected ? (
        <motion.span
          layoutId={markerId}
          transition={slide}
          className="absolute inset-0 -z-10 rounded-lg bg-card shadow-lift"
          aria-hidden
        />
      ) : null}
      <span className={cn(LABEL, selected && 'text-foreground')}>{label}</span>
      <span className="flex items-center gap-2.5">
        <span className={VALUE}>
          <CountUp value={display} />
        </span>
        <Sparkline values={spark} dim={!selected} />
      </span>
      <MetricDelta change={change} comparedTo={comparedTo} />
    </button>
  )
}

type StaticTileProps = {
  label: string
  display: string
  spark: number[]
  change: number | null
  unit: string
  comparedTo: string
}

/** A read-only tile (Visitors, Conversion rate): same look as an unselected metric tile. */
function StaticTile({ label, display, spark, change, unit, comparedTo }: StaticTileProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-transparent px-4 py-3">
      <span className={LABEL}>{label}</span>
      <span className="flex items-center gap-2.5">
        <span className={VALUE}>
          <CountUp value={display} />
        </span>
        <Sparkline values={spark} dim />
      </span>
      <MetricDelta change={change} comparedTo={comparedTo} unit={unit} />
    </div>
  )
}

type MetricDeltaProps = {
  change: number | null
  comparedTo: string
  /** Suffix after the number: "%" for relative change, " pts" for conversion points. */
  unit?: string
}

function MetricDelta({ change, comparedTo, unit = '%' }: MetricDeltaProps) {
  if (change === null) return null
  const up = change >= 0
  return (
    <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      <span
        className={cn(
          'inline-flex items-center gap-1 font-semibold',
          up ? 'text-foreground' : 'text-danger',
        )}
      >
        {up ? (
          <ArrowUp className="size-3" aria-hidden="true" />
        ) : (
          <ArrowDown className="size-3" aria-hidden="true" />
        )}
        {Math.abs(change)}
        {unit}
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
  const width = 56
  const height = 20
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
        'ms-auto h-5 w-14 shrink-0 text-muted-foreground transition-opacity duration-200',
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
