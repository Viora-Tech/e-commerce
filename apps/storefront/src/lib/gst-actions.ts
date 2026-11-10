'use server'

import 'server-only'

import { type CartGstPreview, previewCartGst } from '@commerce/core'
import { headers } from 'next/headers'
import { checkoutCartId } from './checkout-context'
import { clientIp, rateLimited } from './rate-limit'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

const GST_RULE = { limit: 60, windowMs: 60_000 }

/**
 * Checkout summary: the GST inside what the shopper is about to pay for the cart in the
 * cookie. The store comes from the hostname and the lines and rates from the database; the
 * client only says what it is showing as the total, the reduction and the state. Display only:
 * placing the order works the tax out again.
 */
export async function checkoutGstAction(input: {
  totalPaise: number
  reductionPaise: number
  stateCode: string | null
}): Promise<CartGstPreview | null> {
  const storeId = await requestStoreId()
  const cartId = await checkoutCartId()
  if (!cartId) return null
  // Display only and called as the total changes: 60 a minute per visitor is plenty.
  if (!(await rateLimited('checkout-gst:ip', clientIp(await headers()), GST_RULE)).ok) return null
  const total = Number.isFinite(input.totalPaise) ? Math.round(input.totalPaise) : 0
  const reduction = Number.isFinite(input.reductionPaise) ? Math.round(input.reductionPaise) : 0
  const state =
    typeof input.stateCode === 'string' && input.stateCode.length <= 4 ? input.stateCode : null
  return inStore(storeId, (tx) =>
    previewCartGst(tx, storeId, {
      cartId,
      totalPaise: total,
      reductionPaise: reduction,
      shipToState: state,
    }),
  )
}
