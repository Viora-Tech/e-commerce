'use client'

import StatStrip from '@/components/layout/stat-strip'
import { customerDetailContent } from '@/data/customers'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { formatPaiseWhole } from '@/lib/money'
import type { CustomerDetail } from './customer-detail-types'
import { day } from './customer-detail-types'

type CustomerSummaryStripProps = { customer: CustomerDetail }

/**
 * What the customer is worth at a glance, under the header (audit #82): amount spent with the
 * average order, orders with the first one, how long they have been a customer, and the last
 * order. It replaces the Lifetime card that sat at the bottom of the side column.
 */
export default function CustomerSummaryStrip({ customer }: CustomerSummaryStripProps) {
  // Hooks
  const detail = useCopy(customerDetailContent)
  const locale = useLocale()

  // Render logic
  const copy = detail.summary
  const t = customer.totals
  const none = t.orderCount === 0

  return (
    <StatStrip
      tiles={[
        {
          id: 'spent',
          label: copy.spent,
          value: formatPaiseWhole(t.spentPaise, locale),
          note: none ? copy.noOrders : copy.average(formatPaiseWhole(t.averagePaise, locale)),
        },
        {
          id: 'orders',
          label: copy.orders,
          value: String(t.orderCount),
          note: t.firstOrderAt ? copy.firstOrder(day(t.firstOrderAt, locale)) : copy.noOrders,
        },
        { id: 'since', label: copy.since, value: day(customer.createdAt, locale) },
        {
          id: 'last',
          label: copy.lastOrder,
          value: t.lastOrderAt ? day(t.lastOrderAt, locale) : '-',
        },
      ]}
    />
  )
}
