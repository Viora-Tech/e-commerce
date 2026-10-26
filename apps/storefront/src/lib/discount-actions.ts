'use server'

import 'server-only'

import { type CodeRejection, checkDiscountCode, setCartDiscountCode } from '@commerce/core'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { checkoutCartId } from './checkout-context'
import { clientIp, rateLimited } from './rate-limit'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

/**
 * Per IP and per cart, so discount codes cannot be guessed by the thousand (security audit
 * 2026-09-28 branch, ported 2026-10-06). Generous for a shopper trying a few codes.
 */
const APPLY_DISCOUNT_RULE = { limit: 20, windowMs: 10 * 60_000 }

export type DiscountActionResult = { ok: true } | { ok: false; reason: CodeRejection }

/** Try a code against the cart and keep it when it works. Never reveals why a code is unknown. */
export async function applyDiscountAction(code: string): Promise<DiscountActionResult> {
  const storeId = await requestStoreId()
  const cartId = await checkoutCartId()
  if (!cartId) return { ok: false, reason: 'invalid' }
  const [byIp, byCart] = await Promise.all([
    rateLimited(
      'discount-apply:ip',
      `${storeId}:${clientIp(await headers())}`,
      APPLY_DISCOUNT_RULE,
    ),
    rateLimited('discount-apply:cart', `${storeId}:${cartId}`, APPLY_DISCOUNT_RULE),
  ])
  if (!byIp.ok || !byCart.ok) return { ok: false, reason: 'invalid' }
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

export async function removeDiscountAction(): Promise<void> {
  const storeId = await requestStoreId()
  const cartId = await checkoutCartId()
  if (!cartId) return
  await inStore(storeId, (tx) => setCartDiscountCode({ storeId, tx }, cartId, null))
  revalidatePath('/cart')
  revalidatePath('/checkout')
}
