import { OPEN_ATTEMPT_STATUSES } from '@commerce/core/order-status'
import { settingsSecret } from '@commerce/config'
import { orderViewToken, thankYouPath, verifyBalanceToken } from '@commerce/core'
import { order, payment } from '@commerce/db'
import type { CheckoutSession } from '@commerce/payments'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import BalanceDue from '@/components/checkout/balance-due'
import { balanceContent as content } from '@/data/checkout'
import { balanceView, storePreorderPolicy } from '@/lib/preorder'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string; token: string }> }

/**
 * The signed "pay your balance" link from a balance request or reminder. The
 * token is an HMAC over the order id and an expiry, so a guessed id opens
 * nothing. A balance already paid (or an order cancelled) lands on the order's
 * thank-you page, which says where it stands.
 */
export default async function PayBalancePage({ params }: Params) {
  const { storeId, token } = await params
  const verified = verifyBalanceToken(token, settingsSecret())
  const data = verified.ok
    ? await inStore(storeId, async (tx) => {
        const [o] = await tx.select().from(order).where(eq(order.id, verified.orderId))
        if (!o) return null
        const [open] = await tx
          .select({ session: payment.checkoutSession })
          .from(payment)
          .where(
            and(
              eq(payment.orderId, o.id),
              eq(payment.purpose, 'balance'),
              inArray(payment.status, [...OPEN_ATTEMPT_STATUSES]),
            ),
          )
          .orderBy(desc(payment.attempt))
          .limit(1)
        return {
          number: o.number,
          orderId: o.id,
          balance: balanceView(o, await storePreorderPolicy(tx, storeId)),
          session: (open?.session ?? null) as CheckoutSession | null,
        }
      })
    : null

  if (data && !data.balance) {
    const secret = settingsSecret()
    redirect(thankYouPath(data.number, orderViewToken(data.orderId, secret)))
  }

  return (
    <section className="section-cart page-width">
      <div className="cart-empty">
        {data?.balance ? (
          <>
            <h1 className="cart-empty__heading h2">{content.pageTitle(data.number)}</h1>
            <BalanceDue orderNumber={data.number} balance={data.balance} session={data.session} />
          </>
        ) : (
          <p className="cart-empty__text text-body">{content.unavailable}</p>
        )}
      </div>
    </section>
  )
}
