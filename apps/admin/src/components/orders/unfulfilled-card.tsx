import { PackageOpen } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import DataCard from '@/components/layout/data-card'
import StatusLabel from '@/components/status/status-label'
import { orderDetailContent as copy } from '@/data/orders'
import { type OrderDetail, unfulfilledLines } from './order-detail-types'
import OrderLinesTable from './order-lines-table'

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
      title={copy.unfulfilled.heading}
      action={
        <>
          <StatusLabel kind="fulfilment" value="unfulfilled" variant="pill" size="sm" />
          <Button onClick={onFulfil}>
            <PackageOpen aria-hidden="true" />
            {copy.actions.fulfilItems}
          </Button>
        </>
      }
    >
      <OrderLinesTable rows={rows.map(({ line, remaining }) => ({ line, quantity: remaining }))} />
    </DataCard>
  )
}
