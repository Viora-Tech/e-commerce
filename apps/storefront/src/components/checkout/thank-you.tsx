import { formatPaise } from '@commerce/blocks'
import type { order, orderLine, payment } from '@commerce/db'
import type { CheckoutSession } from '@commerce/payments'
import { thankYouContent as content } from '@/data/checkout'
import ManualPaymentInstructions from './manual-payment-instructions'

type ThankYouTemplateProps = {
  order: typeof order.$inferSelect
  lines: (typeof orderLine.$inferSelect)[]
  payment: typeof payment.$inferSelect | undefined
}

/** "+₹49.00" / "−₹99.98" for the fee or discount row. */
const formatSigned = (paise: number): string =>
  `${paise < 0 ? '−' : '+'}${formatPaise(Math.abs(paise))}`

function statusLine(
  method: string | null,
  awaiting: boolean,
  manual: boolean,
  total: string,
): string {
  if (manual) return content.status.manual
  if (method === 'cod') return content.status.cod(total)
  if (awaiting) return content.status.awaiting(total)
  return content.status.paid(total)
}

export default function ThankYouTemplate({ order: o, lines, payment: pay }: ThankYouTemplateProps) {
  const awaiting = o.paymentMethod !== 'cod' && pay?.status === 'pending'
  const session = (pay?.checkoutSession ?? null) as CheckoutSession | null
  const manual = awaiting && session?.kind === 'manual' ? session.instructions : null
  const total = formatPaise(o.totalPaise)
  const status = statusLine(o.paymentMethod, awaiting, manual !== null, total)

  return (
    <section className="section-cart page-width">
      <div className="cart-empty">
        <h1 className="cart-empty__heading h2">{content.heading(o.number)}</h1>
        <p className="cart-empty__text text-body">
          {status} {content.confirmation(o.email)}
        </p>
        {manual ? <ManualPaymentInstructions instructions={manual} amountLabel={total} /> : null}
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
        </ul>
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
