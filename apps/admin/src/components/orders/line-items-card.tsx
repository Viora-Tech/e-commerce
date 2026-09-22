import { cn } from '@commerce/ui/lib/utils'
import DataCard from '@/components/layout/data-card'
import StatusLabel from '@/components/status/status-label'
import { orderDetailContent as copy } from '@/data/orders'
import type { OrderDetail } from './order-detail-types'
import OrderLineRow from './order-line-row'
import { totalRows } from './order-totals'

type LineItemsCardProps = {
  order: OrderDetail
}

/** What was bought, at the prices captured when the order was placed. */
export default function LineItemsCard({ order }: LineItemsCardProps) {
  // Render logic
  const rows = totalRows(order)
  const packed = order.lines.some((l) => l.fulfilledQuantity > 0)
  const allPacked = order.lines.every((l) => l.fulfilledQuantity >= l.quantity)
  const firstSettlement = rows.findIndex((r) => r.settlement)

  return (
    <DataCard
      size="kit"
      title={copy.items.heading}
      action={
        packed ? (
          <StatusLabel
            kind="fulfilment"
            value={allPacked ? 'fulfilled' : 'unfulfilled'}
            variant="pill"
            size="sm"
          />
        ) : undefined
      }
    >
      <ul className="divide-y divide-border">
        {order.lines.map((l) => (
          <OrderLineRow key={l.id} line={l} />
        ))}
      </ul>
      <dl className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={cn(
              'flex justify-between',
              r.strong && 'font-semibold',
              r.muted && 'text-muted-foreground',
              i === firstSettlement && firstSettlement > 0 && 'mt-2 border-t border-border pt-4',
            )}
          >
            <dt>{r.label}</dt>
            <dd className="tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
    </DataCard>
  )
}
