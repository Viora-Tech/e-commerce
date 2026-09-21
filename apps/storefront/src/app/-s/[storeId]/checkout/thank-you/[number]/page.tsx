import { order, orderLine, payment } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ThankYouTemplate } from '@/components/checkout/thank-you'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string; number: string }> }

export default async function ThankYouPage({ params }: Params) {
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
  return <ThankYouTemplate order={data.order} lines={data.lines} payment={data.pay} />
}
