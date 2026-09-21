import DataCard from '@/components/layout/data-card'
import { orderDetailContent as copy } from '@/data/orders'
import type { OrderDetail } from './order-detail-types'

type CustomerCardProps = {
  order: OrderDetail
}

/** Who ordered and where it goes. */
export default function CustomerCard({ order }: CustomerCardProps) {
  const a = order.shippingAddress

  return (
    <DataCard title={copy.customer.heading}>
      <div className="flex flex-col gap-4 text-body">
        <div>
          <p className="font-medium">{order.customer?.name ?? copy.customer.guest}</p>
          {order.email ? (
            <a
              href={`mailto:${order.email}`}
              className="block text-primary hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {order.email}
            </a>
          ) : null}
          {order.phone ? (
            <a
              href={`tel:${order.phone}`}
              className="block text-primary hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {order.phone}
            </a>
          ) : null}
        </div>
        <div className="border-t border-border pt-4">
          <p className="text-caption text-muted-foreground-soft mb-1">{copy.customer.address}</p>
          {a ? (
            <address className="not-italic">
              <p>{a.name}</p>
              <p>{a.line1}</p>
              {a.line2 ? <p>{a.line2}</p> : null}
              <p>
                {a.city}, {a.stateCode} {a.pincode}
              </p>
              {a.phone ? <p>{a.phone}</p> : null}
            </address>
          ) : (
            <p className="text-muted-foreground">{copy.customer.noAddress}</p>
          )}
          <p className="text-caption text-muted-foreground-soft mt-2">
            {copy.customer.billingSame}
          </p>
        </div>
      </div>
    </DataCard>
  )
}
