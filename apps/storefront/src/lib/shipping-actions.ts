'use server'

import 'server-only'

import type { DeliveryEstimate } from '@commerce/core'
import { headers } from 'next/headers'
import { deliveryEstimateContent } from '@/data/product'
import { readCartId } from './cart-cookie'
import { clientIp, rateLimited } from './rate-limit'
import { requestStoreId } from './request-store'
import { type CheckoutShipping, checkoutShipping, estimateForPincode } from './shipping'
import { inStore } from './store-context'

/**
 * Each estimate can reach the courier's API on the store's own account; per IP, so nobody
 * burns the store's courier quota from a script (security audit 2026-09-28 branch, ported
 * 2026-10-06).
 */
const ESTIMATE_IP_RULE = { limit: 30, windowMs: 60_000 }

/** Product page "check delivery" widget. The store comes from the hostname, never the client. */
export async function estimateDeliveryAction(pincode: string): Promise<DeliveryEstimate> {
  const storeId = await requestStoreId()
  const limit = await rateLimited(
    'delivery-estimate:ip',
    `${storeId}:${clientIp(await headers())}`,
    ESTIMATE_IP_RULE,
  )
  if (!limit.ok) return { ok: false, error: deliveryEstimateContent.rateLimited }
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
