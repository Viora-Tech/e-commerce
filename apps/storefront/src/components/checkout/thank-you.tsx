import { formatPaise } from '@commerce/blocks'
import type { order, orderLine, payment } from '@commerce/db'
import type { CheckoutSession } from '@commerce/payments'
import { thankYouContent as content } from '@/data/checkout'
import { retryPaymentAction } from '@/lib/cart-actions'
import ManualPaymentInstructions from './manual-payment-instructions'

type ThankYouTemplateProps = {
  storeId: string
  order: typeof order.$inferSelect
  lines: (typeof orderLine.$inferSelect)[]
  /** The latest gateway, COD or transfer attempt; undefined when gift cards paid everything. */
  payment: typeof payment.$inferSelect | undefined
  /** Gift cards spent on the order. */
  giftCards?: { id: string; last: string; amountPaise: number }[]
  /** Links from installed apps, e.g. a signed invoice download. */
  links?: { label: string; url: string }[]
}

/** "+₹49.00" / "−₹99.98" for the fee or discount row. */
const formatSigned = (paise: number): string =>
  `${paise < 0 ? '−' : '+'}${formatPaise(Math.abs(paise))}`

/** Attempts still waiting on the shopper or the gateway. */
const OPEN_STATUSES: ReadonlySet<string> = new Set(['created', 'pending', 'authorized'])

function statusLine(
  method: string | null,
  awaiting: boolean,
  manual: boolean,
  total: string,
  failed: boolean,
): string {
  if (method === 'gift_card') return content.status.giftCard
  if (failed) return content.status.failed(total)
  if (manual) return content.status.manual
  if (method === 'cod') return content.status.cod(total)
  if (awaiting) return content.status.awaiting(total)
  return content.status.paid(total)
}

export default function ThankYouTemplate({
  storeId,
  order: o,
  lines,
  payment: pay,
  giftCards = [],
  links = [],
}: ThankYouTemplateProps) {
  const awaiting = o.paymentMethod !== 'cod' && OPEN_STATUSES.has(pay?.status ?? '')
  // The latest attempt failed on an order that is still open: offer a new attempt.
  const failed = o.status === 'placed' && (pay?.status === 'failed' || pay?.status === 'cancelled')
  const session = (pay?.checkoutSession ?? null) as CheckoutSession | null
  const manual = awaiting && session?.kind === 'manual' ? session.instructions : null
  const total = formatPaise(o.totalPaise)
  // What the shopper still pays after gift cards: the amount COD, transfer and gateway lines quote.
  const due = formatPaise(pay?.amountPaise ?? o.totalPaise)
  const status = statusLine(o.paymentMethod, awaiting, manual !== null, due, failed)
  const boughtCards = lines.length > 0 && lines.every((l) => l.giftCard)

  return (
    <section className="section-cart page-width">
      <div className="cart-empty">
        <h1 className="cart-empty__heading h2">{content.heading(o.number)}</h1>
        <p className="cart-empty__text text-body">
          {status}{' '}
          {boughtCards ? content.status.giftCardEmail(o.email) : content.confirmation(o.email)}
        </p>
        {manual ? <ManualPaymentInstructions instructions={manual} amountLabel={due} /> : null}
        <ul className="cart-items__list thank-you__lines">
          {lines.map((l) => (
            <li key={l.id} className="cart-summary__row">
              <span>
                {content.lineTitle(l.title, l.variantTitle)} x {l.quantity}
              </span>
              <span>{formatPaise(l.quantity * l.unitPricePaise)}</span>
            </li>
          ))}
          {o.discountPaise > 0 ? (
            <li className="cart-summary__row cart-summary__row--discount">
              <span>{o.discountLabel ?? content.discount}</span>
              <span>−{formatPaise(o.discountPaise)}</span>
            </li>
          ) : null}
          {o.shippingPaise > 0 || o.shippingRateName ? (
            <li className="cart-summary__row">
              <span>{content.shippingRow(o.shippingRateName)}</span>
              <span>
                {o.shippingPaise > 0 ? formatPaise(o.shippingPaise) : content.shippingFree}
              </span>
            </li>
          ) : null}
          {o.paymentAdjustmentPaise !== 0 ? (
            <li className="cart-summary__row">
              <span>
                {o.paymentAdjustmentLabel ?? content.adjustmentFallback(o.paymentAdjustmentPaise)}
              </span>
              <span>{formatSigned(o.paymentAdjustmentPaise)}</span>
            </li>
          ) : null}
          <li className="cart-summary__row cart-summary__row--total">
            <span>{content.total}</span>
            <span>{total}</span>
          </li>
          {giftCards.map((g) => (
            <li key={g.id} className="cart-summary__row cart-summary__row--discount">
              <span>{content.giftCardPaid(g.last)}</span>
              <span>−{formatPaise(g.amountPaise)}</span>
            </li>
          ))}
        </ul>
        {links.map((l) => (
          <a key={l.url} href={l.url} className="btn btn--secondary">
            {l.label}
          </a>
        ))}
        {failed ? (
          <form action={retryPaymentAction.bind(null, storeId, o.number)}>
            <button type="submit" className="btn btn--primary">
              {content.retryPayment}
            </button>
          </form>
        ) : null}
        {awaiting && session?.kind === 'client' ? (
          <a href={`/checkout/pay/${o.number}`} className="btn btn--primary">
            {content.payNow}
          </a>
        ) : null}
        <a href="/" className="btn btn--secondary btn--pill cart-empty__cta">
          {content.continueShopping}
        </a>
      </div>
    </section>
  )
}
