import 'server-only'
import { CONSENT_COOKIE } from '@commerce/core/preferences'
import type { NextRequest, NextResponse } from 'next/server'
import { FEED_FILES } from '../data/product-feed'
import { consentOf } from './consent-cookie'
import { isSharedPage } from './edge-cache'
import { MARKET_COOKIE, MARKET_COOKIE_MAX_AGE, type MarketPick, savedChoice } from './markets'
import { noteVisit, WARM_USER_AGENT } from './recent-pages'
import { noteReferral } from './referral-landing'
import { PREVIEW_COOKIE, PREVIEW_MAX_AGE } from './storefront-gate'
import { parseVisitorId, VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE } from './visitor-cookie'

/**
 * What the proxy adds to a store page's rewrite once it is routed (`proxy.ts`): the theme preview,
 * market and visitor cookies, the referral landing, the shared cache header and the visit the
 * cache warmer re-renders. Split from proxy.ts.
 */

/** What the proxy worked out about the page request, for `finishPageResponse`. */
export type PageRequest = {
  request: NextRequest
  storeId: string
  /** The forwarded request headers (market and consent headers already set). */
  headers: Headers
  host: string | null
  hostname: string
  pick: MarketPick
  /** The verified theme preview, if any, and the `?theme-preview=` param it came from. */
  preview: unknown
  param: string | null
  secure: boolean
  locked: boolean
  seoFile: boolean
  referred: boolean
  /** The CDN cache-control for a page every visitor sees alike, else null. */
  shared: string | null
  handedBack: boolean
}

/** Sets the page's cookies and cache header on `response`, and notes the visit. */
export async function finishPageResponse(response: NextResponse, page: PageRequest) {
  const { request, storeId, headers, pick, preview, param, secure, locked, seoFile } = page
  if (preview && param && request.headers.get('sec-fetch-dest') === 'document') {
    response.cookies.set(PREVIEW_COOKIE, param, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: PREVIEW_MAX_AGE,
    })
  }
  // A market reached by its URL becomes the shopper's saved choice, so plain links keep it.
  const saved = savedChoice(pick.market, pick.country, pick.locale)
  if (
    pick.via === 'prefix' &&
    pick.market.id &&
    pick.country &&
    request.cookies.get(MARKET_COOKIE)?.value !== saved
  ) {
    response.cookies.set(MARKET_COOKIE, saved, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: MARKET_COOKIE_MAX_AGE,
    })
  }
  // An affiliate's link (`?ref=`): the click count, and the referral cookie once the shopper
  // said yes to marketing (`referral-landing.ts`). Never twice for a page handed back.
  if (!page.handedBack && page.referred && !seoFile && !locked && !preview)
    await noteReferral(storeId, request, response)
  // The first page view once analytics is allowed (a yes on the banner, or a region where the
  // banner does not ask) mints the anonymous visitor id the beacon reports (the beacon is a keepalive POST whose Set-Cookie some browsers
  // drop, so it is done here). Without analytics consent no visitor id is set at all. Never
  // on robots.txt, sitemap.xml or llms.txt: they answer `cache-control: public`, and a
  // shared cache that stored a Set-Cookie would hand one visitor id to every shopper after.
  // The product feeds (`/feeds/products.xml`, `.csv`) are public and cacheable for the same reason.
  if (
    !seoFile &&
    !(FEED_FILES as readonly string[]).includes(pick.pathname) &&
    !parseVisitorId(request.cookies.get(VISITOR_COOKIE)?.value) &&
    (await visitorMayBeCounted(
      storeId,
      headers,
      request.cookies.get(CONSENT_COOKIE)?.value,
      preview,
    ))
  ) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: VISITOR_COOKIE_MAX_AGE,
    })
  }
  if (page.shared && !response.headers.has('set-cookie'))
    response.headers.set('cache-control', page.shared)
  // Pages shoppers view are re-rendered after the store changes (`cache-warm.ts`).
  if (
    request.method === 'GET' &&
    !preview &&
    !locked &&
    !request.headers.has('rsc') &&
    isSharedPage(pick.pathname) &&
    !page.handedBack &&
    request.headers.get('user-agent') !== WARM_USER_AGENT
  ) {
    noteVisit(storeId, {
      host: page.host ?? page.hostname,
      proto: request.headers.get('x-forwarded-proto'),
      path: request.nextUrl.pathname,
    })
  }
  return response
}

/**
 * Analytics is allowed for this page view: a yes on the banner, or a region where the banner does
 * not ask. A theme preview (nobody being tracked there) only counts an explicit yes.
 */
async function visitorMayBeCounted(
  storeId: string,
  headers: Headers,
  raw: string | undefined,
  preview: unknown,
): Promise<boolean> {
  const { consent, stored } = await consentOf(storeId, headers, raw)
  if (consent?.analytics !== true) return false
  return !preview || stored?.analytics === true
}
