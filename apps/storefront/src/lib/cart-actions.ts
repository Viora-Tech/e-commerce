'use server'

import {
  addToCart,
  confirmClientPayment,
  createCart,
  getCart,
  placeOrder,
  setLineQuantity,
} from '@commerce/core'
import { payment } from '@commerce/db'
import type { ClientConfirmation } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { checkoutContent } from '@/data/checkout'
import { clearCartId, readCartId, writeCartId } from './cart-cookie'
import { notify } from './notifications'
import { storePaymentProviders } from './payments'
import { estimateForPincode } from './shipping'
import { inStore } from './store-context'

/** Server actions for the cart. The store id comes from the page's route param, never the client. */

export async function addLineAction(storeId: string, variantId: string, quantity: number) {
  const existing = await readCartId()
  const cartId = await inStore(storeId, async (tx) => {
    const ctx = { storeId, tx }
    let id = existing
    const current = id ? await getCart(ctx, id) : null
    if (current?.status !== 'open') id = await createCart(ctx)
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
}

export type CheckoutResult = { error: string } | undefined

/**
 * Place the order. Returns `{ error }` for things the shopper can fix (an
 * unserviceable PIN code, COD where the courier will not collect); throws
 * for everything else; redirects on success.
 */
export async function checkoutAction(storeId: string, form: CheckoutForm): Promise<CheckoutResult> {
  const cartId = await readCartId()
  if (!cartId) redirect('/cart')

  // The courier's word on the destination, never the client's. A cached answer makes this cheap.
  const delivery = await inStore(storeId, (tx) => estimateForPincode(tx, storeId, form.pincode))
  if (!delivery.ok) return { error: delivery.error }
  if (!delivery.serviceable)
    return { error: checkoutContent.errors.unserviceable(delivery.pincode) }
  if (form.payment === 'cod' && !delivery.codAvailable) {
    return { error: checkoutContent.errors.codUnavailable }
  }

  const result = await inStore(storeId, async (tx) => {
    const providers = await storePaymentProviders(tx, storeId)
    const provider = providers.find((p) => p.id === form.payment)
    if (!provider) throw new Error(`payment method ${form.payment} is not enabled`)
    return placeOrder(
      { storeId, tx },
      {
        cartId,
        paymentProvider: provider,
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
  })
  await clearCartId()
  await notify({ storeId, orderId: result.orderId, template: 'order_placed' })
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
