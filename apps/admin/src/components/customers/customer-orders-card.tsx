import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import StatusLabel from '@/components/status/status-label'
import { customerDetailContent as copy } from '@/data/customers'
import { formatPaise } from '@/lib/money'
import { type CustomerOrder, day } from './customer-detail-types'

type CustomerOrdersCardProps = {
  orders: CustomerOrder[]
}

/* Frame 5:2038 column rhythm: order, date, status, amount right-aligned 24px from the edge. */
const ROW = 'grid grid-cols-[7rem_minmax(0,1fr)_9rem_7rem] items-center px-6'

/** Every order this customer placed, newest first, linking into the order page. */
export default function CustomerOrdersCard({ orders }: CustomerOrdersCardProps) {
  const c = copy.orders
  return (
    <DataCard title={c.heading} flush>
      <div className={cn(ROW, 'h-8 text-xs text-muted-foreground')}>
        <span>{c.columns.order}</span>
        <span>{c.columns.date}</span>
        <span>{c.columns.status}</span>
        <span className="text-right">{c.columns.total}</span>
      </div>
      {orders.length === 0 ? (
        <p className="px-6 py-6 text-body text-muted-foreground">{c.empty}</p>
      ) : (
        <div className="mt-1 flex flex-col gap-1">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className={cn(
                ROW,
                'h-10 text-xs text-foreground transition-colors hover:bg-background',
              )}
            >
              <span className="font-medium tabular-nums">#{o.number}</span>
              <span>{day(o.placedAt)}</span>
              <StatusLabel kind="order" value={o.status} size="sm" />
              <span className="text-right tabular-nums">{formatPaise(o.totalPaise)}</span>
            </Link>
          ))}
        </div>
      )}
    </DataCard>
  )
}
