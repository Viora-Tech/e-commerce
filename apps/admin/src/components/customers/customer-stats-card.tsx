'use client'

import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import { customerDetailContent, customersContent } from '@/data/customers'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { formatPaiseWhole } from '@/lib/money'
import type { CustomerDetail } from './customer-detail-types'
import { day } from './customer-detail-types'

type CustomerStatsCardProps = { customer: CustomerDetail }

/** Lifetime figures: orders, total spent, average order and the first and last order dates. */
export default function CustomerStatsCard({ customer }: CustomerStatsCardProps) {
  // Hooks
  const detail = useCopy(customerDetailContent)
  const customersCopy = useCopy(customersContent)
  const locale = useLocale()

  // Render logic
  const copy = detail.totals
  const never = customersCopy.never
  const t = customer.totals
  const none = t.orderCount === 0

  return (
    <DataCard title={copy.heading} className="rounded-xl">
      <KeyValueList
        variant="grid"
        className="tabular-nums"
        rows={[
          { label: copy.orders, value: String(t.orderCount), strong: true },
          { label: copy.spent, value: formatPaiseWhole(t.spentPaise), strong: true },
          { label: copy.average, value: none ? '-' : formatPaiseWhole(t.averagePaise), strong: true },
          {
            label: copy.firstOrder,
            value: t.firstOrderAt ? day(t.firstOrderAt, locale) : none ? '-' : never,
            strong: true,
          },
          {
            label: copy.lastOrder,
            value: t.lastOrderAt ? day(t.lastOrderAt, locale) : none ? '-' : never,
            strong: true,
          },
        ]}
      />
    </DataCard>
  )
}
