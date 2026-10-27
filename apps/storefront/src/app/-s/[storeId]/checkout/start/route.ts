import { loadEnv, settingsSecret } from '@commerce/config'
import { checkoutOriginFor, storefrontOriginFor } from '@commerce/core'
import { type NextRequest, NextResponse } from 'next/server'
import { readCartId } from '@/lib/cart-cookie'
import { checkoutHandoffTarget } from '@/lib/checkout-handoff'
import { currentCustomer } from '@/lib/customer-session'
import { applyDiscountAction } from '@/lib/discount-actions'
import { redirectTo } from '@/lib/redirect'
import { withEvlog } from '@/lib/request-log'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string }> }

/**
 * The store-origin "Checkout" button lands here (security audit D-01, phase B). When a branded
 * checkout origin is configured and provisioned it hands the cart (and the signed-in shopper) off
 * to `checkout.<primary>/c/<token>`; otherwise it falls back to same-origin `/checkout`. The cart
 * and customer never cross as cookies — only inside the short-lived signed token.
 */
export const GET = withEvlog(async (request: NextRequest, { params }: Params) => {
  const { storeId } = await params
  const env = loadEnv(process.env)
  const cartId = await readCartId()
  // A code typed in the cart (or a theme's `discount` field) but not applied: try it now. One
  // that does not work is not kept, and checkout opens without it (its field stays empty).
  const typedCode = request.nextUrl.searchParams.get('discount')?.trim().slice(0, 64)
  if (cartId && typedCode) await applyDiscountAction(typedCode)
  const me = await currentCustomer(storeId)
  const { checkoutOrigin, storeOrigin } = await inStore(storeId, async (tx) => ({
    storeOrigin: await storefrontOriginFor(tx, storeId, env.STOREFRONT_URL),
    checkoutOrigin: await checkoutOriginFor(
      tx,
      storeId,
      env.CHECKOUT_SUBDOMAIN ?? null,
      env.STOREFRONT_URL,
    ),
  }))
  const target = checkoutHandoffTarget({
    storeId,
    cartId,
    customerId: me?.id ?? null,
    checkoutOrigin,
    storeOrigin,
    secret: settingsSecret(),
  })
  return target.startsWith('http') ? NextResponse.redirect(target, 303) : redirectTo(target, 303)
})
