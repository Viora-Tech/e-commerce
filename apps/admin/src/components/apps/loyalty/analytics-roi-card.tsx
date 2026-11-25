'use client'

import { POINT_PAISE } from '@commerce/core/loyalty'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import MetricLabel from '@/components/growth/metric-label'
import { loyaltyInsightsContent } from '@/data/loyalty-insights'
import { useCopy, useFormat } from '@/hooks/use-copy'

type AnalyticsRoiCardProps = {
  /** The range's figures; null while they load. */
  figures: { memberRevenuePaise: number; pointsIssued: number; pointsExpired: number } | null
}

/**
 * Essential's "Loyalty ROI" card on our numbers: points are store credit at ₹1 each, so the
 * program's cost is the credit it gave minus what ran out unused, and its value is the member
 * revenue. The big figure is value over cost.
 */
export default function AnalyticsRoiCard({ figures }: AnalyticsRoiCardProps) {
  // Hooks
  const copy = useCopy(loyaltyInsightsContent)
  const f = useFormat()

  // Render logic
  const r = copy.analytics.roi
  const issued = (figures?.pointsIssued ?? 0) * POINT_PAISE
  const expired = (figures?.pointsExpired ?? 0) * POINT_PAISE
  const cost = Math.max(0, issued - expired)
  const value = figures?.memberRevenuePaise ?? 0
  const multiple = cost > 0 ? (value / cost).toFixed(1) : null
  const rows = [
    {
      id: 'issued',
      label: r.issued,
      note: r.issuedNote(f.number(figures?.pointsIssued ?? 0)),
      value: f.moneyWhole(issued),
    },
    { id: 'expired', label: r.expired, value: `−${f.moneyWhole(expired)}` },
    { id: 'cost', label: r.cost, value: f.moneyWhole(cost), strong: true },
    { id: 'value', label: r.value, value: f.moneyWhole(value), strong: true },
  ]

  return (
    <Card inset={5} gap={3} className="min-w-0">
      <MetricLabel help={r.help} className="text-body-strong text-foreground">
        {r.title}
      </MetricLabel>
      {figures === null ? (
        <>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-32 w-full" />
        </>
      ) : (
        <>
          {multiple === null ? (
            <p className="text-body text-muted-foreground">{r.none}</p>
          ) : (
            <p className="text-stat tabular-nums text-foreground">{r.multiple(multiple)}</p>
          )}
          <ul className="flex flex-col divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between gap-3 py-2">
                <span className="flex flex-col">
                  <span
                    className={
                      row.strong
                        ? 'text-body font-medium text-foreground'
                        : 'text-body text-foreground'
                    }
                  >
                    {row.label}
                  </span>
                  {row.note ? (
                    <span className="text-caption text-muted-foreground">{row.note}</span>
                  ) : null}
                </span>
                <span
                  className={
                    row.strong
                      ? 'text-body font-medium tabular-nums text-foreground'
                      : 'text-body tabular-nums text-muted-foreground'
                  }
                >
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
