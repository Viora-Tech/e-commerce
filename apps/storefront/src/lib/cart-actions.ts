'use server'

import 'server-only'

import { loadEnv } from '@commerce/config'
import {
  addToCart,
  captureCartContact,
  confirmClientPayment,
  createCart,
  DiscountUnavailable,
  findRedeemableGiftCard,
  GiftCardError,
  getCart,
  onOrderPlaced,
  orderViewToken,
  PaymentNotRetryable,
  type PlaceOrderResult,
  payPath,
  placeOrderAndPay,
  rememberCheckoutAddress,
  retryAndStartPayment,
  ShippingRateUnavailable,
  ShippingUnavailable,
  setCartAttribution,
  setLineQuantity,
  thankYouPath,
} from '@commerce/core'
import { order, payment } from '@commerce/db'
import type { ClientConfirmation } from '@commerce/payments'
import { and, desc, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { checkoutContent } from '@/data/checkout'
import { readAttribution } from './attribution-cookie'
import { clearCartId, readCartId, writeCartId } from './cart-cookie'
import { currentCustomer } from './customer-session'
import { db } from './db'
import { nudgeOutbox } from './outbox'
import { storePaymentProviders } from './payments'
import { clientIp, rateLimited } from './rate-limit'
import { estimateForPincode } from './shipping'
import { inStore } from './store-context'

const CHECKOUT_CART_RULE = { limit: 10, windowMs: 60_000 }
const CHECKOUT_IP_RULE = { limit: 30, windowMs: 60_000 }
const PAYMENT_RETRY_IP_RULE = { limit: 20, windowMs: 60_000 }

/** Server actions for the cart. The store id comes from the page's route param, never the client. */

export async function addLineAction(storeId: string, variantId: string, quantity: number) {
  const existing = await readCartId()
  const attribution = await readAttribution()
  const cartId = await inStore(storeId, async (tx) => {
    const ctx = { storeId, tx }
    let id = existing
    const current = id ? await getCart(ctx, id) : null
    if (current?.status !== 'open') {
      id = await createCart(ctx)
      await setCartAttribution(tx, id, attribution)
    }
    await addToCart(ctx, id as string, variantId, Math.max(1, quantity))
    return id as string
  })
  if (cartId !== existing) await writeCartId(cartId)
  revalidatePath('/', 'layout')
}

export async function setQuantityAction(storeId: string, lineId: string, quantity: number) {
  const cartId = await readCartId()
  if (!cartId) return
  await inStore(storeId, (tx) => setLineQuantity({ storeId, tx }, cartId, lineId, quantity))
  revalidatePath('/cart')
  revalidatePath('/', 'layout')
}

export type CheckoutForm = {
  name: string
  email: string
  phone: string
  line1: string
  line2: string
  city: string
  stateCode: string
  pincode: string
  payment: string
  /** Gift card codes applied in the summary; each is re-checked here before it is spent. */
  giftCards?: string[]
  /** The shipping rate picked in the summary; re-priced on the server. */
  shippingRate?: string
}

export type CheckoutResult = { error: string } | undefined

/**
 * Remember who is checking out before the order exists. Without this a cart
 * that is left behind is anonymous and cannot be recovered; with it the
 * merchant can email the shopper their basket back.
 */
export async function captureContactAction(
  storeId: string,
  contact: { email?: string; phone?: string; name?: string },
) {
  const cartId = await readCartId()
  if (!cartId) return
  await inStore(storeId, (tx) => captureCartContact({ storeId, tx }, cartId, contact))
}

/**
 * Place the order. Returns `{ error }` for things the shopper can fix (an
 * unserviceable PIN code, COD where the courier will not collect); throws
 * for everything else; redirects on success.
 */
export async function checkoutAction(
  storeId: string,
  submitted: CheckoutForm,
): Promise<CheckoutResult> {
  const cartId = await readCartId()
  if (!cartId) redirect('/cart')
  const ip = clientIp(await headers())
  const [byCart, byIp] = await Promise.all([
    rateLimited('checkout-submit:cart', cartId, CHECKOUT_CART_RULE),
    rateLimited('checkout-submit:ip', ip, CHECKOUT_IP_RULE),
  ])
  if (!byCart.ok || !byIp.ok) return { error: checkoutContent.errors.rateLimited }
  // Signed in: the order belongs to the session's customer, whatever email the form carried.
  const me = await currentCustomer(storeId)
  const form = me ? { ...submitted, email: me.email } : submitted

  /* Contact first: if anything below fails the cart is still recoverable. The latest
     marketing touch rides along so the order credits the email or ad that closed it. */
  const attribution = await readAttribution()
  await inStore(storeId, async (tx) => {
    await captureCartContact({ storeId, tx }, cartId, {
      email: form.email,
      phone: form.phone,
      name: form.name,
    })
    await setCartAttribution(tx, cartId, attribution)
  })

  // Gift cards are emailed, so a basket of only gift cards has nothing to ship.
  const current = await inStore(storeId, (tx) => getCart({ storeId, tx }, cartId))
  const digitalOnly = !!current?.lines.length && current.lines.every((l) => l.giftCard)

  if (!digitalOnly) {
    // The courier's word on the destination, never the client's. A cached answer makes this cheap.
    const delivery = await inStore(storeId, (tx) => estimateForPincode(tx, storeId, form.pincode))
    if (!delivery.ok) return { error: delivery.error }
    if (!delivery.serviceable)
      return { error: checkoutContent.errors.unserviceable(delivery.pincode) }
    if (form.payment === 'cod' && !delivery.codAvailable) {
      return { error: checkoutContent.errors.codUnavailable }
    }
  }

  /* The order and its stock are committed first; the gateway is asked after
     that, so a slow gateway never holds stock locks. A gateway failure leaves
     the order placed and the shopper retries from the thank-you page. */
  const placed = await inStore(storeId, async (tx) => {
    const providers = await storePaymentProviders(tx, storeId)
    const provider = providers.find((p) => p.id === form.payment)
    if (!provider) throw new Error(`payment method ${form.payment} is not enabled`)
    const giftCardIds: string[] = []
    for (const code of form.giftCards ?? []) {
      giftCardIds.push((await findRedeemableGiftCard({ storeId, tx }, code)).id)
    }
    return { provider, giftCardIds }
  })
    .then(({ provider, giftCardIds }) =>
      placeOrderAndPay(db(), storeId, {
        cartId,
        paymentProvider: provider,
        giftCardIds,
        shippingRateId: form.shippingRate || null,
        secret: loadEnv(process.env).SETTINGS_SECRET,
        checkout: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: {
            line1: form.line1,
            ...(form.line2 ? { line2: form.line2 } : {}),
            city: form.city,
            stateCode: form.stateCode,
            pincode: form.pincode,
          },
        },
      }),
    )
    .catch((err: unknown) => {
      // Gift card rules (spent elsewhere, COD for the rest, a card in a mixed basket) are the shopper's to fix.
      if (err instanceof GiftCardError) return { error: err.message }
      // Another checkout took the last use of the code; the next submit prices without it.
      if (err instanceof DiscountUnavailable)
        return { error: checkoutContent.errors.discountUnavailable }
      // Rates are the store's to set; the shopper can only change the address or re-pick.
      if (err instanceof ShippingUnavailable)
        return { error: checkoutContent.errors.noShipping(form.pincode) }
      if (err instanceof ShippingRateUnavailable)
        return { error: checkoutContent.errors.rateChanged }
      throw err
    })
  if ('error' in placed) return { error: placed.error }
  const result = placed
  await clearCartId()
  // A second submit of the same cart got the first order back: it was already
  // announced (the outbox row, if any, was written on the first submit only:
  // `placeOrder` returns early on replay, before the workflow step that writes
  // order.placed ever runs).
  if (result.replayed) return redirectAfterCheckout(result)
  if (me) {
    // Convenience only: never let the address book block an order that is already placed.
    await inStore(storeId, (tx) => rememberCheckoutAddress({ storeId, tx }, me.id, form)).catch(
      (err) => console.error('[checkout] could not save address', err),
    )
  }
  // Marketing: end the sequences this order converts and start the order automations.
  await inStore(storeId, (tx) => onOrderPlaced(tx, storeId, result.orderId)).catch((err) =>
    console.error('[checkout] could not update marketing automations', err),
  )
  // order_placed (and payment_received when paid at checkout: gift cards,
  // capture-at-creation gateways) were already written to the outbox in the
  // same transaction as the order/payment change (placeOrder, applyPaymentStatus).
  // This only wakes the relay so they go out in ~1s instead of up to 5s.
  await nudgeOutbox(storeId)
  redirectAfterCheckout(result)
}

/** Open the gateway, or go straight to the thank-you page (which offers a retry when the gateway failed). */
function redirectAfterCheckout(
  result: Pick<PlaceOrderResult, 'session' | 'orderNumber' | 'orderId'>,
): never {
  const token = orderViewToken(result.orderId, loadEnv(process.env).SETTINGS_SECRET)
  if (result.session?.kind === 'client') redirect(payPath(result.orderNumber, token))
  if (result.session?.kind === 'redirect') redirect(result.session.url)
  redirect(thankYouPath(result.orderNumber, token))
}

/**
 * "Retry payment" after a failed attempt: a new attempt on the same order,
 * with the same amount and gateway, then back to the gateway. Two taps make
 * one attempt; the order and its stock are untouched.
 */
export async function retryPaymentAction(storeId: string, orderNumber: number) {
  // Looked up before the rate-limit check too, so every exit (including a
  // rate-limited one) can still land on a validly-tokened thank-you link.
  const orderId = await inStore(storeId, async (tx) => {
    const [o] = await tx.select({ id: order.id }).from(order).where(eq(order.number, orderNumber))
    return o?.id ?? null
  })
  // No order: nothing to tell apart from a stray order number, so the
  // fallback (untokened) link is fine — the page 404s on it either way.
  if (!orderId) redirect(`/checkout/thank-you/${orderNumber}`)
  const oid: string = orderId
  const backToThankYou = (): never =>
    redirect(thankYouPath(orderNumber, orderViewToken(oid, loadEnv(process.env).SETTINGS_SECRET)))
  const ip = clientIp(await headers())
  const [byIp, byOrder] = await Promise.all([
    rateLimited('payment-retry:ip', ip, PAYMENT_RETRY_IP_RULE),
    rateLimited('payment-retry:order', String(orderNumber), PAYMENT_RETRY_IP_RULE),
  ])
  // No error slot on this action's return type: over the limit lands back on
  // the thank-you page, same as a retry that turns out not to be needed.
  if (!byIp.ok || !byOrder.ok) backToThankYou()
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
    redirect(thankYouPath(orderNumber, orderViewToken(oid, loadEnv(process.env).SETTINGS_SECRET)))
  }
  const started = await retryAndStartPayment(db(), storeId, oid, target).catch((err: unknown) => {
    // Paid or cancelled meanwhile: the thank-you page shows where the order stands.
    if (err instanceof PaymentNotRetryable) return null
    throw err
  })
  // payment_received was already written to the outbox, in the same
  // transaction as the capture (applyPaymentStatus, via startPaymentAttempt).
  if (started?.becameCaptured) await nudgeOutbox(storeId)
  redirectAfterCheckout({ session: started?.session ?? null, orderNumber, orderId: oid })
}

/** Browser posts the gateway's confirmation after a client-side checkout. */
export async function confirmPaymentAction(
  storeId: string,
  providerRef: string,
  confirmation: ClientConfirmation,
) {
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
