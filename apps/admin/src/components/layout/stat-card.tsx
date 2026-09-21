import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import { TrendingDown, TrendingUp } from 'lucide-react'

type StatCardProps = {
  label: string
  value: string
  /** Percentage change vs the previous period; sign decides colour. */
  delta?: number
  deltaLabel?: string
  /** Series for the background sparkline, oldest first. */
  trend?: number[]
  className?: string
}

const SPARK_W = 120
const SPARK_H = 36

/** Polyline points for a sparkline, scaled to the box with a little vertical padding. */
function sparkPoints(series: number[]): string {
  if (series.length < 2) return ''
  const min = Math.min(...series)
  const max = Math.max(...series)
  const span = max - min || 1
  const step = SPARK_W / (series.length - 1)
  return series
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(SPARK_H - 3 - ((v - min) / span) * (SPARK_H - 6)).toFixed(1)}`,
    )
    .join(' ')
}

/** KPI tile: label, big number, optional delta and sparkline. */
export function StatCard({ label, value, delta, deltaLabel, trend, className }: StatCardProps) {
  const points = trend ? sparkPoints(trend) : ''
  const up = (delta ?? 0) >= 0
  const DeltaIcon = up ? TrendingUp : TrendingDown

  return (
    <Card className={cn('relative justify-between gap-2 px-4', className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          {delta !== undefined ? (
            <p
              className={cn(
                'mt-1 flex items-center gap-1 text-xs',
                up ? 'text-success' : 'text-destructive',
              )}
            >
              <DeltaIcon className="size-3.5" />
              {up ? '+' : ''}
              {delta.toFixed(1)}%
              {deltaLabel ? <span className="text-muted-foreground"> {deltaLabel}</span> : null}
            </p>
          ) : null}
        </div>
        {points ? (
          <svg
            viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
            width={SPARK_W}
            height={SPARK_H}
            className="shrink-0 overflow-visible text-primary"
            aria-hidden="true"
          >
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </div>
    </Card>
  )
}
