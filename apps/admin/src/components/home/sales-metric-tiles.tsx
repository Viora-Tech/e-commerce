'use client'

import type { HomeMetric } from '@commerce/core/home-metrics'
import { ArrowDown, ArrowUp } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { motion, useReducedMotion } from 'motion/react'
import { useId, useState } from 'react'
import CountUp from '@/components/layout/count-up'
import { instant, pill } from '@/lib/motion'
import MetricPicker from './analytics/metric-picker'

/** Figma "Analytics · Metric tab" (580:739): 13/20 medium label with a dotted underline. */
const LABEL =
  'text-[0.8125rem] leading-5 font-medium text-muted-foreground underline decoration-dotted underline-offset-4'
/** 24/29 semibold, -0.48px tracking. */
const VALUE =
  'text-2xl leading-[1.8125rem] font-semibold tracking-[-0.03rem] whitespace-nowrap text-ink-strong tabular-nums'

export type MetricTileData = {
  metric: HomeMetric
  label: string
  display: string
  spark: number[]
  /** Percent (or points) change; null hides the change line (nothing to compare, or off). */
  change: number | null
  /** Suffix after the change: "%" or " pts". */
  unit: string
  /** A rise is bad news (refunds, discounts, abandoned carts). */
  lowerIsBetter?: boolean | undefined
  /** A quiet note in place of the change line (the best seller's name). */
  note?: string | undefined
}

type SalesMetricTilesProps = {
  tiles: MetricTileData[]
  comparedTo: string
  metric: HomeMetric
  onSelect: (metric: HomeMetric) => void
  /** Customize mode: a tile opens the metric picker for its slot instead of selecting. */
  customizing: boolean
  onSwap: (slot: number, metric: HomeMetric) => void
}

/**
 * The hero's metric tiles (Figma 583:1865): every tile is selectable and the chart follows the
 * pick; the selected tile is raised and the highlight slides between tiles. Figures count up;
 * only the picked tile's sparkline is full colour. While customizing, a tile opens Figma's
 * "Choose a metric for this slot" picker.
 */
export default function SalesMetricTiles({
  tiles,
  comparedTo,
  metric,
  onSelect,
  customizing,
  onSwap,
}: SalesMetricTilesProps) {
  // Hooks
  const reduced = useReducedMotion()
  const group = useId()
  const [picking, setPicking] = useState<number | null>(null)

  // Render logic
  const slide = reduced ? instant : pill

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile, slot) => {
        const body = (
          <MetricTile
            key={tile.metric}
            tile={tile}
            comparedTo={comparedTo}
            selected={!customizing && metric === tile.metric}
            customizing={customizing}
            markerId={`${group}-marker`}
            slide={slide}
            onSelect={() => onSelect(tile.metric)}
          />
        )
        return customizing ? (
          <Popover
            key={tile.metric}
            open={picking === slot}
            onOpenChange={(open) => setPicking(open ? slot : null)}
          >
            <PopoverTrigger nativeButton={false} render={<div className="grid" />}>
              {body}
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="w-auto p-0">
              <MetricPicker
                current={tile.metric}
                onPick={(m) => {
                  onSwap(slot, m)
                  setPicking(null)
                }}
                onClose={() => setPicking(null)}
              />
            </PopoverContent>
          </Popover>
        ) : (
          <div key={tile.metric} className="grid">
            {body}
          </div>
        )
      })}
    </div>
  )
}

type MetricTileProps = {
  tile: MetricTileData
  comparedTo: string
  selected: boolean
  customizing: boolean
  markerId: string
  slide: typeof pill
  onSelect: () => void
}

function MetricTile({
  tile,
  comparedTo,
  selected,
  customizing,
  markerId,
  slide,
  onSelect,
}: MetricTileProps) {
  return (
    <button
      type="button"
      aria-pressed={customizing ? undefined : selected}
      onClick={customizing ? undefined : onSelect}
      className={cn(
        'relative isolate flex flex-col gap-1 rounded-lg border px-4 py-3 text-left transition-[border-color,background-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        customizing
          ? 'border-dashed border-border-strong hover:bg-card/50'
          : selected
            ? 'border-border'
            : 'border-transparent hover:border-border hover:bg-card/40',
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
      <span className={cn(LABEL, selected && 'text-foreground')}>{tile.label}</span>
      <span className="flex items-center gap-2.5">
        <span className={VALUE}>
          <CountUp value={tile.display} />
        </span>
        <Sparkline values={tile.spark} dim={!selected} />
      </span>
      {tile.note ? (
        <span className="truncate text-xs text-muted-foreground">{tile.note}</span>
      ) : (
        <MetricDelta
          change={tile.change}
          comparedTo={comparedTo}
          unit={tile.unit}
          lowerIsBetter={tile.lowerIsBetter}
        />
      )}
    </button>
  )
}

type MetricDeltaProps = {
  change: number | null
  comparedTo: string
  lowerIsBetter?: boolean | undefined
  /** Suffix after the number: "%" for relative change, " pts" for conversion points. */
  unit?: string
}

function MetricDelta({ change, comparedTo, unit = '%', lowerIsBetter }: MetricDeltaProps) {
  if (change === null) return null
  const up = change >= 0
  const good = lowerIsBetter ? change <= 0 : up
  return (
    <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      <span
        className={cn(
          'inline-flex items-center gap-1 font-semibold',
          good ? 'text-foreground' : 'text-danger',
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
