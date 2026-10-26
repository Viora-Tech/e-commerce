/**
 * The signed order-view token (`?t=`) on the thank-you and pay pages never stays in the address
 * bar: the Meta pixel and gtag read `location.href` themselves and would carry it to Meta and
 * Google, where anyone with the merchant's analytics could open the order. The proxy moves it
 * into a short-lived cookie scoped to that one page and redirects to the same URL without it;
 * the page reads the cookie. Pure, so the proxy and server actions share it.
 */

/** Cookie holding the token, path-scoped to the one order page it was meant for. */
export const ORDER_VIEW_COOKIE = 'wc_ov'
/** Long enough to read the page and pay; the link in the email still works after. */
export const ORDER_VIEW_MAX_AGE = 30 * 60

const ORDER_PAGE = /^\/checkout\/(?:thank-you|pay)\/\d{1,12}\/?$/
/** `<orderId>.<expiresMs>.<mac>`: url-safe characters only, so it is safe in a cookie. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{1,64}\.\d{1,16}\.[A-Za-z0-9_-]{1,100}$/

export type OrderTokenSwap = {
  /** The token to keep in the cookie, or null when `t` was not one (it is dropped anyway). */
  token: string | null
  /** The cookie's path: the page itself, without a trailing slash. */
  cookiePath: string
  /** Path and query to redirect to: the same page and query, without `t`. */
  location: string
}

/** For an order page whose URL carries `t`, where to send the shopper instead; otherwise null. */
export function orderTokenSwap(pathname: string, search: string): OrderTokenSwap | null {
  if (!ORDER_PAGE.test(pathname)) return null
  const params = new URLSearchParams(search)
  if (!params.has('t')) return null
  const raw = params.get('t') ?? ''
  params.delete('t')
  const rest = params.toString()
  return {
    token: TOKEN_SHAPE.test(raw) ? raw : null,
    cookiePath: pathname.replace(/\/$/, ''),
    location: rest ? `${pathname}?${rest}` : pathname,
  }
}

/** The page's token: one still in the URL (a request that skipped the proxy) wins over the cookie. */
export function pickOrderToken(
  query: string | string[] | undefined,
  cookie: string | undefined,
): string | undefined {
  const fromQuery = Array.isArray(query) ? query[0] : query
  return fromQuery || cookie || undefined
}
