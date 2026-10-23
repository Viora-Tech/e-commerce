'use client'

import type { SourceRow } from '@commerce/api'
import { Card } from '@commerce/ui/shadcn/card'
import { SOURCE_LABELS } from '@/data/growth'
import { growthHomeContent } from '@/data/growth-home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'
import MetricLabel from '../metric-label'
import SourceIcon from '../source-icon'

type TopSourceCardsProps = { sources: SourceRow[] }

const SHOWN = 4

/** Shopify's row of top-source cards: icon and name, sessions, order value, orders and conversion. */
export default function TopSourceCards({ sources }: TopSourceCardsProps) {
  // Hooks
  const copy = useCopy(growthHomeContent.sources)
  const fmt = useFormat()

  // Render logic
  const top = sources
    .filter((s) => s.sessions > 0 || s.orders > 0)
    .sort((a, b) => b.sessions - a.sessions || b.salesPaise - a.salesPaise)
    .slice(0, SHOWN)

  if (top.length === 0) {
    return <p className="text-caption text-muted-foreground">{copy.empty}</p>
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {top.map((s) => (
        <li key={s.source} className="min-w-0">
          <Card inset={5} gap="none" className="h-full justify-between gap-8">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <SourceIcon source={s.source} className="size-4 shrink-0" />
                <MetricLabel help={copy.help} className="truncate text-body-strong text-foreground">
                  {SOURCE_LABELS[s.source]}
                </MetricLabel>
              </span>
              <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
                {copy.sessions(fmt.number(s.sessions))}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-stat-sm tabular-nums text-foreground">{fmt.money(s.salesPaise)}</p>
              <p className="text-caption text-muted-foreground">
                {copy.orderValue(
                  copy.orders(s.orders, fmt.number(s.orders)),
                  formatRate(s.conversion),
                )}
              </p>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  )
}
