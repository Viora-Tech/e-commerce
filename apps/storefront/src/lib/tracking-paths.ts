/**
 * Pages third-party tags (GA4, GTM, Meta pixel) never load on. Their URLs carry a token
 * (`/account/login/link?token=…`, `/checkout/balance/<token>`, `/cod/<token>`), and those
 * tags send the full page URL to Google and Meta, where anyone with access to the
 * merchant's analytics could replay it: sign in, pay, confirm a COD order or read the order.
 */
const PRIVATE_PREFIXES = [
  '/account/login',
  '/checkout/balance',
  '/checkout/invoice',
  '/checkout/recover',
  '/cod',
  '/newsletter/confirm',
  '/unsubscribe',
]

/** The path as the shopper sees it, whether or not the internal `/-s/<store>` prefix shows. */
function visiblePath(pathname: string): string {
  return pathname.replace(/^\/-s\/[^/]+/, '') || '/'
}

export function trackingAllowedOn(pathname: string | null): boolean {
  const path = visiblePath(pathname ?? '/')
  return !PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}
