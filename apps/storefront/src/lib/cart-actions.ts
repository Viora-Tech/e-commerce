'use server'

import 'server-only'

import { settingsSecret } from '@commerce/config'
import {
  addToCart,
  captureCartContact,
  confirmClientPayment,
  createCart,
  findRedeemableGiftCard,
  getCart,
  onOrderPlaced,
  orderViewToken,
  PaymentNotRetryable,
  type PlaceOrderResult,
  PreorderMixedCart,
  payOnlineInstead,
  payPath,
  placeOrderAndPay,
  rememberCheckoutAddress,
  retryAndStartPayment,
  setCartAttribution,
  setLineQuantity,
  syncOpenQrAttempt,
  thankYouPath,
} from '@commerce/core'
import { checkoutCountry, isAbroad } from '@commerce/core/checkout-address'
import { CONSENT_COOKIE, currentConsent, decodeConsent } from '@commerce/core/consent'
import { collectorStore, withdrawCartMarketingConsent } from '@commerce/core/pixels/server'
import { order, type ParcelDeliveryEstimate, payment } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import type { ClientConfirmation } from '@commerce/payments'
import { and, desc, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { cartContent } from '@/data/cart'
import { checkoutContent } from '@/data/checkout'
import { readAttribution } from './attribution-cookie'
import { clearCartId, readCartId, writeCartId } from './cart-cookie'
import { checkoutCartId } from './checkout-context'
import { checkoutErrorMessage } from './checkout-errors'
import { currentCustomer } from './customer-session'
import { db } from './db'
import { deliveryForOrder } from './delivery-options'
import { discoveryVisitor, recordDiscoveryCartAdd } from './discovery-events'
import { hasChatCookie, postChatCartLine } from './inbox'
import { requestMarketId } from './market-catalog'
import { accessibleOrderId } from './order-access'
import { redirectToOrderPage } from './order-view-cookie'
import { nudgeOutbox } from './outbox'
import { payOnlineGateway, storePaymentFallbacks, storePaymentProviders } from './payments'
import { clientIp, rateLimited } from './rate-limit'
import { requestStoreId } from './request-store'
import { noteAbAddToCart } from './rollout-ab'
import { cartShippingHint, checkoutParcels, estimateForPincode } from './shipping'
import { storeSignIn } from './sign-in-methods'
import { inStore } from './store-context'

const CHECKOUT_CART_RULE = { limit: 10, windowMs: 60_000 }
const CHECKOUT_IP_RULE = { limit: 30, windowMs: 60_000 }
const PAYMENT_RETRY_IP_RULE = { limit: 20, windowMs: 60_000 }
/** The QR page checks every 15 s; a tap on "I've paid" adds a few more. */
const QR_CHECK_ORDER_RULE = { limit: 8, windowMs: 60_000 }

/** Server actions for the cart. The store id comes from the request's hostname, never the client. */

/**
 * Add to cart. A refusal the shopper can act on comes back as `{ error }` (server action errors
 * lose their words in production): a pre-order campaign that keeps its pre-orders apart (#143).
 */
export async function addLineAction(
  variantId: string,
  quantity: number,
): Promise<{ error: string } | undefined> {
  const storeId = await requestStoreId()
  const existing = await readCartId()
  const attribution = await readAttribution()
  // The market this page is in: the cart keeps it, and its catalog decides what may go in.
  const marketId = await requestMarketId()
  let cartId: string
  try {
    cartId = await inStore(storeId, async (tx) => {
      const ctx = { storeId, tx }
      let id = existing
      const current = id ? await getCart(ctx, id) : null
      if (current?.status !== 'open') {
        id = await createCart(ctx)
        await setCartAttribution(tx, id, attribution)
      }
      await addToCart(ctx, id as string, variantId, Math.max(1, quantity), { marketId })
      return id as string
    })
  } catch (err) {
    if (err instanceof PreorderMixedCart) {
      return { error: err.shopperMessage ?? cartContent.preorderMixedCart }
    }
    throw err
  }
  if (cartId !== existing) await writeCartId(cartId)
  await chatCartLine(storeId, cartId, 'add', variantId, Math.max(1, quantity))
  // A/B rollouts: the visitor's first add to cart counts for the arm they are in.
  await noteAbAddToCart(storeId)
  // Search & discovery: an add after a search result or recommendation click, after the response.
  const visitor = await discoveryVisitor()
  if (visitor) after(() => recordDiscoveryCartAdd(storeId, visitor, variantId))
  revalidatePath('/', 'layout')
  return undefined
}

/** The cart line as Inbox shows it (title from the cart itself), only for a browser that chatted. */
async function chatCartLine(
  storeId: string,
  cartId: string,
  action: 'add' | 'remove' | 'quantity',
  variantId: string,
  quantity: number,
  title?: string,
) {
  if (!(await hasChatCookie())) return
  const name =
    title ??
    (await inStore(storeId, (tx) => getCart({ storeId, tx }, cartId)))?.lines.find(
      (l) => l.variantId === variantId,
    )?.productTitle ??
    ''
  await postChatCartLine(storeId, { action, variantId, title: name, quantity, cartId })
}

/**
 * The cart's count and total for an imported Shopify theme's script (its `/cart.js`
 * call is answered from our cart; field names are the ones theme scripts read).
 */
export async function cartCountAction() {
  const storeId = await requestStoreId()
  const cartId = await readCartId()
  const cart = cartId ? await inStore(storeId, (tx) => getCart({ storeId, tx }, cartId)) : null
  const open = cart?.status === 'open' ? cart : null
  return { item_count: open?.itemCount ?? 0, total_price: open?.subtotalPaise ?? 0, items: [] }
}

/** The cart drawer's contents (Theme settings → Cart → Drawer): lines, subtotal, free shipping. */
export async function cartDrawerAction() {
  const storeId = await requestStoreId()
  const cartId = await readCartId()
  return inStore(storeId, async (tx) => {
    const cart = cartId ? await getCart({ storeId, tx }, cartId) : null
    const open = cart?.status === 'open' ? cart : null
    const hint = await cartShippingHint(tx, open?.id ?? null)
    return {
      lines: (open?.lines ?? []).map((l) => ({
        id: l.id,
        // The variant and one unit's price: a market catalog's fixed price prices the line.
        variantId: l.variantId,
        unitPricePaise: l.unitPricePaise,
        handle: l.productHandle,
        title: l.productTitle,
        variantTitle: l.variantTitle === 'Default' ? null : l.variantTitle,
        quantity: l.quantity,
        linePaise: l.linePaise,
        imageUrl: l.imageUrl,
        available: l.available,
      })),
      itemCount: open?.itemCount ?? 0,
      subtotalPaise: open?.subtotalPaise ?? 0,
      freeAbovePaise: hint.freeAbovePaise,
    }
  })
}

export async function setQuantityAction(lineId: string, quantity: number) {
  const storeId = await requestStoreId()
  const cartId = await readCartId()
  if (!cartId) return
  const line = (await hasChatCookie())
    ? (await inStore(storeId, (tx) => getCart({ storeId, tx }, cartId)))?.lines.find(
        (l) => l.id === lineId,
      )
    : undefined
  await inStore(storeId, (tx) => setLineQuantity({ storeId, tx }, cartId, lineId, quantity))
  if (line) {
    await chatCartLine(
      storeId,
      cartId,
      quantity <= 0 ? 'remove' : 'quantity',
      line.variantId,
      quantity,
      line.productTitle,
    )
  }
  revalidatePath('/cart')
  revalidatePath('/', 'layout')
}

export type CheckoutForm = {
  /** The full name; with Settings → Checkout splitting it (#154), its parts come too. */
  name: string
  firstName?: string
  lastName?: string
  email: string
  phone: string
  line1: string
  line2: string
  city: string
  /** An Indian state code; abroad, the state, province or region as typed (may be blank). */
  stateCode: string
  /** A PIN code in India; the postcode abroad. */
  pincode: string
  /** ISO 3166-1 country of the address; left out means India. */
  countryCode?: string
  payment: string
  /** Gift card codes applied in the summary; each is re-checked here before it is spent. */
  giftCards?: string[]
  /** The shipping rate picked in the summary; re-priced on the server. */
  shippingRate?: string
  /**
   * Delivery options app: the quote the cards came from, the sub-choice ("Blue Dart Air") and
   * the insurance tick. Priced on the server from the quote snapshot, never from the client.
   */
  deliveryQuote?: { quoteId: string; routeKey: string | null; insured: boolean }
  /** Business buyer's GSTIN and name, when the store shows the field (Settings → Checkout). */
  gstin?: string
  businessName?: string
  /** Order note, when the store turned notes on. */
  note?: string
  /** Home, Office or Other: the tag a signed-in shopper's new address is saved with. */
  label?: string
  /** The marketing ticks under Contact; unticked sends nothing. */
  marketing?: { email: boolean; whatsapp: boolean }
}

export type CheckoutResult = { error: string } | undefined

/**
 * Remember who is checking out before the order exists. Without this a cart
 * that is left behind is anonymous and cannot be recovered; with it the
 * merchant can email the shopper their basket back.
 */
export async function captureContactAction(contact: {
  email?: string
  phone?: string
  name?: string
}) {
  const storeId = await requestStoreId()
  const cartId = await checkoutCartId()
  if (!cartId) return
  await inStore(storeId, (tx) => captureCartContact({ storeId, tx }, cartId, contact))
}

/**
 * Place the order. Returns `{ error }` for things the shopper can fix (an
 * unserviceable PIN code, COD where the courier will not collect); throws
 * for everything else; redirects on success.
 */
export async function checkoutAction(submitted: CheckoutForm): Promise<CheckoutResult> {
  const storeId = await requestStoreId()
  const cartId = await checkoutCartId()
  if (!cartId) redirect('/cart')
  const ip = clientIp(await headers())
  const [byCart, byIp] = await Promise.all([
    rateLimited('checkout-submit:cart', cartId, CHECKOUT_CART_RULE),
    rateLimited('checkout-submit:ip', ip, CHECKOUT_IP_RULE),
  ])
  if (!byCart.ok || !byIp.ok) return { error: checkoutContent.errors.rateLimited }
  // Signed in: the order belongs to the session's customer, whatever email the form carried.
  // A customer who signs in by mobile and has no email yet may type one.
  const me = await currentCustomer(storeId)
  if (!me && (await storeSignIn(storeId)).checkout === 'account_required') {
    redirect('/account/login?return_to=%2Fcheckout')
  }
  const form = me ? { ...submitted, email: me.email ?? submitted.email } : submitted

  /* Contact first: if anything below fails the cart is still recoverable. The latest
     marketing touch rides along so the order credits the email or ad that closed it. */
  const attribution = await readAttribution()
  const consent = decodeConsent((await cookies()).get(CONSENT_COOKIE)?.value)
  await inStore(storeId, async (tx) => {
    await captureCartContact({ storeId, tx }, cartId, {
      email: form.email,
      phone: form.phone,
      name: form.name,
    })
    await setCartAttribution(tx, cartId, attribution)
    // Pixels: a marketing yes taken back on the banner keeps the order's server Purchase off.
    const { bannerVersion } = await collectorStore(tx, storeId)
    const marketing = currentConsent(consent, bannerVersion)?.marketing === true
    await withdrawCartMarketingConsent(tx, cartId, marketing, new Date())
  })

  // Gift cards are emailed, so a basket of only gift cards has nothing to ship.
  const current = await inStore(storeId, (tx) => getCart({ storeId, tx }, cartId))
  const digitalOnly = !!current?.lines.length && current.lines.every((l) => l.giftCard)
  // An address abroad is priced by its country zone: no Indian courier, no COD (placeOrder agrees).
  const countryCode = checkoutCountry(form.countryCode)
  const abroad = isAbroad(countryCode)
  if (abroad && form.payment === 'cod') return { error: checkoutContent.errors.codAbroad }

  /** The delivery window each warehouse's parcel was shown with, stored on the order's parcels. */
  let deliveryEstimates: Record<string, ParcelDeliveryEstimate> = {}
  /* Delivery options app: the snapshot's courier answers price the order (placeOrder checks the
     option still covers the PIN code and refuses COD on a prepaid-only option). */
  const to = { pincode: form.pincode, stateCode: form.stateCode }
  const appQuote = form.deliveryQuote
  const delivery =
    !digitalOnly && !abroad && appQuote && form.shippingRate
      ? await inStore(storeId, (tx) =>
          deliveryForOrder(tx, storeId, cartId, to, {
            quoteId: typeof appQuote.quoteId === 'string' ? appQuote.quoteId : null,
            optionId: form.shippingRate as string,
            routeKey: typeof appQuote.routeKey === 'string' ? appQuote.routeKey : null,
            insured: appQuote.insured !== false,
          }),
        )
      : null
  if (!digitalOnly && delivery) {
    const parcels = await inStore(storeId, (tx) => checkoutParcels(tx, storeId, cartId, to)).catch(
      () => [],
    )
    deliveryEstimates = Object.fromEntries(
      parcels.flatMap((p) => (p.estimate ? [[p.locationId, p.estimate] as const] : [])),
    )
  } else if (!digitalOnly && !abroad) {
    // The courier's word on the destination, never the client's. A cached answer makes this cheap.
    const delivery = await inStore(storeId, (tx) => estimateForPincode(tx, storeId, form.pincode))
    if (!delivery.ok) return { error: delivery.error }
    if (!delivery.serviceable)
      return { error: checkoutContent.errors.unserviceable(delivery.pincode) }
    if (form.payment === 'cod' && !delivery.codAvailable) {
      return { error: checkoutContent.errors.codUnavailable }
    }
    const parcels = await inStore(storeId, (tx) =>
      checkoutParcels(tx, storeId, cartId, { pincode: form.pincode, stateCode: form.stateCode }),
    ).catch(() => [])
    deliveryEstimates = Object.fromEntries(
      parcels.flatMap((p) => (p.estimate ? [[p.locationId, p.estimate] as const] : [])),
    )
  }

  /* The order and its stock are committed first; the gateway is asked after
     that, so a slow gateway never holds stock locks. A gateway failure leaves
     the order placed and the shopper retries from the thank-you page. */
  const placed = await inStore(storeId, async (tx) => {
    const providers = await storePaymentProviders(tx, storeId)
    const provider = providers.find((p) => p.id === form.payment)
    if (!provider) throw new Error(`payment method ${form.payment} is not enabled`)
    // Several gateways on: who to try next if this one cannot open the payment.
    const fallbacks = await storePaymentFallbacks(tx, storeId, providers, provider.id)
    const giftCardIds: string[] = []
    for (const code of form.giftCards ?? []) {
      giftCardIds.push((await findRedeemableGiftCard({ storeId, tx }, code)).id)
    }
    return { provider, fallbacks, giftCardIds }
  })
    .then(({ provider, fallbacks, giftCardIds }) =>
      placeOrderAndPay(db(), storeId, {
        cartId,
        paymentProvider: provider,
        paymentFallbacks: fallbacks,
        giftCardIds,
        // A delivery option id is not a rate row: the app prices it instead.
        shippingRateId: delivery ? null : form.shippingRate || null,
        ...(delivery ? { delivery } : {}),
        deliveryEstimates,
        secret: settingsSecret(),
        checkout: {
          name: form.name,
          ...(typeof form.firstName === 'string'
            ? { firstName: form.firstName, lastName: form.lastName ?? '' }
            : {}),
          email: form.email,
          phone: form.phone,
          gstin: form.gstin ?? null,
          businessName: form.businessName ?? null,
          note: form.note ?? null,
          marketing: form.marketing,
          address: {
            line1: form.line1,
            ...(form.line2 ? { line2: form.line2 } : {}),
            city: form.city,
            stateCode: form.stateCode,
            pincode: form.pincode,
            countryCode,
          },
        },
      }),
    )
    .catch((err: unknown) => {
      const refused = checkoutErrorMessage(err, form.pincode)
      if (refused === null) throw err
      return { error: refused }
    })
  if ('error' in placed) return { error: placed.error }
  const result = placed
  await clearCartId()
  // A second submit of the same cart got the first order back: it was already
  // announced (the outbox row, if any, was written on the first submit only:
  // `placeOrder` returns early on replay, before the workflow step that writes
  // order.placed ever runs).
  if (result.replayed) return await redirectAfterCheckout(result)
  // The address book holds Indian addresses (PIN codes); an address abroad is not added to it.
  if (me && !abroad) {
    // Convenience only: never let the address book block an order that is already placed.
    await inStore(storeId, (tx) => rememberCheckoutAddress({ storeId, tx }, me.id, form)).catch(
      (err) => logger.error('could not save the checkout address', { storeId, error: err }),
    )
  }
  // Marketing: end the sequences this order converts and start the order automations.
  await inStore(storeId, (tx) => onOrderPlaced(tx, storeId, result.orderId)).catch((err) =>
    logger.error('could not update marketing automations', {
      storeId,
      orderId: result.orderId,
      error: err,
    }),
  )
  // order_placed (and payment_received when paid at checkout: gift cards,
  // capture-at-creation gateways) were already written to the outbox in the
  // same transaction as the order/payment change (placeOrder, applyPaymentStatus).
  // This only wakes the relay so they go out in ~1s instead of up to 5s.
  await nudgeOutbox(storeId)
  await redirectAfterCheckout(result)
}

/** Open the gateway, or go straight to the thank-you page (which offers a retry when the gateway failed). */
async function redirectAfterCheckout(
  result: Pick<PlaceOrderResult, 'session' | 'orderNumber' | 'orderId'>,
): Promise<never> {
  const token = orderViewToken(result.orderId, settingsSecret())
  if (result.session?.kind === 'client') {
    return redirectToOrderPage(payPath(result.orderNumber, token))
  }
  if (result.session?.kind === 'redirect') redirect(result.session.url)
  return redirectToOrderPage(thankYouPath(result.orderNumber, token))
}

/**
 * "Retry payment" after a failed attempt: a new attempt on the same order,
 * with the same amount and gateway, then back to the gateway. Two taps make
 * one attempt; the order and its stock are untouched.
 */
export async function retryPaymentAction(orderNumber: number, viewToken: string | null) {
  const storeId = await requestStoreId()
  // The caller must own the order or hold its view token: every exit below mints a fresh
  // one, which opens the order to whoever holds it (security audit 2026-10-06, A-00).
  const orderId = await accessibleOrderId(storeId, orderNumber, viewToken)
  // No order, or not theirs: the untokened link, which a stranger cannot open.
  if (!orderId) redirect(`/checkout/thank-you/${orderNumber}`)
  const oid: string = orderId
  const backToThankYou = (): Promise<never> =>
    redirectToOrderPage(thankYouPath(orderNumber, orderViewToken(oid, settingsSecret())))
  const ip = clientIp(await headers())
  const [byIp, byOrder] = await Promise.all([
    rateLimited('payment-retry:ip', ip, PAYMENT_RETRY_IP_RULE),
    rateLimited('payment-retry:order', `${storeId}:${orderNumber}`, PAYMENT_RETRY_IP_RULE),
  ])
  // No error slot on this action's return type: over the limit lands back on
  // the thank-you page, same as a retry that turns out not to be needed.
  if (!byIp.ok || !byOrder.ok) await backToThankYou()
  const target = await inStore(storeId, async (tx) => {
    const [latest] = await tx
      .select({ provider: payment.provider })
      .from(payment)
      .where(and(eq(payment.orderId, oid), ne(payment.provider, 'gift_card')))
      .orderBy(desc(payment.attempt), desc(payment.id))
      .limit(1)
    const providers = await storePaymentProviders(tx, storeId)
    const provider = providers.find((p) => p.id === latest?.provider)
    return provider ?? null
  })
  if (!target) {
    return redirectToOrderPage(thankYouPath(orderNumber, orderViewToken(oid, settingsSecret())))
  }
  const started = await retryAndStartPayment(db(), storeId, oid, target).catch((err: unknown) => {
    // Paid or cancelled meanwhile: the thank-you page shows where the order stands.
    if (err instanceof PaymentNotRetryable) return null
    throw err
  })
  // payment_received was already written to the outbox, in the same
  // transaction as the capture (applyPaymentStatus, via startPaymentAttempt).
  if (started?.becameCaptured) await nudgeOutbox(storeId)
  await redirectAfterCheckout({ session: started?.session ?? null, orderNumber, orderId: oid })
}

/**
 * "Pay online instead" on a transfer order's page (issue 1010): the open UPI / bank transfer
 * attempt gives way to one on the store's gateway, then on to the gateway as checkout does.
 * Same access rule and rate limit as "Retry payment"; a store without an online gateway, or an
 * order paid or cancelled meanwhile, lands back on the order page.
 */
export async function payOnlineAction(orderNumber: number, viewToken: string | null) {
  const storeId = await requestStoreId()
  const orderId = await accessibleOrderId(storeId, orderNumber, viewToken)
  if (!orderId) redirect(`/checkout/thank-you/${orderNumber}`)
  const oid: string = orderId
  const backToThankYou = (): Promise<never> =>
    redirectToOrderPage(thankYouPath(orderNumber, orderViewToken(oid, settingsSecret())))
  const ip = clientIp(await headers())
  const [byIp, byOrder] = await Promise.all([
    rateLimited('payment-retry:ip', ip, PAYMENT_RETRY_IP_RULE),
    rateLimited('payment-retry:order', `${storeId}:${orderNumber}`, PAYMENT_RETRY_IP_RULE),
  ])
  if (!byIp.ok || !byOrder.ok) await backToThankYou()
  const gateway = await inStore(storeId, async (tx) => {
    const [o] = await tx.select({ isTest: order.isTest }).from(order).where(eq(order.id, oid))
    return payOnlineGateway(tx, storeId, o?.isTest ?? false)
  })
  if (!gateway) return backToThankYou()
  const started = await payOnlineInstead(db(), storeId, oid, gateway.provider).catch(
    (err: unknown) => {
      if (err instanceof PaymentNotRetryable) return null
      throw err
    },
  )
  if (started?.becameCaptured) await nudgeOutbox(storeId)
  await redirectAfterCheckout({ session: started?.session ?? null, orderNumber, orderId: oid })
}

/**
 * The UPI QR page asks: has this QR been paid? Checks the gateway directly, so
 * the order turns paid even when its webhook is late or not set up. True once
 * paid; the page then refreshes to the paid state.
 */
export async function checkQrPaymentAction(orderNumber: number, viewToken: string | null) {
  const storeId = await requestStoreId()
  const limited = await rateLimited(
    'qr-check:order',
    `${storeId}:${orderNumber}`,
    QR_CHECK_ORDER_RULE,
  )
  if (!limited.ok) return false
  // Only for whoever can see the order: a stranger learns nothing about it and cannot make
  // us call the gateway for it (security audit 2026-10-06, A-00).
  const orderId = await accessibleOrderId(storeId, orderNumber, viewToken)
  if (!orderId) return false
  const target = await inStore(storeId, async (tx) => {
    const o = { id: orderId }
    const [latest] = await tx
      .select({ provider: payment.provider })
      .from(payment)
      .where(and(eq(payment.orderId, o.id), ne(payment.provider, 'gift_card')))
      .orderBy(desc(payment.attempt), desc(payment.id))
      .limit(1)
    const providers = await storePaymentProviders(tx, storeId)
    const provider = providers.find((p) => p.id === latest?.provider)
    return provider ? { orderId: o.id, provider } : null
  })
  if (!target) return false
  const applied = await syncOpenQrAttempt(db(), storeId, target.orderId, target.provider)
  if (applied?.becameCaptured) await nudgeOutbox(storeId)
  return applied?.payment.status === 'captured'
}

/** Browser posts the gateway's confirmation after a client-side checkout. */
export async function confirmPaymentAction(providerRef: string, confirmation: ClientConfirmation) {
  const storeId = await requestStoreId()
  const applied = await inStore(storeId, async (tx) => {
    const [p] = await tx.select().from(payment).where(eq(payment.providerRef, providerRef))
    if (!p) return null
    const providers = await storePaymentProviders(tx, storeId)
    const provider = providers.find((x) => x.id === p.provider)
    if (!provider) return null
    return confirmClientPayment({ storeId, tx }, provider, providerRef, confirmation)
  })
  // payment_received was already written to the outbox inside `inStore`
  // above, in the same transaction as the capture (applyPaymentStatus).
  if (applied?.becameCaptured) await nudgeOutbox(storeId)
  return applied?.payment.status ?? null
}
