'use client'

import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import GrowthTrendChart from '@/components/growth/growth-trend-chart'
import MetricLabel from '@/components/growth/metric-label'
import DeltaChip from '@/components/layout/delta-chip'
import { loyaltyInsightsContent } from '@/data/loyalty-insights'
import { useCopy, useFormat } from '@/hooks/use-copy'

type AnalyticsRevenueCardProps = {
  /** Member revenue per store day of the range, paise; `before` is the same day of the period before. */
  days: { day: string; value: number; before: number }[]
  totalPaise: number
  /** Percent change against the period before; null with nothing to compare. */
  delta: number | null
  loading: boolean
}

/**
 * Essential's "Loyalty revenue" card: the member revenue figure with its change, and the daily
 * line against the period before (dashed). Non-member revenue has no daily series in the API,
 * so the comparison is with the previous period rather than with other shoppers.
 */
export default function AnalyticsRevenueCard({
  days,
  totalPaise,
  delta,
  loading,
}: AnalyticsRevenueCardProps) {
  // Hooks
  const copy = useCopy(loyaltyInsightsContent)
  const f = useFormat()

  // Render logic
  const a = copy.analytics
  const points = days.map((d) => ({
    label: f.pattern(new Date(`${d.day}T00:00:00+05:30`), { day: 'numeric', month: 'short' }),
    value: d.value,
    before: d.before,
  }))

  return (
    <Card inset={5} gap={3} className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <MetricLabel help={a.revenueHelp} className="text-body-strong text-foreground">
          {a.revenueTitle}
        </MetricLabel>
        {loading ? null : <DeltaChip delta={delta} size="kit" />}
      </div>
      {loading ? (
        <>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-56 w-full" />
        </>
      ) : (
        <>
          <p className="text-stat tabular-nums text-foreground">{f.moneyWhole(totalPaise)}</p>
          <GrowthTrendChart
            points={points}
            series={[
              {
                key: 'before',
                label: a.previous,
                color: 'var(--muted-foreground)',
                dashed: true,
              },
              { key: 'value', label: a.current, color: 'var(--chart-1)' },
            ]}
            formatValue={(v) => f.moneyCompact(v)}
            emptyNote={a.chartEmpty}
            className="h-56"
          />
        </>
      )}
    </Card>
  )
}
