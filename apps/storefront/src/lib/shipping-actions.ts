'use server'

import type { DeliveryEstimate } from '@commerce/core'
import { readCartId } from './cart-cookie'
import { type CheckoutShipping, checkoutShipping, estimateForPincode } from './shipping'
import { inStore } from './store-context'

/** Product page "check delivery" widget. The store id comes from the route, never the client. */
export async function estimateDeliveryAction(
  storeId: string,
  pincode: string,
): Promise<DeliveryEstimate> {
  return inStore(storeId, (tx) => estimateForPincode(tx, storeId, pincode))
}

/** Checkout: the courier's answer and the shipping choices for the cart in the cookie. */
export async function checkoutShippingAction(
  storeId: string,
  to: { pincode: string; stateCode: string },
): Promise<CheckoutShipping | null> {
  const cartId = await readCartId()
  if (!cartId) return null
  return inStore(storeId, (tx) => checkoutShipping(tx, storeId, cartId, to))
}
