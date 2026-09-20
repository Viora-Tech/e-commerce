import { formatPaise } from '@commerce/blocks'
import { order, orderLine } from '@commerce/db'
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
    return { order: o, lines }
  })
  if (!data) notFound()
  const { order: o, lines } = data

  return (
    <section className="section-cart page-width">
      <div className="cart-empty">
        <h1 className="cart-empty__heading h2">Thank you, order #{o.number} is in</h1>
        <p className="cart-empty__text text-body">
          {o.paymentMethod === 'cod'
            ? `Pay ${formatPaise(o.totalPaise)} in cash when it arrives. `
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
        <a href="/" className="btn btn--secondary btn--pill cart-empty__cta">
          Continue shopping
        </a>
      </div>
    </section>
  )
}
