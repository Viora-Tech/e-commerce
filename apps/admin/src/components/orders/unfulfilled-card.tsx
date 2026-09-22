import { Button } from '@commerce/ui/shadcn/button'
import DataCard from '@/components/layout/data-card'
import StatusLabel from '@/components/status/status-label'
import { orderDetailContent as copy } from '@/data/orders'
import { type OrderDetail, unfulfilledLines } from './order-detail-types'
import OrderLineRow from './order-line-row'

type UnfulfilledCardProps = {
  order: OrderDetail
  onFulfil: () => void
}

/** What is still waiting to be packed, with the action that packs it. */
export default function UnfulfilledCard({ order, onFulfil }: UnfulfilledCardProps) {
  // Render logic
  const rows = unfulfilledLines(order)

  // Early returns
  if (rows.length === 0 || order.status === 'cancelled') return null

  return (
    <DataCard
      size="kit"
      title={copy.unfulfilled.heading}
      action={
        <div className="flex items-center gap-3">
          <StatusLabel kind="fulfilment" value="unfulfilled" variant="pill" size="sm" />
          <Button size="sm" onClick={onFulfil}>
            {copy.actions.fulfilItems}
          </Button>
        </div>
      }
    >
      <ul className="divide-y divide-border">
        {rows.map(({ line, remaining }) => (
          <OrderLineRow key={line.id} line={line} quantity={remaining} />
        ))}
      </ul>
    </DataCard>
  )
}
