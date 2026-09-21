import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { ArrowDown, ArrowUp } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { layoutContent } from '@/data/layout'

type StatCardProps = {
  title: string
  /** "Last 7 days", sits under the title. */
  period: string
  value: string
  /** Word after the number, e.g. "Sales". */
  unit?: string
  /** Percent change vs the previous period; sign decides colour. */
  delta?: number | null
  /** Set when a rise is bad news (cancellations) so the colours flip. */
  invert?: boolean
  /** "Previous 7 days ($235)" line; the value is highlighted. */
  previous?: { label: string; value: string }
  detailsHref?: string
  detailsLabel?: string
  /** Replaces the number block entirely (the Pending & cancelled tile). */
  children?: ReactNode
  className?: string
}

/** Percent change between two window values; null when there is nothing to compare against. */
export function percentDelta(value: number, previous: number): number | null {
  if (previous === 0) return value === 0 ? 0 : null
  return ((value - previous) / previous) * 100
}

export function DeltaChip({
  delta,
  invert,
}: {
  delta: number | null | undefined
  invert?: boolean
}) {
  if (delta === null || delta === undefined) return null
  const flat = Math.abs(delta) < 0.05
  const up = delta > 0
  const good = invert ? !up : up
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-sm font-medium tabular-nums',
        flat ? 'text-muted-foreground' : good ? 'text-success' : 'text-destructive',
      )}
    >
      {flat ? null : <Icon className="size-4" />}
      {flat ? layoutContent.noChange : `${Math.abs(delta).toFixed(1)}%`}
    </span>
  )
}

/** Kit stat card: title + period, big number with unit and delta, previous-period line, Details pill. */
export function StatCard({
  title,
  period,
  value,
  unit,
  delta,
  invert,
  previous,
  detailsHref,
  detailsLabel = layoutContent.details,
  children,
  className,
}: StatCardProps) {
  return (
    <Card className={cn('relative gap-0 px-5 py-5', className)}>
      <div>
        <p className="text-card-title">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{period}</p>
      </div>
      {children ?? (
        <div className="mt-5 flex items-end gap-4">
          <p className="text-stat text-ink-strong tabular-nums">{value}</p>
          <div className="mb-1 flex items-end gap-1">
            {unit ? <span className="text-base text-foreground">{unit}</span> : null}
            <DeltaChip delta={delta} invert={invert} />
          </div>
        </div>
      )}
      <div className="mt-3 flex items-end justify-between gap-3">
        {previous ? (
          <p className="text-sm text-muted-foreground">
            {previous.label}{' '}
            <span className="font-semibold text-foreground">({previous.value})</span>
          </p>
        ) : (
          <span />
        )}
        {detailsHref ? (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 rounded-full"
            render={<Link href={detailsHref} />}
            nativeButton={false}
          >
            {detailsLabel}
          </Button>
        ) : null}
      </div>
    </Card>
  )
}
