import { loadEnv } from '@commerce/config'
import { installedApps } from '@commerce/core'
import { getRegistries } from '@commerce/core/registries'
import { order, orderLine, payment, withStore } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import ThankYouTemplate from '@/components/checkout/thank-you'
import { db } from '@/lib/db'
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
  const env = loadEnv(process.env)
  // Links installed apps add, e.g. a signed "Download invoice".
  const links = await getRegistries().orderLinks(
    await installedApps(db(), storeId),
    {
      storeId,
      inStore: (fn) => withStore(db(), storeId, fn),
      settingsSecret: env.SETTINGS_SECRET,
      storefrontUrl: env.STOREFRONT_URL ?? null,
      surface: 'storefront',
    },
    data.order.id,
  )
  return <ThankYouTemplate order={data.order} lines={data.lines} payment={data.pay} links={links} />
}
