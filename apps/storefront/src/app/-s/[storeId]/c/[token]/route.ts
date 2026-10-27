import { settingsSecret } from '@commerce/config'
import { verifyHandoffToken } from '@commerce/core/checkout-handoff'
import { redeemHandoff } from '@commerce/core/checkout-redeem'
import type { NextRequest } from 'next/server'
import { writeCheckoutSession } from '@/lib/checkout-session'
import { redirectTo } from '@/lib/redirect'
import { withEvlog } from '@/lib/request-log'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string; token: string }> }

/**
 * The checkout origin's entry point (security audit D-01, phase B). The store origin's
 * `/checkout/start` redirects here with a signed hand-off token; the proxy has already resolved
 * `storeId` from the `checkout.<primary>` host. Verify the token, redeem the cart under this
 * store's RLS (which refuses a foreign-store, empty or already-ordered cart), open a host-only
 * checkout session, and send the shopper to the checkout form. Any failure lands on the cart.
 */
export const GET = withEvlog(async (_request: NextRequest, { params }: Params) => {
  const { storeId, token } = await params
  const verified = verifyHandoffToken(token, settingsSecret())
  if (!verified.ok) return redirectTo('/cart')

  const redeemed = await inStore(storeId, (tx) =>
    redeemHandoff(
      { storeId, tx },
      { storeId: verified.storeId, cartId: verified.cartId, customerId: verified.customerId },
    ),
  )
  if (!redeemed.ok) return redirectTo('/cart')

  await writeCheckoutSession({
    storeId,
    cartId: redeemed.cartId,
    customerId: verified.customerId,
  })
  return redirectTo('/checkout')
})
