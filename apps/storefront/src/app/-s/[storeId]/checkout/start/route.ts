import { loadEnv, settingsSecret } from '@commerce/config'
import { checkoutOriginFor, storefrontOriginFor } from '@commerce/core'
import { type NextRequest, NextResponse } from 'next/server'
import { readCartId } from '@/lib/cart-cookie'
import { checkoutHandoffTarget } from '@/lib/checkout-handoff'
import { currentCustomer } from '@/lib/customer-session'
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
  const url = target.startsWith('http') ? target : new URL(target, request.url)
  return NextResponse.redirect(url, 303)
})
