'use server'

import {
  addToCart,
  CodPaymentProvider,
  createCart,
  FakePaymentProvider,
  getCart,
  placeOrder,
  setLineQuantity,
} from '@commerce/core'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { clearCartId, readCartId, writeCartId } from './cart-cookie'
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
  payment: 'cod' | 'online'
}

export async function checkoutAction(storeId: string, form: CheckoutForm) {
  const cartId = await readCartId()
  if (!cartId) redirect('/cart')
  const provider = form.payment === 'cod' ? new CodPaymentProvider() : new FakePaymentProvider()
  const result = await inStore(storeId, (tx) =>
    placeOrder(
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
    ),
  )
  await clearCartId()
  redirect(`/checkout/thank-you/${result.orderNumber}`)
}
