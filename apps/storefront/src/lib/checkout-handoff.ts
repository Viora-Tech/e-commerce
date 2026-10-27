import { signHandoffToken } from '@commerce/core/checkout-handoff'

/**
 * Where the store-origin "Checkout" button sends the shopper (security audit D-01, phase B).
 *
 * - No cart yet → back to `/cart`.
 * - Checkout origin same as the store origin (the `CHECKOUT_SUBDOMAIN` flag is off, the store has
 *   no primary host, or its branded host isn't provisioned) → same-origin `/checkout`, unchanged.
 * - Otherwise → the branded checkout origin with a signed single-use hand-off token in the path,
 *   which `checkout.<primary>/c/<token>` redeems into a checkout session.
 *
 * Takes the two already-resolved origins (from `checkoutOriginFor` / `storefrontOriginFor`) rather
 * than re-deriving them, so it stays a pure, test-only-input function.
 */
export function checkoutHandoffTarget(opts: {
  storeId: string
  cartId: string | null
  customerId: string | null
  checkoutOrigin: string
  storeOrigin: string
  secret: string
}): string {
  if (!opts.cartId) return '/cart'
  if (opts.checkoutOrigin === opts.storeOrigin) return '/checkout'
  const token = signHandoffToken(
    { storeId: opts.storeId, cartId: opts.cartId, customerId: opts.customerId },
    opts.secret,
  )
  return `${opts.checkoutOrigin}/c/${token}`
}
