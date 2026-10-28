import { settingsSecret } from '@commerce/config'
import { orderViewToken, storeCheckoutLook, thankYouPath, verifyBalanceToken } from '@commerce/core'
import { OPEN_ATTEMPT_STATUSES } from '@commerce/core/order-status'
import { order, payment } from '@commerce/db'
import type { CheckoutSession } from '@commerce/payments'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import CheckoutBalance from '@/components/checkout/checkout-balance'
import CheckoutShell from '@/components/checkout/checkout-shell'
import { balanceContent as content } from '@/data/checkout'
import { CK_HEADING } from '@/lib/checkout-classes'
import { withThemeLogo } from '@/lib/checkout-look'
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

  const look = await withThemeLogo(
    storeId,
    await inStore(storeId, (tx) => storeCheckoutLook({ tx, storeId })),
  )
  return (
    <CheckoutShell look={look} backHref="/" backLabel={content.back}>
      {data?.balance ? (
        <div className="flex flex-col gap-6">
          <h1 className={`${CK_HEADING} text-[1.75rem]!`}>{content.pageTitle(data.number)}</h1>
          <CheckoutBalance
            orderNumber={data.number}
            viewToken={orderViewToken(data.orderId, settingsSecret())}
            balance={data.balance}
            session={data.session}
          />
        </div>
      ) : (
        <p className="rounded-ck bg-ck-soft px-4 py-3 text-[0.9375rem] text-ck-ink">
          {content.unavailable}
        </p>
      )}
    </CheckoutShell>
  )
}
