import { loadEnv } from '@commerce/config'
import { GIFT_CARD_PROVIDER, installedApps } from '@commerce/core'
import { getRegistries } from '@commerce/core/registries'
import { giftCard, order, orderLine, payment, withStore } from '@commerce/db'
import { eq, inArray } from 'drizzle-orm'
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
    const pays = await tx.select().from(payment).where(eq(payment.orderId, o.id))
    const cardPays = pays.filter((p) => p.provider === GIFT_CARD_PROVIDER)
    const cardIds = cardPays.map((p) => p.providerPaymentId).filter((id): id is string => !!id)
    const cards = cardIds.length
      ? await tx
          .select({ id: giftCard.id, last: giftCard.lastCharacters })
          .from(giftCard)
          .where(inArray(giftCard.id, cardIds))
      : []
    const giftCards = cardPays.map((p) => ({
      id: p.id,
      last: cards.find((c) => c.id === p.providerPaymentId)?.last ?? '',
      amountPaise: p.amountPaise,
    }))
    const pay = pays.find((p) => p.provider !== GIFT_CARD_PROVIDER)
    return { order: o, lines, pay, giftCards }
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
  return (
    <ThankYouTemplate
      order={data.order}
      lines={data.lines}
      payment={data.pay}
      giftCards={data.giftCards}
      links={links}
    />
  )
}
