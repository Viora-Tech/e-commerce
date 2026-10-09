'use client'

import DataCard from '@/components/layout/data-card'
import { customerDetailContent, customersContent } from '@/data/customers'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { formatPaise } from '@/lib/money'
import type { CustomerDetail } from './customer-detail-types'
import { day } from './customer-detail-types'

type CustomerStatsCardProps = { customer: CustomerDetail }

type RowProps = { label: string; value: string }

function Row({ label, value }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-body text-muted-foreground">{label}</span>
      <span className="text-body font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}

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
      <Row label={copy.orders} value={String(t.orderCount)} />
      <Row label={copy.spent} value={formatPaise(t.spentPaise)} />
      <Row label={copy.average} value={none ? '-' : formatPaise(t.averagePaise)} />
      <Row
        label={copy.firstOrder}
        value={t.firstOrderAt ? day(t.firstOrderAt, locale) : none ? '-' : never}
      />
      <Row
        label={copy.lastOrder}
        value={t.lastOrderAt ? day(t.lastOrderAt, locale) : none ? '-' : never}
      />
    </DataCard>
  )
}
