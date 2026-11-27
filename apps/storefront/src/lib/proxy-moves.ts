import 'server-only'
import { settingsSecret } from '@commerce/config'
import { readHonoPreviewToken } from '@commerce/core/hono-preview'
import { type NextRequest, NextResponse } from 'next/server'
import { HONO_COOKIE, HONO_COOKIE_MAX_AGE, honoPreviewLink } from './hono-island/route'
import { type MarketPick, marketRedirect } from './markets'
import { ORDER_VIEW_COOKIE, ORDER_VIEW_MAX_AGE, orderTokenSwap } from './order-token-swap'

/**
 * The proxy's redirects that answer before a page is routed (`proxy.ts`): an order page's token
 * moving into a cookie, the faster product pages' preview link, and a browse page away from its
 * market's URL. Each returns null when the request is not one it moves. Split from proxy.ts.
 */

/**
 * An order page's `?t=` token moves into a cookie for that page before any HTML (and so any
 * pixel or tag reading `location.href`) exists; the page reads it back (`order-token-swap.ts`).
 */
export function orderTokenMove(request: NextRequest): NextResponse | null {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const swap = orderTokenSwap(request.nextUrl.pathname, request.nextUrl.search)
  if (!swap) return null
  const moved = NextResponse.redirect(new URL(swap.location, request.nextUrl), 302)
  moved.headers.set('cache-control', 'no-store')
  if (swap.token) {
    moved.cookies.set(ORDER_VIEW_COOKIE, swap.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: swap.cookiePath,
      maxAge: ORDER_VIEW_MAX_AGE,
    })
  }
  return moved
}

/**
 * The faster product pages' link (`?hono=`, `hono-island/route.ts`): this browser's `wc_hono`
 * cookie, then the same page without the param. Only a token the admin signed for this store
 * turns the preview on, so a shared link turns nothing on for anyone else.
 */
export function honoPreviewMove(request: NextRequest, storeId: string): NextResponse | null {
  if ((request.method !== 'GET' && request.method !== 'HEAD') || request.headers.has('rsc'))
    return null
  const link = honoPreviewLink(request.nextUrl, (token) =>
    readHonoPreviewToken({ secret: settingsSecret(), storeId, token }),
  )
  if (!link) return null
  const back = NextResponse.redirect(new URL(link.location, request.nextUrl), 302)
  back.headers.set('cache-control', 'private, no-store')
  if (link.cookie === 'clear') back.cookies.delete(HONO_COOKIE)
  else if (link.cookie !== 'keep') {
    back.cookies.set(HONO_COOKIE, link.cookie, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: HONO_COOKIE_MAX_AGE,
    })
  }
  return back
}

/**
 * A browse page away from its market's own URL (`marketRedirect`). A prefix written another way
 * moves for good (301); a saved choice only for this shopper (302, never stored by a cache), and
 * only for a page load, so crawlers and the app's own fetches see what they asked for.
 */
export function marketMove(request: NextRequest, pick: MarketPick): NextResponse | null {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  if (request.headers.has('rsc')) return null
  if (pick.via === 'cookie' && request.headers.get('sec-fetch-dest') !== 'document') return null
  if (pick.via !== 'cookie' && pick.via !== 'prefix') return null
  const to = marketRedirect(pick, request.nextUrl.search)
  if (!to) return null
  const moved = NextResponse.redirect(
    new URL(to, request.nextUrl),
    pick.via === 'prefix' ? 301 : 302,
  )
  if (pick.via === 'cookie') moved.headers.set('cache-control', 'private, no-store')
  return moved
}
