'use server'

import {
  type CodeRejection,
  checkDiscountCode,
  resolveCartDiscount,
  setCartDiscountCode,
} from '@commerce/core'
import { revalidatePath } from 'next/cache'
import { readCartId } from './cart-cookie'
import { inStore } from './store-context'

export type DiscountActionResult = { ok: true } | { ok: false; reason: CodeRejection }

/** What the cart or checkout summary shows for the discount in force. */
export type CartDiscountView = {
  label: string
  code: string | null
  amountPaise: number
  freeShipping: boolean
  /** Set when the saved code no longer works, so the UI can say so and drop it. */
  codeRejected: CodeRejection | null
}

/** Try a code against the cart and keep it when it works. Never reveals why a code is unknown. */
export async function applyDiscountAction(
  storeId: string,
  code: string,
): Promise<DiscountActionResult> {
  const cartId = await readCartId()
  if (!cartId) return { ok: false, reason: 'invalid' }
  const result = await inStore(storeId, async (tx) => {
    const ctx = { storeId, tx }
    const check = await checkDiscountCode(ctx, cartId, code)
    if (check.ok) await setCartDiscountCode(ctx, cartId, code)
    return check
  })
  if (!result.ok) return { ok: false, reason: result.reason }
  revalidatePath('/cart')
  revalidatePath('/checkout')
  return { ok: true }
}

export async function removeDiscountAction(storeId: string): Promise<void> {
  const cartId = await readCartId()
  if (!cartId) return
  await inStore(storeId, (tx) => setCartDiscountCode({ storeId, tx }, cartId, null))
  revalidatePath('/cart')
  revalidatePath('/checkout')
}

/** Server-side read used by the cart and checkout pages to render the summary. */
export async function cartDiscountView(
  storeId: string,
  cartId: string,
  code: string | null,
): Promise<CartDiscountView | null> {
  const { outcome, codeRejected } = await inStore(storeId, (tx) =>
    resolveCartDiscount({ storeId, tx }, cartId, code),
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
