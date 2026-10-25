import { loadEnv } from '@commerce/config'
import {
  payPath as buildPayPath,
  canViewOrder,
  GIFT_CARD_PROVIDER,
  installedApps,
  orderParcelsView,
  orderViewToken,
  storeCheckoutLook,
  storefrontOriginFor,
  variantImageUrls,
  verifyOrderViewToken,
} from '@commerce/core'
import { OPEN_ATTEMPT_STATUSES } from '@commerce/core/order-status'
import { purchaseEventId } from '@commerce/core/pixels'
import { getRegistries } from '@commerce/core/registries'
import { address, giftCard, order, orderLine, payment, withStore } from '@commerce/db'
import type { CheckoutSession } from '@commerce/payments'
import { eq, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import ExperimentBeacon from '@/components/analytics/experiment-beacon'
import PixelTrack from '@/components/analytics/pixel-track'
import CheckoutBalance from '@/components/checkout/checkout-balance'
import ThankYouTemplate from '@/components/checkout/thank-you'
import { currentCustomer } from '@/lib/customer-session'
import { db } from '@/lib/db'
import { experimentsEnabled, requestExperiments } from '@/lib/experiments'
import { shopperParcels } from '@/lib/parcels'
import { balanceView, storePreorderPolicy } from '@/lib/preorder'
import { inStore } from '@/lib/store-context'

/** Attempts still waiting on the shopper or the gateway. */
const OPEN_STATUSES: ReadonlySet<string> = new Set(OPEN_ATTEMPT_STATUSES)

type Params = {
  params: Promise<{ storeId: string; number: string }>
  searchParams: Promise<{ t?: string }>
}

export default async function ThankYouPage({ params, searchParams }: Params) {
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
    // Either a signed-in customer who owns the order, or a valid, unguessable
    // per-order token — never the sequential order number alone.
    const ownedBySession = !!me && o.customerId === me.id
    const verified = token ? verifyOrderViewToken(token, env.SETTINGS_SECRET) : null
    const validForThisOrder = !!verified?.ok && verified.orderId === o.id
    if (!ownedBySession && !validForThisOrder) return null
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
    // The latest checkout attempt: a failed one offers "Retry payment".
    const newest = (a: (typeof pays)[number], b: (typeof pays)[number]) =>
      b.attempt - a.attempt || (b.id > a.id ? 1 : -1)
    const pay = pays
      .filter((p) => p.provider !== GIFT_CARD_PROVIDER && p.purpose === 'order')
      .sort(newest)[0]
    // A deposit pre-order's balance, with its open attempt (a transfer shows its instructions).
    const balance = balanceView(o, await storePreorderPolicy(tx, storeId))
    const balanceAttempt = pays
      .filter((p) => p.purpose === 'balance' && OPEN_STATUSES.has(p.status))
      .sort(newest)[0]
    const variantIds = lines.flatMap((l) => (l.variantId ? [l.variantId] : []))
    const images = await variantImageUrls({ storeId, tx }, variantIds)
    const look = await storeCheckoutLook({ storeId, tx })
    const [shipTo] = o.shippingAddressId
      ? await tx.select().from(address).where(eq(address.id, o.shippingAddressId))
      : []
    return {
      order: o,
      lines,
      pay,
      giftCards,
      balance,
      balanceAttempt,
      images,
      look,
      shipTo: shipTo ?? null,
      parcels: shopperParcels(await orderParcelsView(tx, o.id)),
    }
  })

  if (!data) notFound()
  // Links installed apps add, e.g. a signed "Download invoice".
  const links = await getRegistries().orderLinks(
    await installedApps(db(), storeId),
    {
      storeId,
      inStore: (fn) => withStore(db(), storeId, fn),
      settingsSecret: env.SETTINGS_SECRET,
      // Links apps build open on this store's own domain (STOREFRONT_URL is the fallback).
      storefrontUrl: await inStore(storeId, (tx) =>
        storefrontOriginFor(tx, storeId, env.STOREFRONT_URL),
      ),
      surface: 'storefront',
    },
    data.order.id,
  )
  // Reuses the incoming token when it is valid for this order, so "Pay now" doesn't mint a
  // fresh token on every render; a signed-in owner without one (or with a stale one) gets a
  // new one. The page's actions prove access with it (`lib/order-access.ts`).
  const tokenFits =
    !!token &&
    canViewOrder(
      { id: data.order.id, customerId: null },
      { customerId: null, token },
      env.SETTINGS_SECRET,
    )
  const payToken = tokenFits ? token : orderViewToken(data.order.id, env.SETTINGS_SECRET)
  // A purchase for the store's A/B tests (the GrowthBook app), after a yes to analytics.
  const measured =
    (await requestExperiments(storeId)).visitorId !== null && (await experimentsEnabled(storeId))
  return (
    <>
      {measured ? <ExperimentBeacon order={data.order.id} /> : null}
      {/* Pixels app: the browser Purchase (ord_<orderId>); test orders never count. */}
      {data.order.isTest ? null : (
        <PixelTrack
          event={{
            name: 'Purchase',
            eventId: purchaseEventId(data.order.id),
            valuePaise: data.order.totalPaise,
            contentIds: data.lines.flatMap((l) => (l.variantId ? [l.variantId] : [])),
            numItems: data.lines.reduce((n, l) => n + l.quantity, 0),
          }}
        />
      )}
      <ThankYouTemplate
        viewToken={payToken}
        order={data.order}
        lines={data.lines}
        payment={data.pay}
        giftCards={data.giftCards}
        links={links}
        payPath={buildPayPath(data.order.number, payToken)}
        look={data.look}
        images={data.images}
        shipTo={data.shipTo}
        parcels={data.parcels}
        balance={
          data.balance ? (
            <CheckoutBalance
              orderNumber={data.order.number}
              viewToken={payToken}
              balance={data.balance}
              session={data.balanceAttempt?.checkoutSession as CheckoutSession | null | undefined}
            />
          ) : null
        }
      />
    </>
  )
}
