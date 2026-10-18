import type { address, order } from '@commerce/db'
import { thankYouContent as content, INDIAN_STATES } from '@/data/checkout'
import { CK_HEADING } from '@/lib/checkout-classes'

type OrderDetailsProps = {
  order: typeof order.$inferSelect
  /** The order's delivery address snapshot; null for gift cards, which are emailed. */
  shipTo: typeof address.$inferSelect | null
}

const stateName = (code: string): string => INDIAN_STATES.find(([c]) => c === code)?.[1] ?? code

/** Contact, delivery address, delivery and payment method: what the shopper may want to check. */
export default function OrderDetails({ order: o, shipTo }: OrderDetailsProps) {
  // Render logic
  const contact = [o.email, o.phone].filter((v): v is string => Boolean(v))
  const method = o.paymentMethod
    ? (content.methods[o.paymentMethod] ?? content.methods.online)
    : null
  const rows: [string, string[]][] = []
  if (contact.length > 0) rows.push([content.details.contact, contact])
  if (shipTo) {
    rows.push([
      content.details.shipTo,
      [
        shipTo.name,
        [shipTo.line1, shipTo.line2].filter(Boolean).join(', '),
        `${shipTo.city}, ${stateName(shipTo.stateCode)} ${shipTo.pincode}`,
      ],
    ])
  }
  if (o.shippingRateName) rows.push([content.details.delivery, [o.shippingRateName]])
  if (method) rows.push([content.details.payment, [method]])

  return (
    <section aria-labelledby="order-details-heading" className="flex flex-col gap-4">
      <h2 id="order-details-heading" className={`${CK_HEADING} text-[1rem]!`}>
        {content.details.heading}
      </h2>
      <dl className="grid gap-x-6 gap-y-5 rounded-ck border border-ck-line bg-ck-field p-5 text-[0.875rem] [box-shadow:0_1px_2px_rgb(0_0_0/0.03)] sm:grid-cols-2 sm:p-6">
        {rows.map(([label, lines]) => (
          <div key={label} className="flex min-w-0 flex-col gap-1">
            <dt className="text-[0.8125rem] text-ck-muted">{label}</dt>
            {lines.map((line) => (
              <dd key={line} className="break-words text-ck-ink">
                {line}
              </dd>
            ))}
          </div>
        ))}
      </dl>
    </section>
  )
}
