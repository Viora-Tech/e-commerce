import DataCard from '@/components/layout/data-card'
import { customerDetailContent as copy, customersContent } from '@/data/customers'
import { formatPaise } from '@/lib/money'
import type { CustomerDetail } from './customer-detail-types'
import { day } from './customer-detail-types'

type CustomerStatsCardProps = { customer: CustomerDetail }

type RowProps = { label: string; value: string }

function Row({ label, value }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-body text-muted-foreground">{label}</span>
      <span className="text-body-strong tabular-nums">{value}</span>
    </div>
  )
}

/** Lifetime figures beside the profile: counts, spend and the order window. */
export default function CustomerStatsCard({ customer }: CustomerStatsCardProps) {
  // Render logic
  const t = customer.totals

  return (
    <DataCard title={copy.totals.heading}>
      <Row label={copy.totals.orders} value={String(t.orderCount)} />
      <Row label={copy.totals.spent} value={formatPaise(t.spentPaise)} />
      <Row label={copy.totals.average} value={formatPaise(t.averagePaise)} />
      <Row
        label={copy.totals.firstOrder}
        value={t.firstOrderAt ? day(t.firstOrderAt) : customersContent.never}
      />
      <Row
        label={copy.totals.lastOrder}
        value={t.lastOrderAt ? day(t.lastOrderAt) : customersContent.never}
      />
    </DataCard>
  )
}
