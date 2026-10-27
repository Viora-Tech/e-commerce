/** SOURCE OF TRUTH: checkout hand-off redemption — WHAT: redeemHandoff turns a verified hand-off token into an openable cart, refusing a foreign-store, empty, or already-ordered cart (D-01 phase B) / WHY: the single-use + tenant check for opening checkout on the branded checkout origin */
import { getCart } from '../cart/cart'
import type { StoreContext } from '../context'
import type { CheckoutPayload } from './handoff'

/**
 * Turns a verified hand-off token into a checkout the store origin may open on the checkout origin
 * (security audit D-01, phase B). Refuses a token minted for a different store (`foreign`), a cart
 * that is empty, and a cart that has already become an order (`spent` — this is what makes the
 * hand-off effectively single-use: once checkout converts the cart, the same token opens nothing).
 * The caller runs this under the store's RLS scope, so the cart read is already tenant-isolated.
 */
export async function redeemHandoff(
  ctx: StoreContext,
  handoff: CheckoutPayload,
): Promise<{ ok: true; cartId: string } | { ok: false; reason: 'foreign' | 'empty' | 'spent' }> {
  if (handoff.storeId !== ctx.storeId) return { ok: false, reason: 'foreign' }
  const cart = await getCart(ctx, handoff.cartId)
  if (!cart || cart.lines.length === 0) return { ok: false, reason: 'empty' }
  if (cart.status !== 'open') return { ok: false, reason: 'spent' }
  return { ok: true, cartId: handoff.cartId }
}
