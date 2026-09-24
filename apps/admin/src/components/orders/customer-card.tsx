import { Button } from '@commerce/ui/shadcn/button'
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
  const lines = a
    ? [a.name, a.line1, a.line2, `${a.city}, ${a.stateCode} ${a.pincode}`, a.phone].filter(
        (l): l is string => Boolean(l),
      )
    : []
  const addressText = lines.join('\n')

  const link =
    'text-caption text-foreground underline underline-offset-2 hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
  const profileHref = order.customer ? `/customers/${order.customer.id}` : null

  /* After the Saleor Dashboard customer details panel (BSD-3): underlined header links, the
     email with a copy button, then address blocks with an outlined Edit and a copy icon. */
  return (
    <DataCard
      title={copy.customer.heading2}
      action={
        <div className="flex items-center gap-3">
          {order.email ? (
            <Link href={`/orders?query=${encodeURIComponent(order.email)}`} className={link}>
              {copy.customer.viewOrders}
            </Link>
          ) : null}
          {profileHref ? (
            <Link href={profileHref} className={link}>
              {copy.customer.viewProfile}
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-6 text-body">
        <div className="flex flex-col gap-1">
          <p className="text-ink-strong">
            {order.customer?.name ?? copy.customer.guest}
            {order.customerOrderNumber > 0 ? (
              <span className="text-muted-foreground">
                {' · '}
                {copy.customer.orderCount(order.customerOrderNumber)}
              </span>
            ) : null}
          </p>
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

        <AddressBlock
          heading={copy.customer.address}
          lines={lines}
          copyText={addressText}
          editHref={profileHref}
        />
        <AddressBlock
          heading={copy.customer.billing}
          lines={lines.length > 0 ? [copy.customer.billingSame] : []}
          copyText=""
          editHref={null}
        />
      </div>
    </DataCard>
  )
}

type AddressBlockProps = {
  heading: string
  lines: string[]
  copyText: string
  editHref: string | null
}

function AddressBlock({ heading, lines, copyText, editHref }: AddressBlockProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-caption text-muted-foreground">{heading}</p>
        {editHref ? (
          <Button
            variant="outline"
            size="sm"
            title={copy.customer.editHint}
            render={<Link href={editHref} />}
            nativeButton={false}
          >
            {copy.customer.edit}
          </Button>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        {lines.length > 0 ? (
          <address className="text-ink-strong not-italic">
            {lines.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </address>
        ) : (
          <p className="text-muted-foreground">{copy.customer.noAddress}</p>
        )}
        {copyText ? <CopyButton value={copyText} what={copy.customer.addressLabel} /> : null}
      </div>
    </div>
  )
}
