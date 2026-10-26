'use client'

import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import { discountFormContent } from '@/data/discounts'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { LoadedDiscount } from './form-state'

type UsageStatsCardProps = {
  usage: LoadedDiscount['usage']
}

/**
 * How a discount has done (issue #673): times used, the revenue of those orders, what it gave
 * away, the last use, and the latest orders that used it, each linking to the order.
 */
export default function UsageStatsCard({ usage }: UsageStatsCardProps) {
  // Hooks
  const { tracking: copy } = useCopy(discountFormContent)
  const fmt = useFormat()

  // Render logic
  const stats = [
    { label: copy.timesUsed, value: String(usage.orders) },
    { label: copy.revenue, value: fmt.money(usage.revenuePaise) },
    { label: copy.given, value: fmt.money(usage.amountPaise) },
    { label: copy.lastUsed, value: usage.lastUsedAt ? fmt.date(usage.lastUsedAt) : copy.never },
  ]

  return (
    <DataCard title={copy.heading} bodyClassName="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5">
            <dt className="text-caption text-muted-foreground">{s.label}</dt>
            <dd className="text-body font-semibold text-ink-strong tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2">
        <p className="text-caption text-muted-foreground">{copy.recent}</p>
        {usage.recent.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {usage.recent.map((r) => (
              <li
                key={r.orderId}
                className="flex items-center justify-between gap-3 py-2 text-body"
              >
                <span className="flex items-baseline gap-2">
                  <Link
                    href={routes.orders.detail(r.orderId)}
                    className="font-medium text-ink-strong underline-offset-4 hover:underline"
                  >
                    {copy.order(r.number)}
                  </Link>
                  <span className="text-caption text-muted-foreground">
                    {fmt.date(r.usedAt)}
                    {r.status === 'cancelled' ? ` · ${copy.cancelled}` : ''}
                  </span>
                </span>
                <span className="flex items-baseline gap-2 tabular-nums">
                  <span className="text-caption text-muted-foreground">
                    {copy.off(fmt.money(r.amountPaise))}
                  </span>
                  <span>{fmt.money(r.totalPaise)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-caption text-muted-foreground">{copy.note}</p>
    </DataCard>
  )
}
