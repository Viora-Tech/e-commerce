/** SOURCE OF TRUTH: the shopper's "I've paid" — WHAT: reads what a shopper said with "I've paid" on a UPI / bank transfer checkout (UTR and time, kept on the attempt's `checkout_session.shopperPaid` by `recordShopperPaid`) / WHY: the storefront page and the admin show it; pure, so pages import it through `@commerce/core/shopper-paid` */

/** What the shopper said with "I've paid", read from a transfer attempt's session; null if nothing. */
export function readShopperPaid(
  checkoutSession: unknown,
): { utr: string | null; at: string } | null {
  const s = checkoutSession as { shopperPaid?: { utr?: unknown; at?: unknown } } | null
  const c = s?.shopperPaid
  if (!c || typeof c.at !== 'string') return null
  return { utr: typeof c.utr === 'string' ? c.utr : null, at: c.at }
}
