import 'server-only'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  ORDER_VIEW_COOKIE,
  ORDER_VIEW_MAX_AGE,
  orderTokenSwap,
  pickOrderToken,
} from './order-token-swap'

/** The order-view token for the thank-you or pay page: `?t=` if still there, else the cookie. */
export async function orderPageToken(
  query: string | string[] | undefined,
): Promise<string | undefined> {
  return pickOrderToken(query, (await cookies()).get(ORDER_VIEW_COOKIE)?.value)
}

/**
 * `redirect()` for server actions sending the shopper to `thankYouPath(...)` or `payPath(...)`:
 * the token goes into the page's cookie and the address bar never shows it. (An action's
 * redirect is rendered in the same response, so the proxy never sees the `?t=` to swap it.)
 */
export async function redirectToOrderPage(href: string): Promise<never> {
  const url = new URL(href, 'http://local')
  const swap = orderTokenSwap(url.pathname, url.search)
  if (!swap) redirect(href)
  if (swap.token) {
    const secure = (await headers()).get('x-forwarded-proto') === 'https'
    ;(await cookies()).set(ORDER_VIEW_COOKIE, swap.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: swap.cookiePath,
      maxAge: ORDER_VIEW_MAX_AGE,
    })
  }
  redirect(swap.location)
}
