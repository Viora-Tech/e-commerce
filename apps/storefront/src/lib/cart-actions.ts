'use server'

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
  placeOrder,
  rememberCheckoutAddress,
  setCartAttribution,
  setLineQuantity,
} from '@commerce/core'
import { payment } from '@commerce/db'
import type { ClientConfirmation } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { checkoutContent } from '@/data/checkout'
import { readAttribution } from './attribution-cookie'
import { clearCartId, readCartId, writeCartId } from './cart-cookie'
import { currentCustomer } from './customer-session'
import { notify } from './notifications'
import { storePaymentProviders } from './payments'
import { estimateForPincode } from './shipping'
import { inStore } from './store-context'

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

  const placed = await inStore(storeId, async (tx) => {
    const providers = await storePaymentProviders(tx, storeId)
    const provider = providers.find((p) => p.id === form.payment)
    if (!provider) throw new Error(`payment method ${form.payment} is not enabled`)
    const giftCardIds: string[] = []
    for (const code of form.giftCards ?? []) {
      giftCardIds.push((await findRedeemableGiftCard({ storeId, tx }, code)).id)
    }
    return placeOrder(
      { storeId, tx },
      {
        cartId,
        paymentProvider: provider,
        giftCardIds,
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
      },
    )
  }).catch((err: unknown) => {
    // Gift card rules (spent elsewhere, COD for the rest, a card in a mixed basket) are the shopper's to fix.
    if (err instanceof GiftCardError) return { error: err.message }
    // Another checkout took the last use of the code; the next submit prices without it.
    if (err instanceof DiscountUnavailable)
      return { error: checkoutContent.errors.discountUnavailable }
    throw err
  })
  if ('error' in placed) return { error: placed.error }
  const result = placed
  await clearCartId()
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
  await notify({ storeId, orderId: result.orderId, template: 'order_placed' })
  // Paid in full at checkout (gift cards): the paid path issues cards and sends the receipt.
  if (result.paymentStatus === 'captured') {
    await notify({ storeId, orderId: result.orderId, template: 'payment_received' })
  }
  if (result.session.kind === 'client') redirect(`/checkout/pay/${result.orderNumber}`)
  if (result.session.kind === 'redirect') redirect(result.session.url)
  redirect(`/checkout/thank-you/${result.orderNumber}`)
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
  if (applied?.becameCaptured) {
    await notify({ storeId, orderId: applied.payment.orderId, template: 'payment_received' })
  }
  return applied?.payment.status ?? null
}
