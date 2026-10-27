import { loadEnv } from '@commerce/config'
import {
  orderViewToken,
  storeCheckoutLook,
  thankYouPath,
  variantImageUrls,
  verifyOrderViewToken,
} from '@commerce/core'
import { order, orderLine, payment } from '@commerce/db'
import type { CheckoutSession } from '@commerce/payments'
import { and, desc, eq, ne } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import CheckoutShell from '@/components/checkout/checkout-shell'
import OrderSummary from '@/components/checkout/order-summary'
import { payClientContent } from '@/data/checkout'
import { currentCustomer } from '@/lib/customer-session'
import { orderPageToken } from '@/lib/order-view-cookie'
import { inStore } from '@/lib/store-context'
import PayClient from './pay-client'

type Params = {
  params: Promise<{ storeId: string; number: string }>
  searchParams: Promise<{ t?: string }>
}

export default async function PayPage({ params, searchParams }: Params) {
  const { storeId, number } = await params
  // The proxy moved `?t=` into a cookie for this page (`lib/order-token-swap.ts`).
  const token = await orderPageToken((await searchParams).t)
  const env = loadEnv(process.env)
  const me = await currentCustomer(storeId)
  const data = await inStore(storeId, async (tx) => {
    const [o] = await tx
      .select()
      .from(order)
      .where(eq(order.number, Number(number)))
    if (!o) return null
    const ownedBySession = !!me && o.customerId === me.id
    const verified = token ? verifyOrderViewToken(token, env.SETTINGS_SECRET) : null
    const validForThisOrder = !!verified?.ok && verified.orderId === o.id
    if (!ownedBySession && !validForThisOrder) return null
    // The latest gateway attempt; gift card payments on the same order are already captured.
    const [p] = await tx
      .select()
      .from(payment)
      .where(and(eq(payment.orderId, o.id), ne(payment.provider, 'gift_card')))
      .orderBy(desc(payment.attempt), desc(payment.id))
      .limit(1)
    if (!p) return null
    // What is being paid for, beside the payment: the shopper should not pay blind (owner, 27 Oct).
    const lines = await tx.select().from(orderLine).where(eq(orderLine.orderId, o.id))
    const variantIds = lines.flatMap((l) => (l.variantId ? [l.variantId] : []))
    const images = await variantImageUrls({ storeId, tx }, variantIds)
    return { order: o, payment: p, lines, images, look: await storeCheckoutLook({ storeId, tx }) }
  })

  if (!data) notFound()
  const backToken = token ?? orderViewToken(data.order.id, env.SETTINGS_SECRET)
  const thankYou = thankYouPath(data.order.number, backToken)
  // Paid, or the attempt failed (the thank-you page offers "Retry payment").
  if (['captured', 'failed', 'cancelled'].includes(data.payment.status)) {
    redirect(thankYou)
  }
  const session = data.payment.checkoutSession as CheckoutSession | null
  if (session?.kind !== 'client') redirect(thankYou)
  return (
    <CheckoutShell
      look={data.look}
      backHref={thankYou}
      backLabel={payClientContent.back}
      summary={
        <OrderSummary order={data.order} lines={data.lines} images={data.images} giftCards={[]} />
      }
    >
      <PayClient
        orderNumber={data.order.number}
        session={session}
        amountPaise={data.payment.amountPaise}
        thankYouPath={thankYou}
      />
    </CheckoutShell>
  )
}
