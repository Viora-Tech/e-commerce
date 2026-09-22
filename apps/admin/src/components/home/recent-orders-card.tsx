import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import FilterButton from '@/components/layout/filter-button'
import StatusLabel from '@/components/status/status-label'
import { homeContent } from '@/data/home'
import type { OrderStatus } from '@/data/orders'
import { formatPaise } from '@/lib/money'

const dateTime = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

type RecentOrder = {
  id: string
  number: number
  status: OrderStatus
  totalPaise: number
  customerName: string | null
  email: string | null
  placedAt: Date | string
}

/* 5:2038: columns start at x 24 / 147 / 336 / 552 and the amount ends 24px from the edge. */
const TX_ROW = 'grid grid-cols-[7.5rem_11.75rem_13.5rem_11rem_minmax(0,1fr)] items-center px-6'

/** Frame 5:2032 "Transaction": 33px header, 41px rows 4px apart, 14px text. */
export default function RecentOrdersCard({ orders }: { orders: RecentOrder[] }) {
  const c = homeContent.recentOrders
  return (
    <DataCard
      title={c.title}
      action={<FilterButton items={c.filters} />}
      detailsHref="/orders"
      flush
      size="kit"
      titleSize="table"
    >
      <div className={cn(TX_ROW, 'h-[2.0625rem] text-kit-body font-medium text-muted-foreground')}>
        <span>{c.columns.no}</span>
        <span>{c.columns.order}</span>
        <span>{c.columns.date}</span>
        <span>{c.columns.status}</span>
        <span className="text-right">{c.columns.amount}</span>
      </div>
      {orders.length === 0 ? (
        <p className="px-6 py-6 text-kit-body text-muted-foreground">{c.empty}</p>
      ) : (
        <div className="mt-1 flex flex-col gap-1">
          {orders.map((o, i) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className={cn(
                TX_ROW,
                'h-[2.3125rem] text-kit-cell text-foreground transition-colors hover:bg-background',
              )}
            >
              <span>{i + 1}.</span>
              <span className="truncate">#{o.number}</span>
              <span>{dateTime.format(new Date(o.placedAt))}</span>
              <StatusLabel kind="order" value={o.status} size="sm" />
              <span className="text-right tabular-nums">{formatPaise(o.totalPaise)}</span>
            </Link>
          ))}
        </div>
      )}
    </DataCard>
  )
}
