import type { DashboardSummary } from '@commerce/api'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import RelativeTime from '@/components/layout/relative-time'
import { homeContent } from '@/data/home'
import { formatPaise } from '@/lib/money'

type LiveOrderStreamProps = {
  orders: DashboardSummary['recentOrders']
}

const DOT_TONE: Record<string, string> = {
  paid: 'bg-success',
  partially_paid: 'bg-warning',
  refunded: 'bg-info',
  partially_refunded: 'bg-info',
  refund_needed: 'bg-danger',
}

/** A green dot for paid, amber for part-paid, red when a refund is owed; grey otherwise. */
function dotClass(paymentStatus: string): string {
  return DOT_TONE[paymentStatus] ?? 'bg-muted-foreground-soft'
}

/** Compact "live" feed of the newest orders: name, when, amount, a payment dot. */
export default function LiveOrderStream({ orders }: LiveOrderStreamProps) {
  // Render logic
  const c = homeContent.liveStream

  return (
    <DataCard title={c.title} detailsHref="/orders">
      {orders.length === 0 ? (
        <EmptyState heading={c.empty} />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center gap-3 py-2.5 first:pt-0">
              <span
                className={`size-2 shrink-0 rounded-full ${dotClass(o.paymentStatus)}`}
                aria-hidden="true"
              />
              <Link
                href={`/orders/${o.id}`}
                className="min-w-0 flex-1 truncate text-body-strong text-ink-strong hover:underline"
              >
                {o.customerName ?? o.email ?? `#${o.number}`}
              </Link>
              <RelativeTime
                value={o.placedAt}
                className="shrink-0 text-caption text-muted-foreground"
              />
              <span className="w-20 shrink-0 text-right text-body-strong text-ink-strong tabular-nums">
                {formatPaise(o.totalPaise)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
