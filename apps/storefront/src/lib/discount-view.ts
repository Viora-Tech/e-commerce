import 'server-only'

import { type CodeRejection, resolveCartDiscount } from '@commerce/core'
import { currentCustomer } from './customer-session'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

/*
 * The cart/checkout discount summary, read while the page renders. Kept out of the
 * 'use server' actions file (`discount-actions.ts`), where every export is an endpoint the
 * browser can call with any cart id (security audit 2026-09-28 branch, ported 2026-10-06).
 */

/** What the cart or checkout summary shows for the discount in force. */
export type CartDiscountView = {
  label: string
  code: string | null
  amountPaise: number
  freeShipping: boolean
  /** Set when the saved code no longer works, so the UI can say so and drop it. */
  codeRejected: CodeRejection | null
}

/** Server-side read used by the cart and checkout pages to render the summary. */
export async function cartDiscountView(
  cartId: string,
  code: string | null,
): Promise<CartDiscountView | null> {
  const storeId = await requestStoreId()
  // A signed-in shopper is known before checkout, so discounts limited to customers or
  // segments show (or drop) for them on the cart already; guests are checked at checkout.
  const me = await currentCustomer(storeId)
  const { outcome, codeRejected } = await inStore(storeId, (tx) =>
    resolveCartDiscount({ storeId, tx }, cartId, code, { email: me?.email }),
  )
  if (!outcome) return codeRejected ? emptyRejected(codeRejected) : null
  return {
    label: outcome.label,
    code: outcome.discount.code,
    amountPaise: outcome.amountPaise,
    freeShipping: outcome.freeShipping,
    codeRejected,
  }
}

function emptyRejected(reason: CodeRejection): CartDiscountView {
  return { label: '', code: null, amountPaise: 0, freeShipping: false, codeRejected: reason }
}
