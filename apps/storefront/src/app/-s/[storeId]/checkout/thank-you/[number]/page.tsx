import { formatPaise } from '@commerce/blocks'
import { order, orderLine, payment } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string; number: string }> }

export default async function ThankYou({ params }: Params) {
  const { storeId, number } = await params
  const data = await inStore(storeId, async (tx) => {
    const [o] = await tx
      .select()
      .from(order)
      .where(eq(order.number, Number(number)))
    if (!o) return null
    const lines = await tx.select().from(orderLine).where(eq(orderLine.orderId, o.id))
    const [pay] = await tx.select().from(payment).where(eq(payment.orderId, o.id))
    return { order: o, lines, pay }
  })
  if (!data) notFound()
  const { order: o, lines, pay } = data
  const awaiting = o.paymentMethod !== 'cod' && pay?.status === 'pending'

  return (
    <section className="section-cart page-width">
      <div className="cart-empty">
        <h1 className="cart-empty__heading h2">Thank you, order #{o.number} is in</h1>
        <p className="cart-empty__text text-body">
          {o.paymentMethod === 'cod'
            ? `Pay ${formatPaise(o.totalPaise)} in cash when it arrives. `
            : awaiting
              ? `We are confirming your payment of ${formatPaise(o.totalPaise)}. `
              : `Payment of ${formatPaise(o.totalPaise)} received. `}
          A confirmation is on its way to {o.email}.
        </p>
        <ul className="cart-items__list thank-you__lines">
          {lines.map((l) => (
            <li key={l.id} className="cart-summary__row">
              <span>
                {l.title}
                {l.variantTitle && l.variantTitle !== 'Default' ? ` / ${l.variantTitle}` : ''} x{' '}
                {l.quantity}
              </span>
              <span>{formatPaise(l.quantity * l.unitPricePaise)}</span>
            </li>
          ))}
        </ul>
        {awaiting ? (
          <a href={`/checkout/pay/${o.number}`} className="btn btn--primary">
            Pay now
          </a>
        ) : null}
        <a href="/" className="btn btn--secondary btn--pill cart-empty__cta">
          Continue shopping
        </a>
      </div>
    </section>
  )
}
