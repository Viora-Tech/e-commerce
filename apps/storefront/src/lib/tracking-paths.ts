/**
 * Pages third-party tags (GA4, GTM, Meta pixel) never load on. Sign-in pages carry
 * single-use tokens in the URL (`/account/login/link?token=…`), and those tags send the
 * full page URL to Google and Meta, where anyone with access to the merchant's analytics
 * could replay the token before the shopper taps "Sign in".
 */
const PRIVATE_PREFIXES = ['/account/login']

/** The path as the shopper sees it, whether or not the internal `/-s/<store>` prefix shows. */
function visiblePath(pathname: string): string {
  return pathname.replace(/^\/-s\/[^/]+/, '') || '/'
}

export function trackingAllowedOn(pathname: string | null): boolean {
  const path = visiblePath(pathname ?? '/')
  return !PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}
