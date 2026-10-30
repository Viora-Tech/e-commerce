'use server'

import 'server-only'

import type { DeliveryEstimate } from '@commerce/core'
import { checkoutCountry } from '@commerce/core/checkout-address'
import { headers } from 'next/headers'
import { deliveryEstimateContent } from '@/data/product'
import { checkoutCartId } from './checkout-context'
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
export async function checkoutShippingAction(
  /** `countryCode` abroad (ISO 3166-1); left out means India. */
  to: { pincode: string; stateCode: string; countryCode?: string | undefined },
  /** Delivery options app: the insurance tick, and the quote to reuse the answers of. */
  opts: { declineInsurance?: boolean; quoteId?: string | null } = {},
): Promise<CheckoutShipping | null> {
  const storeId = await requestStoreId()
  const cartId = await checkoutCartId()
  if (!cartId) return null
  const quoteId =
    typeof opts.quoteId === 'string' && /^[0-9a-f-]{36}$/.test(opts.quoteId) ? opts.quoteId : null
  const address = {
    pincode: String(to.pincode).slice(0, 20),
    stateCode: String(to.stateCode).slice(0, 80),
    countryCode: checkoutCountry(to.countryCode),
  }
  return inStore(storeId, (tx) =>
    checkoutShipping(tx, storeId, cartId, address, {
      declineInsurance: opts.declineInsurance === true,
      quoteId,
    }),
  )
}
