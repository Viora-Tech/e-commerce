import { loadEnv, settingsSecret } from '@commerce/config'
import { CONSENT_COOKIE } from '@commerce/core/preferences'
import { withQuery } from '@commerce/core/redirects'
import { THEME_PREVIEW_PARAM } from '@commerce/core/theme'
import { type HostRoute, resolveHost, type StoreMarketRoute, storeMarkets } from '@commerce/db'
import { type NextRequest, NextResponse } from 'next/server'
import { SEO_FILES } from './data/seo'
import { accountsHostname } from './lib/accounts-host'
import { analyticsAllowed } from './lib/consent-cookie'
import {
  forwardNonce,
  ISOLATED_FRAME_ANCESTORS,
  ISOLATION_HEADERS,
  isIsolatedStorePath,
  newNonce,
  scriptCsp,
  storefrontFrameAncestors,
} from './lib/csp'
import { db } from './lib/db'
import { edgeCacheControl, isSharedPage } from './lib/edge-cache'
import {
  MARKET_COOKIE,
  MARKET_COOKIE_MAX_AGE,
  MARKET_HEADERS,
  type MarketPick,
  marketHeaders,
  marketPath,
  marketRedirect,
  pickMarket,
  savedChoice,
  withoutMarketSegment,
} from './lib/markets'
import { ORDER_VIEW_COOKIE, ORDER_VIEW_MAX_AGE, orderTokenSwap } from './lib/order-token-swap'
import {
  PLAIN_SKIP_HEADER,
  plainPath,
  plainSkipNonce,
  wantsPlainHtml,
} from './lib/plain-html/route'
import { noteVisit, WARM_USER_AGENT } from './lib/recent-pages'
import { redirectFor } from './lib/redirects'
import { noteReferral } from './lib/referral-landing'
import {
  checkoutHostname,
  DERIVED_HEADERS,
  listingSearch,
  PASSWORD_PREFIX,
  primaryRedirect,
  redirectHostFor,
  routeForAccounts,
  routeForCheckoutHost,
  routeForStore,
} from './lib/routing'

import { createStoreResolver, hostnameFromHeader } from './lib/store-resolver'
import {
  ACCESS_COOKIE,
  hasAccess,
  PREVIEW_COOKIE,
  PREVIEW_MAX_AGE,
  readPreview,
  storefrontLock,
} from './lib/storefront-gate'
import { parseVisitorId, VISITOR_COOKIE, VISITOR_COOKIE_MAX_AGE } from './lib/visitor-cookie'

/** Seconds a CDN may keep a shared page when `STOREFRONT_EDGE_TTL` is unset. */
const DEFAULT_EDGE_TTL = 30

let edgeTtl: number | null = null
/** `STOREFRONT_EDGE_TTL`, read once per process. */
const edgeTtlSeconds = () =>
  (edgeTtl ??= loadEnv(process.env).STOREFRONT_EDGE_TTL ?? DEFAULT_EDGE_TTL)

let plainKilled: boolean | null = null
/** `STOREFRONT_PLAIN_HTML=off`, read once per process: no page goes out as plain HTML. */
const plainHtmlKilled = () => (plainKilled ??= loadEnv(process.env).STOREFRONT_PLAIN_HTML === 'off')

/** A version id from the admin (`?theme-version=`): a uuid, nothing else reaches the header. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const resolve = createStoreResolver<HostRoute>({
  lookup: (hostname) => resolveHost(db(), hostname),
})

/**
 * A store's markets, cached like hosts. A failed lookup (a database blip, or this storefront
 * running before migration 0177) serves the primary market rather than failing the page.
 */
const marketsOf = createStoreResolver<StoreMarketRoute[]>({
  lookup: (storeId) => storeMarkets(db(), storeId).catch(() => []),
})

/** Cloudflare's edge country, forwarded for region defaults. Absent when not behind Cloudflare. */
function visitorCountry(request: NextRequest): string | null {
  const c = request.headers.get('cf-ipcountry')?.trim().toUpperCase()
  return c && /^[A-Z]{2}$/.test(c) ? c : null
}

/**
 * Every answer carries the script Content-Security-Policy with a fresh nonce
 * (`lib/csp.ts`); the forwarded request carries the same nonce for the page to use.
 */
export async function proxy(request: NextRequest) {
  // The plain HTML route handing an ineligible page back (`lib/plain-html/forward.ts`): the page
  // keeps the nonce the outer response's CSP names.
  const handedBack = plainSkipNonce(settingsSecret(), request.headers.get(PLAIN_SKIP_HEADER))
  const nonce = handedBack ?? newNonce()
  // Checkout and the shopper account (D-01) refuse all framing and carry the isolation headers;
  // every other page keeps the self-plus-admin frame-ancestors the theme editor needs.
  // A market prefix (`/ae/checkout`) never loosens that.
  const isolated =
    isIsolatedStorePath(request.nextUrl.pathname) ||
    isIsolatedStorePath(withoutMarketSegment(request.nextUrl.pathname))
  const csp = scriptCsp({
    nonce,
    dev: process.env.NODE_ENV !== 'production',
    frameAncestors: isolated
      ? ISOLATED_FRAME_ANCESTORS
      : storefrontFrameAncestors(process.env.ADMIN_URL),
  })
  const response = await routeRequest(
    request,
    (headers) => forwardNonce(headers, nonce, csp),
    handedBack !== null,
  )
  response.headers.set(csp.name, csp.value)
  if (isolated) for (const [name, value] of ISOLATION_HEADERS) response.headers.set(name, value)
  return response
}

async function routeRequest(
  request: NextRequest,
  withNonce: (headers: Headers) => void,
  handedBack = false,
) {
  const host = request.headers.get('host')
  const hostname = hostnameFromHeader(host)
  // The platform login domain (ACCOUNTS_URL) is no store: it serves provider sign-in only.
  if (hostname && hostname === accountsHostname()) {
    const route = routeForAccounts(request.nextUrl.pathname)
    if (route.kind === 'forbidden') return new NextResponse('Not found', { status: 404 })
    const headers = new Headers(request.headers)
    for (const h of DERIVED_HEADERS) headers.delete(h)
    withNonce(headers)
    if (route.kind === 'passthrough') return NextResponse.next({ request: { headers } })
    const url = request.nextUrl.clone()
    url.pathname = route.path
    return NextResponse.rewrite(url, { request: { headers } })
  }
  // A store's branded checkout host (`<CHECKOUT_SUBDOMAIN>.<primary>`, D-01 phase B): resolve the
  // store from its primary, and serve only the `/c` hand-off entry and the checkout pages there.
  const checkoutBase = checkoutHostname(hostname, process.env.CHECKOUT_SUBDOMAIN?.trim() || null)
  if (hostname && checkoutBase) {
    const store = await resolve(checkoutBase)
    if (!store) return new NextResponse('Not found', { status: 404 })
    const route = routeForCheckoutHost(store.storeId, request.nextUrl.pathname)
    if (route.kind === 'forbidden') return new NextResponse('Not found', { status: 404 })
    const headers = new Headers(request.headers)
    for (const h of DERIVED_HEADERS) headers.delete(h)
    withNonce(headers)
    headers.set('x-store-id', store.storeId)
    if (route.kind === 'passthrough') return NextResponse.next({ request: { headers } })
    const url = request.nextUrl.clone()
    url.pathname = route.path
    return NextResponse.rewrite(url, { request: { headers } })
  }

  const hostRoute = hostname ? await resolve(hostname) : null
  if (!hostname || !hostRoute) {
    return new NextResponse(`No store is configured for ${hostname ?? 'this host'}.`, {
      status: 404,
      headers: { 'content-type': 'text/plain' },
    })
  }
  const { storeId } = hostRoute

  // Old domains and the www/apex twin send shoppers to the primary domain; the twin of a
  // market's own domain sends them to that domain instead.
  const redirectHost = hostRoute.redirect
    ? redirectHostFor(
        hostname,
        hostRoute.primaryHostname,
        ((await marketsOf(storeId)) ?? []).filter((m) => m.enabled).map((m) => m.hostname),
      )
    : hostRoute.primaryHostname
  const target = primaryRedirect({
    hostname,
    port: host?.split(':')[1] ?? '',
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    protocol: request.nextUrl.protocol,
    primaryHostname: redirectHost,
    redirect: hostRoute.redirect,
    inFrame: request.headers.get('sec-fetch-dest') === 'iframe',
    previewing: request.nextUrl.searchParams.has(THEME_PREVIEW_PARAM),
    dev: process.env.NODE_ENV !== 'production',
  })
  if (target) return NextResponse.redirect(target, 301)

  // An order page's `?t=` token moves into a cookie for that page before any HTML (and so any
  // pixel or tag reading `location.href`) exists; the page reads it back (`lib/order-token-swap.ts`).
  if (request.method === 'GET' || request.method === 'HEAD') {
    const swap = orderTokenSwap(request.nextUrl.pathname, request.nextUrl.search)
    if (swap) {
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
  }

  // Markets (`lib/markets.ts`): the market, language and country this request is in. A prefix
  // comes off the path before routing, so `/ae/products/x` renders `/products/x` in that market.
  const markets = (await marketsOf(storeId)) ?? []
  const pick = pickMarket({
    markets,
    hostname,
    primaryHostname: hostRoute.primaryHostname,
    pathname: request.nextUrl.pathname,
    cookie: request.cookies.get(MARKET_COOKIE)?.value,
  })
  const moved = marketMove(request, pick)
  if (moved) return moved

  const route = routeForStore(storeId, pick.pathname)
  if (route.kind === 'forbidden') return new NextResponse('Not found', { status: 404 })

  // Never trust routing headers from the client; set only what the proxy derived.
  const headers = new Headers(request.headers)
  for (const h of DERIVED_HEADERS) headers.delete(h)
  withNonce(headers)
  headers.set('x-store-id', storeId)
  const country = visitorCountry(request)
  if (country) headers.set('x-visitor-country', country)
  for (const [name, value] of marketHeaders(pick, markets, hostname, hostRoute.primaryHostname)) {
    headers.set(name, value)
  }
  // Imported Shopify themes read `form.posted_successfully?` after our form handlers
  // redirect back with `?form_posted=<type>` (lib/liquid-theme.ts).
  const posted = request.nextUrl.searchParams.get('form_posted')
  if (posted && /^[a-z_]{1,40}$/.test(posted)) headers.set('x-form-posted', posted)
  headers.set('x-pathname', pick.pathname)
  const listing = listingSearch(request.nextUrl.searchParams)
  if (listing) headers.set('x-listing', listing)

  if (route.kind === 'passthrough') return NextResponse.next({ request: { headers } })

  // URL redirects (Content → Menus → URL redirects, imported Shopify paths) answer
  // before anything renders, so an old link never shows the password page first.
  if (request.method === 'GET' || request.method === 'HEAD') {
    const target = await redirectFor(storeId, pick.pathname)
    if (target) {
      // A redirect inside a market stays in it (`/ae/old` → `/ae/new`).
      const inMarket = marketPath(pick.root.hostname ? '' : pick.root.prefix, target)
      const to = new URL(withQuery(inMarket, request.nextUrl.search), request.nextUrl)
      return NextResponse.redirect(to, 301)
    }
  }

  // Theme preview: `?theme-preview=<token>` from the admin renders that theme. A top-level
  // visit keeps it in a cookie so links keep previewing; frames (the admin thumbnail and
  // editor) never set it, so the merchant's own storefront tab is not left previewing.
  const param = request.nextUrl.searchParams.get(THEME_PREVIEW_PARAM)
  const secure = request.nextUrl.protocol === 'https:'
  if (param === 'exit') {
    const back = request.nextUrl.clone()
    back.searchParams.delete(THEME_PREVIEW_PARAM)
    const exit = NextResponse.redirect(back)
    exit.cookies.delete(PREVIEW_COOKIE)
    return exit
  }
  const inFrame = request.headers.get('sec-fetch-dest') === 'iframe'
  const token = param ?? (inFrame ? null : (request.cookies.get(PREVIEW_COOKIE)?.value ?? null))
  const preview = readPreview(storeId, token)
  if (preview && token) headers.set('x-theme-preview', token)
  // `?theme-version=<batch>` (Versions › Preview in the admin): that version of the previewed
  // theme, for this page only. Only with a valid preview; the renderer checks the theme too.
  const version = request.nextUrl.searchParams.get('theme-version')
  if (preview && token && version && UUID.test(version)) headers.set('x-theme-version', version)

  // Password page: while it is on, every page renders it unless the visitor has the
  // signed pass or a valid preview token.
  const lock = await storefrontLock(storeId)
  // robots.txt, sitemap.xml and llms.txt always reach their handlers, which answer
  // "stay out" themselves while the store is locked rather than serving the password page.
  const seoFile = (SEO_FILES as readonly string[]).includes(pick.pathname)
  const locked =
    lock.enabled &&
    !seoFile &&
    !preview &&
    !hasAccess(storeId, lock.password, request.cookies.get(ACCESS_COOKIE)?.value)

  // A `?ref=` landing sets the referral cookie, so a cached copy must never answer it.
  const referred = request.nextUrl.searchParams.has('ref')
  const cookieNames = request.cookies.getAll().map((c) => c.name)
  // A page that is the same for every visitor without our cookies may sit in a CDN briefly
  // (`lib/edge-cache.ts`); everything else keeps Next's private, no-store answer.
  const shared = edgeCacheControl({
    method: request.method,
    pathname: pick.pathname,
    cookieNames,
    rsc: request.headers.has('rsc'),
    personal: Boolean(preview) || locked || posted !== null || referred,
    ttlSeconds: edgeTtlSeconds(),
  })
  // Preferences › Storefront speed: an imported theme's page as plain HTML (`lib/plain-html`).
  const plain =
    !locked &&
    wantsPlainHtml({
      enabled: lock.plainHtml,
      killed: plainHtmlKilled(),
      method: request.method,
      pathname: pick.pathname,
      rsc: request.headers.has('rsc'),
      personal: Boolean(preview) || posted !== null || referred,
      marketPrefix: headers.get(MARKET_HEADERS.prefix) ?? '',
      cookie: (name) => request.cookies.get(name)?.value,
      handedBack,
    })
  if (plain && shared) headers.set('x-edge-cache-control', shared)

  const url = request.nextUrl.clone()
  url.pathname = locked
    ? `${PASSWORD_PREFIX}/${storeId}`
    : plain
      ? plainPath(storeId, pick.pathname)
      : route.path
  const response = NextResponse.rewrite(url, { request: { headers } })
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
  // said yes to marketing (`lib/referral-landing.ts`). Never twice for a page handed back.
  if (!handedBack && referred && !seoFile && !locked && !preview)
    await noteReferral(storeId, request, response)
  // The first page view after the shopper allowed analytics mints the anonymous visitor
  // id the beacon reports (the beacon is a keepalive POST whose Set-Cookie some browsers
  // drop, so it is done here). Without analytics consent no visitor id is set at all. Never
  // on robots.txt, sitemap.xml or llms.txt: they answer `cache-control: public`, and a
  // shared cache that stored a Set-Cookie would hand one visitor id to every shopper after.
  if (
    !seoFile &&
    analyticsAllowed(request.cookies.get(CONSENT_COOKIE)?.value) &&
    !parseVisitorId(request.cookies.get(VISITOR_COOKIE)?.value)
  ) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: VISITOR_COOKIE_MAX_AGE,
    })
  }
  if (shared && !response.headers.has('set-cookie')) response.headers.set('cache-control', shared)
  // Pages shoppers view are re-rendered after the store changes (`lib/cache-warm.ts`).
  if (
    request.method === 'GET' &&
    !preview &&
    !locked &&
    !request.headers.has('rsc') &&
    isSharedPage(pick.pathname) &&
    !handedBack &&
    request.headers.get('user-agent') !== WARM_USER_AGENT
  ) {
    noteVisit(storeId, {
      host: host ?? hostname,
      proto: request.headers.get('x-forwarded-proto'),
      path: request.nextUrl.pathname,
    })
  }
  return response
}

/**
 * A browse page away from its market's own URL (`marketRedirect`). A prefix written another way
 * moves for good (301); a saved choice only for this shopper (302, never stored by a cache), and
 * only for a page load, so crawlers and the app's own fetches see what they asked for.
 */
function marketMove(request: NextRequest, pick: MarketPick): NextResponse | null {
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

export const config = {
  // /api/health is excluded: it's an infra liveness/readiness probe (Docker HEALTHCHECK,
  // deploy/docker-compose.prod.yml), not tied to any store's host, so it must answer even
  // when the request's Host header ("localhost" inside the container, no store configured
  // for it) would otherwise 404 here.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|flags/|api/health).*)'],
}
