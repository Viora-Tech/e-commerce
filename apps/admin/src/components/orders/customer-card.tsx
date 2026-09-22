import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import { orderDetailContent as copy } from '@/data/orders'
import CopyButton from './copy-button'
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
        className="min-w-0 truncate text-ink-strong underline-offset-4 hover:text-primary hover:underline focus-visible:underline focus-visible:outline-none"
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
    <DataCard size="kit" title={copy.customer.heading}>
      <div className="flex flex-col gap-4 text-kit-cell">
        <div>
          <p className="font-medium">{order.customer?.name ?? copy.customer.guest}</p>
          {order.customerOrderNumber > 0 ? (
            <p className="text-kit-body text-muted-foreground">
              {copy.customer.orderCount(order.customerOrderNumber)}
            </p>
          ) : null}
          {order.customer ? (
            <Link
              href={`/customers/${order.customer.id}`}
              className="mt-1 inline-block text-kit-body text-ink-strong underline-offset-4 hover:text-primary hover:underline focus-visible:underline focus-visible:outline-none"
            >
              {copy.customer.view}
            </Link>
          ) : null}
        </div>

        <div className="border-t border-border pt-4">
          <p className="mb-1 text-kit-body text-muted-foreground-soft">{copy.customer.contact}</p>
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

        <div className="border-t border-border pt-4">
          <div className="group/row mb-1 flex items-center gap-1">
            <p className="text-kit-body text-muted-foreground-soft">{copy.customer.address}</p>
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
          <p className="mt-2 text-kit-body text-muted-foreground-soft">
            {copy.customer.billingSame}
          </p>
        </div>
      </div>
    </DataCard>
  )
}
