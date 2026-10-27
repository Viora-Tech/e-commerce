import 'server-only'
import { headers } from 'next/headers'
import { readCartId } from './cart-cookie'
import { readCheckoutSession } from './checkout-session'

/**
 * The cart id for a checkout-step request, wherever checkout runs (security audit D-01, phase B).
 * On the branded checkout origin the store-origin cart cookie isn't present, so the cart comes from
 * the host-only checkout session; on the store origin (flag off, or the same-origin fallback) it
 * comes from the cart cookie. With the flag off there is never a session, so this is exactly
 * `readCartId()` — the swap is a no-op until a store checks out on its own origin.
 */
export async function checkoutCartId(): Promise<string | null> {
  return (await readCheckoutSession())?.cartId ?? (await readCartId())
}

/**
 * {storeId, cartId} for the checkout page: from the checkout session on the checkout origin, else
 * the proxy's `x-store-id` header and the cart cookie on the store origin. Null when neither gives
 * a cart.
 */
export async function checkoutContext(): Promise<{ storeId: string; cartId: string } | null> {
  const session = await readCheckoutSession()
  if (session) return { storeId: session.storeId, cartId: session.cartId }
  const storeId = (await headers()).get('x-store-id')
  const cartId = await readCartId()
  return storeId && cartId ? { storeId, cartId } : null
}
