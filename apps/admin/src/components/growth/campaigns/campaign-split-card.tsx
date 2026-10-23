'use client'

import type { CampaignReport } from '@commerce/api'
import DataCard from '@/components/layout/data-card'
import { campaignPerformanceContent } from '@/data/growth-report'
import { useCopy, useFormat } from '@/hooks/use-copy'

type CampaignSplitCardProps = { split: CampaignReport['split'] }

/** Orders and sales the campaign brought from first-time buyers and from returning ones. */
export default function CampaignSplitCard({ split }: CampaignSplitCardProps) {
  // Hooks
  const copy = useCopy(campaignPerformanceContent.split)
  const fmt = useFormat()

  // Render logic
  const rows = [
    { id: 'new', label: copy.newBuyers, orders: split.newOrders, sales: split.newSalesPaise },
    {
      id: 'returning',
      label: copy.returning,
      orders: split.returningOrders,
      sales: split.returningSalesPaise,
    },
  ]
  const empty = split.newOrders + split.returningOrders === 0

  return (
    <DataCard title={copy.title}>
      {empty ? (
        <p className="text-body text-muted-foreground">{copy.empty}</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-baseline justify-between gap-3 border-line border-t py-2.5 first:border-t-0 first:pt-0"
            >
              <span className="text-body text-foreground">{r.label}</span>
              <span className="flex flex-col items-end">
                <span className="text-body-strong text-ink-strong tabular-nums">
                  {fmt.money(r.sales)}
                </span>
                <span className="text-caption text-muted-foreground tabular-nums">
                  {copy.orders(fmt.number(r.orders))}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
