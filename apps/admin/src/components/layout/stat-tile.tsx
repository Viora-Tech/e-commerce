import { ArrowDown, ArrowUp } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'

type StatTileProps = {
  label: string
  /** Already formatted (money, count). */
  value: string
  /** Percent change against the previous period; the sign picks the arrow. */
  trend?: number | null
  /** Text after the arrow, e.g. "vs yesterday"; on its own (no trend) it is a plain note line. */
  trendNote?: string
  /** A rise is bad news (cancellations): the colours flip. */
  invert?: boolean
  /** A plain line under the figure when there is no trend ("56% of all customers"). */
  note?: string
  /** Makes the tile a filter button; `active` marks the current one. */
  onSelect?: () => void
  active?: boolean
  /** Points for a small trend line at the right of the tile (Figma Analytics KPI card). */
  spark?: number[] | undefined
  className?: string
}

/** A 56×24 polyline over the points, scaled to their own min and max. */
function Spark({ points }: { points: number[] }) {
  const min = Math.min(...points)
  const span = Math.max(...points) - min || 1
  const step = 56 / Math.max(points.length - 1, 1)
  const d = points.map(
    (p, i) => `${(i * step).toFixed(1)},${(22 - ((p - min) / span) * 20).toFixed(1)}`,
  )
  return (
    <svg
      viewBox="0 0 56 24"
      aria-hidden="true"
      className="h-6 w-14 shrink-0 self-center text-muted-foreground"
    >
      <polyline
        points={d.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* Figma "Stat strip" cell: 16px inset, 6px gaps, 13px label, 28/34 semibold figure. The strip
   (StatStrip) draws the card and the hairlines between cells. */
const CELL =
  'flex min-w-0 flex-col gap-1.5 bg-transparent p-4 text-left transition-colors duration-150 ease-out'

/** One cell of the stat strip: default, hover, and active when it filters the list below. */
export default function StatTile({
  label,
  value,
  trend,
  trendNote,
  invert = false,
  note,
  onSelect,
  active = false,
  spark,
  className,
}: StatTileProps) {
  // Render logic
  const up = (trend ?? 0) > 0
  const good = invert ? !up : up
  const figures = (
    <>
      <span className="text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">{label}</span>
      <span className="text-[1.75rem] leading-[2.125rem] font-semibold tracking-[-0.02em] text-ink-strong tabular-nums">
        {value}
      </span>
      {typeof trend === 'number' ? (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs font-medium',
            trend === 0 ? 'text-muted-foreground' : good ? 'text-foreground' : 'text-danger',
          )}
        >
          {trend === 0 ? null : up ? (
            <ArrowUp className="size-3" aria-hidden />
          ) : (
            <ArrowDown className="size-3" aria-hidden />
          )}
          {Math.abs(trend)}%
          {trendNote ? (
            <span className="font-normal text-muted-foreground">{trendNote}</span>
          ) : null}
        </span>
      ) : note || (trendNote && trend === undefined) ? (
        /* A trend of null means there is nothing to compare against: no lone "vs last week". */
        <span className="text-xs text-muted-foreground">{note ?? trendNote}</span>
      ) : null}
    </>
  )
  const body =
    spark && spark.length > 1 ? (
      <span className="flex items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-1">{figures}</span>
        <Spark points={spark} />
      </span>
    ) : (
      figures
    )

  if (!onSelect) return <div className={cn(CELL, className)}>{body}</div>

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        CELL,
        'cursor-pointer hover:bg-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        active && 'bg-primary-soft hover:bg-primary-soft',
        className,
      )}
    >
      {body}
    </button>
  )
}
