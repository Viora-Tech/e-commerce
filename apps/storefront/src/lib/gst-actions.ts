'use server'

import 'server-only'

import { type CartGstPreview, previewCartGst } from '@commerce/core'
import { checkoutCartId } from './checkout-context'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

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
