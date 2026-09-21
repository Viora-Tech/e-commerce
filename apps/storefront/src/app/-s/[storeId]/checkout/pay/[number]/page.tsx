import { order, payment } from '@commerce/db'
import type { CheckoutSession } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { inStore } from '@/lib/store-context'
import { PayClient } from './pay-client'

type Params = { params: Promise<{ storeId: string; number: string }> }

export default async function PayPage({ params }: Params) {
  const { storeId, number } = await params
  const data = await inStore(storeId, async (tx) => {
    const [o] = await tx
      .select()
      .from(order)
      .where(eq(order.number, Number(number)))
    if (!o) return null
    const [p] = await tx.select().from(payment).where(eq(payment.orderId, o.id))
    return p ? { order: o, payment: p } : null
  })
  if (!data) notFound()
  if (data.payment.status === 'captured') redirect(`/checkout/thank-you/${number}`)
  const session = data.payment.checkoutSession as CheckoutSession | null
  if (session?.kind !== 'client') redirect(`/checkout/thank-you/${number}`)
  return (
    <PayClient
      storeId={storeId}
      orderNumber={data.order.number}
      session={session}
      amountPaise={data.payment.amountPaise}
    />
  )
}
