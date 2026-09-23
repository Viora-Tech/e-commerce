import Link from 'next/link'
import CopyButton from '@/components/fields/copy-button'
import DataCard from '@/components/layout/data-card'
import { orderDetailContent as copy } from '@/data/orders'
import type { OrderDetail } from './order-detail-types'

type CustomerCardProps = {
  order: OrderDetail
}

/** One line of contact detail with the button that copies it. */
function ContactRow({ value, what, href }: { value: string; what: string; href: string }) {
  return (
    <div className="group/row flex items-center gap-1">
      <a
        href={href}
        className="min-w-0 truncate text-link underline underline-offset-2 hover:text-foreground focus-visible:underline focus-visible:outline-none"
      >
        {value}
      </a>
      <CopyButton value={value} what={what} />
    </div>
  )
}

/** Who ordered, how often they have, and where this one goes. */
export default function CustomerCard({ order }: CustomerCardProps) {
  // Render logic
  const a = order.shippingAddress
  const addressText = a
    ? [a.name, a.line1, a.line2, `${a.city}, ${a.stateCode} ${a.pincode}`, a.phone]
        .filter(Boolean)
        .join('\n')
    : ''

  return (
    <DataCard
      title={copy.customer.heading}
      action={
        order.customer ? (
          <Link
            href={`/customers/${order.customer.id}`}
            className="text-caption text-link underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copy.customer.view}
          </Link>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5 text-body">
        <div>
          <p className="font-medium text-ink-strong">
            {order.customer?.name ?? copy.customer.guest}
          </p>
          {order.customerOrderNumber > 0 ? (
            <p className="text-caption font-normal text-muted-foreground">
              {copy.customer.orderCount(order.customerOrderNumber)}
            </p>
          ) : null}
        </div>

        <div>
          <p className="mb-1 text-caption text-muted-foreground">{copy.customer.contact}</p>
          {order.email ? (
            <ContactRow
              value={order.email}
              what={copy.customer.email}
              href={`mailto:${order.email}`}
            />
          ) : null}
          {order.phone ? (
            <ContactRow
              value={order.phone}
              what={copy.customer.phone}
              href={`tel:${order.phone}`}
            />
          ) : null}
        </div>

        <div>
          <div className="group/row mb-1 flex items-center gap-1">
            <p className="text-caption text-muted-foreground">{copy.customer.address}</p>
            {addressText ? (
              <CopyButton value={addressText} what={copy.customer.addressLabel} />
            ) : null}
          </div>
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
          <p className="mt-2 text-caption text-muted-foreground">{copy.customer.billingSame}</p>
        </div>
      </div>
    </DataCard>
  )
}
