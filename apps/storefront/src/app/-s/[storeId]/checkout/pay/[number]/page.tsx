import { loadEnv } from '@commerce/config'
import { orderViewToken, thankYouPath, verifyOrderViewToken } from '@commerce/core'
import { order, payment } from '@commerce/db'
import type { CheckoutSession } from '@commerce/payments'
import { and, desc, eq, ne } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { currentCustomer } from '@/lib/customer-session'
import { inStore } from '@/lib/store-context'
import PayClient from './pay-client'

type Params = {
  params: Promise<{ storeId: string; number: string }>
  searchParams: Promise<{ t?: string }>
}

export default async function PayPage({ params, searchParams }: Params) {
  const { storeId, number } = await params
  const { t: token } = await searchParams
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
    return p ? { order: o, payment: p } : null
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
    <PayClient
      orderNumber={data.order.number}
      session={session}
      amountPaise={data.payment.amountPaise}
      thankYouPath={thankYou}
    />
  )
}
