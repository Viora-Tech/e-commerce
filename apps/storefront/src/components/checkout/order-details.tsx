import { formatPaise } from '@commerce/blocks'
import type { address, order, payment } from '@commerce/db'
import { thankYouContent as content } from '@/data/checkout'
import { INDIAN_STATES } from '@/data/indian-states'

type OrderDetailsProps = {
  order: typeof order.$inferSelect
  /** The order's delivery address snapshot; null for gift cards, which are emailed. */
  shipTo: typeof address.$inferSelect | null
  /** The latest gateway, COD or transfer attempt; undefined when gift cards or store credit paid everything. */
  payment: typeof payment.$inferSelect | undefined
  giftCards: { id: string; last: string; amountPaise: number }[]
  /** Store credit spent on the order; 0 for none. */
  storeCreditPaise?: number
  /** The Delivery card already says where it goes: leave the address and shipping out. */
  compact?: boolean
}

const stateName = (code: string): string => INDIAN_STATES.find(([c]) => c === code)?.[1] ?? code

/** A country's English name (`AE` → United Arab Emirates). */
const countryName = (code: string): string =>
  new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code

/**
 * The second card's grid: Contact, Payment (how, and what was paid or is still to pay),
 * Delivering to and Shipping (the rate and its price). Two columns from `sm`.
 */
export default function OrderDetails({
  order: o,
  shipTo,
  payment: pay,
  giftCards,
  storeCreditPaise = 0,
  compact = false,
}: OrderDetailsProps) {
  // Render logic
  const contact = [o.email, o.phone].filter((v): v is string => Boolean(v))
  // What the gateway, COD or transfer line covers: the total less any gift cards.
  const amount = formatPaise(pay?.amountPaise ?? o.totalPaise)
  const paid = !!o.checkoutPaidAt
  const method = o.paymentMethod
    ? (content.methods[o.paymentMethod] ?? content.methods.online)
    : null
  const payLines: string[] = []
  if (method && o.paymentMethod !== 'gift_card' && o.paymentMethod !== 'store_credit') {
    payLines.push(
      o.paymentMethod === 'cod' && !paid
        ? content.codToPay(amount)
        : `${method} · ${paid ? content.paid(amount) : content.due(amount)}`,
    )
  }
  for (const g of giftCards) payLines.push(content.giftCardLine(g.last, formatPaise(g.amountPaise)))
  if (storeCreditPaise > 0) payLines.push(content.storeCreditLine(formatPaise(storeCreditPaise)))
  const rows: [string, string[]][] = []
  if (contact.length > 0) rows.push([content.details.contact, contact])
  if (payLines.length > 0) rows.push([content.details.payment, payLines])
  if (shipTo && !compact) {
    rows.push([
      content.details.shipTo,
      [
        shipTo.name,
        [shipTo.line1, shipTo.line2].filter(Boolean).join(', '),
        `${shipTo.city}, ${stateName(shipTo.stateCode)} ${shipTo.pincode}`.trim(),
        // An address abroad names its country; an Indian one never needs to.
        ...(shipTo.country && shipTo.country !== 'IN' ? [countryName(shipTo.country)] : []),
      ],
    ])
  }
  if (shipTo && o.shippingRateName && !compact) {
    rows.push([
      content.details.delivery,
      [
        content.shippingLine(
          o.shippingRateName,
          o.shippingPaise > 0 ? formatPaise(o.shippingPaise) : content.shippingFree,
        ),
      ],
    ])
  }

  return (
    <dl className="grid gap-x-6 gap-y-5 text-[0.875rem] sm:grid-cols-2">
      {rows.map(([label, lines]) => (
        <div key={label} className="flex min-w-0 flex-col gap-1">
          <dt className="text-[0.8125rem] text-ck-muted">{label}</dt>
          {lines.map((line) => (
            <dd key={line} className="text-ck-ink [overflow-wrap:anywhere]">
              {line}
            </dd>
          ))}
        </div>
      ))}
    </dl>
  )
}
