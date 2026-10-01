'use server'

import 'server-only'

import type { DeliveryEstimate } from '@commerce/core'
import { readCartId } from './cart-cookie'
import { requestStoreId } from './request-store'
import { type CheckoutShipping, checkoutShipping, estimateForPincode } from './shipping'
import { inStore } from './store-context'

/** Product page "check delivery" widget. The store comes from the hostname, never the client. */
export async function estimateDeliveryAction(pincode: string): Promise<DeliveryEstimate> {
  const storeId = await requestStoreId()
  return inStore(storeId, (tx) => estimateForPincode(tx, storeId, pincode))
}

/** Checkout: the courier's answer and the shipping choices for the cart in the cookie. */
export async function checkoutShippingAction(to: {
  pincode: string
  stateCode: string
}): Promise<CheckoutShipping | null> {
  const storeId = await requestStoreId()
  const cartId = await readCartId()
  if (!cartId) return null
  return inStore(storeId, (tx) => checkoutShipping(tx, storeId, cartId, to))
}
