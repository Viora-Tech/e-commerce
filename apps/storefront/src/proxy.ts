import { loadEnv, settingsSecret } from '@commerce/config'
import { withQuery } from '@commerce/core/redirects'
import { THEME_PREVIEW_PARAM } from '@commerce/core/theme'
import { THEME_DESIGN_MODE_PARAM } from '@commerce/core/theme-design-mode'
import { type NextRequest, NextResponse } from 'next/server'
import { FEED_FILES } from './data/product-feed'
import { SEO_FILES } from './data/seo'
import { CONSENT_PENDING_HEADER } from './lib/consent-cookie'
import {
  forwardNonce,
  ISOLATED_FRAME_ANCESTORS,
  ISOLATION_HEADERS,
  isIsolatedStorePath,
  newNonce,
  scriptCsp,
  storefrontFrameAncestors,
} from './lib/csp'
import { edgeCacheControl } from './lib/edge-cache'
import { honoPath, wantsHono } from './lib/hono-island/route'
import { honoEnv, honoResting } from './lib/hono-island/state'
import {
  MARKET_COOKIE,
  MARKET_HEADERS,
  marketHeaders,
  marketPath,
  pickMarket,
  withoutMarketSegment,
} from './lib/markets'
import {
  PLAIN_SKIP_HEADER,
  plainPath,
  plainSkipNonce,
  wantsPlainHtml,
} from './lib/plain-html/route'
import {
  PORTAL_BASE_HEADER,
  PORTAL_PATH,
  portalHostBase,
  portalHostFor,
  portalPathRest,
  portalRedirect,
} from './lib/portal-routing'
import { marketsOf, resolve, routeOwnHost, watchRouting } from './lib/proxy-hosts'
import { honoPreviewMove, marketMove, orderTokenMove } from './lib/proxy-moves'
import { finishPageResponse } from './lib/proxy-page-response'
import { redirectFor } from './lib/redirects'
import {
  PRIORITY,
  RETRY_AFTER_S,
  renderGate,
  renderPriority,
  SHOPPER_COOKIES,
} from './lib/render-gate'
import {
  DERIVED_HEADERS,
  listingSearch,
  MISSING_ROUTE_HEADER,
  PASSWORD_PREFIX,
  primaryRedirect,
  RENDER_TICKET_HEADER,
  redirectHostFor,
  routeForStore,
  THEME_VERSION_ID,
  visitorCountry,
} from './lib/routing'
import { toSectionRendering } from './lib/section-rendering'
import { hostnameFromHeader } from './lib/store-resolver'
import {
  ACCESS_COOKIE,
  hasAccess,
  PREVIEW_COOKIE,
  readPreview,
  storefrontLock,
} from './lib/storefront-gate'

/*
 * The storefront's proxy: every request's store, market and route. The host lookups and the
 * hosts that are not a store's pages are in `lib/proxy-hosts.ts`, the early redirects in
 * `lib/proxy-moves.ts`, and the cookies a page answer carries in `lib/proxy-page-response.ts`.
 */

/** Seconds a CDN may keep a shared page when `STOREFRONT_EDGE_TTL` is unset. */
const DEFAULT_EDGE_TTL = 30

let edgeTtl: number | null = null
/** `STOREFRONT_EDGE_TTL`, read once per process. */
const edgeTtlSeconds = () =>
  (edgeTtl ??= loadEnv(process.env).STOREFRONT_EDGE_TTL ?? DEFAULT_EDGE_TTL)

let plainKilled: boolean | null = null
/** `STOREFRONT_PLAIN_HTML=off`, read once per process: no page goes out as plain HTML. */
const plainHtmlKilled = () => (plainKilled ??= loadEnv(process.env).STOREFRONT_PLAIN_HTML === 'off')

/**
 * Every answer carries the script Content-Security-Policy with a fresh nonce
 * (`lib/csp.ts`); the forwarded request carries the same nonce for the page to use.
 */
export async function proxy(request: NextRequest) {
  watchRouting()
  // The plain HTML route handing an ineligible page back (`lib/plain-html/forward.ts`): the page
  // keeps the nonce the outer response's CSP names.
  const handedBack = plainSkipNonce(settingsSecret(), request.headers.get(PLAIN_SKIP_HEADER))
  const nonce = handedBack ?? newNonce()
  // Checkout and the shopper account (D-01) refuse all framing and carry the isolation headers;
  // every other page keeps the self-plus-admin frame-ancestors the theme editor needs.
  // A market prefix (`/ae/checkout`) never loosens that.
  // The affiliate portal's own host is isolated on every path, like checkout.
  const isolated =
    portalHostBase(hostnameFromHeader(request.headers.get('host'))) !== null ||
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
  const own = await routeOwnHost(request, hostname, withNonce)
  if (own) return own

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
    // A theme preview link, or a tab still previewing (its cookie is on this host only).
    previewing:
      request.nextUrl.searchParams.has(THEME_PREVIEW_PARAM) || request.cookies.has(PREVIEW_COOKIE),
    dev: process.env.NODE_ENV !== 'production',
  })
  if (target) return NextResponse.redirect(target, 301)

  const tokenMove = orderTokenMove(request)
  if (tokenMove) return tokenMove

  const honoMove = honoPreviewMove(request, storeId)
  if (honoMove) return honoMove

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

  // The render queue (`lib/render-gate.ts`): while someone has waited 5 s for a render, a
  // crawler's page request is turned away with a 503 rather than joining the line.
  const priority = renderPriority(
    request.headers.get('user-agent'),
    SHOPPER_COOKIES.some((name) => request.cookies.has(name)),
  )
  const page =
    route.kind === 'rewrite' &&
    (request.method === 'GET' || request.method === 'HEAD') &&
    !(SEO_FILES as readonly string[]).includes(pick.pathname) &&
    !(FEED_FILES as readonly string[]).includes(pick.pathname)
  if (page && priority === PRIORITY.bot && renderGate().gate.congested()) {
    return new NextResponse('Busy, please retry shortly', {
      status: 503,
      headers: {
        'content-type': 'text/plain',
        'retry-after': String(RETRY_AFTER_S),
        'cache-control': 'no-store',
      },
    })
  }

  // Never trust routing headers from the client; set only what the proxy derived.
  const headers = new Headers(request.headers)
  for (const h of DERIVED_HEADERS) headers.delete(h)
  withNonce(headers)
  headers.set('x-store-id', storeId)
  // Its place in the render queue, and the signal that tells the render its visitor has gone.
  if (page) headers.set(RENDER_TICKET_HEADER, renderGate().tickets.issue(request.signal, priority))
  if (route.kind === 'rewrite' && route.missing) headers.set(MISSING_ROUTE_HEADER, '1')
  const country = visitorCountry(request.headers)
  if (country) headers.set('x-visitor-country', country)
  for (const [name, value] of marketHeaders(pick, markets, hostname, hostRoute.primaryHostname)) {
    headers.set(name, value)
  }
  // Imported Shopify themes read `form.posted_successfully?` after our form handlers
  // redirect back with `?form_posted=<type>` (lib/liquid-scope.ts).
  const posted = request.nextUrl.searchParams.get('form_posted')
  if (posted && /^[a-z_]{1,40}$/.test(posted)) headers.set('x-form-posted', posted)
  headers.set('x-pathname', pick.pathname)
  const listing = listingSearch(request.nextUrl.searchParams)
  if (listing) headers.set('x-listing', listing)

  if (route.kind === 'passthrough') return NextResponse.next({ request: { headers } })

  // The affiliate portal (`lib/portal-routing.ts`): on its own host once that is live, else here,
  // outside the theme, the password page and the theme's redirects.
  if (portalPathRest(pick.pathname) !== null) {
    const portalHost = await resolve(portalHostFor(hostname))
    const to = portalRedirect({
      hostname,
      port: host?.split(':')[1] ?? '',
      pathname: pick.pathname,
      search: request.nextUrl.search,
      protocol: request.nextUrl.protocol,
      method: request.method,
      portalLive: portalHost?.storeId === storeId,
      dev: process.env.NODE_ENV !== 'production',
    })
    if (to) return NextResponse.redirect(to, 302)
    headers.set(PORTAL_BASE_HEADER, PORTAL_PATH)
    const url = request.nextUrl.clone()
    url.pathname = route.path
    return NextResponse.rewrite(url, { request: { headers } })
  }

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
  if (preview && token && version && THEME_VERSION_ID.test(version))
    headers.set('x-theme-version', version)
  // Customize's Theme scripts view (`lib/liquid-design-mode.ts`): a valid preview, in a frame.
  const design = inFrame && request.nextUrl.searchParams.get(THEME_DESIGN_MODE_PARAM) === '1'
  if (preview && token && design) headers.set('x-theme-design-mode', '1')

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
  // A product page of a store on the Bun + Hono service (`lib/hono-island`); Next draws it on failure.
  const hono =
    !locked &&
    !plain &&
    wantsHono({
      enabled: lock.honoProduct,
      serviceUrl: honoEnv().url,
      method: request.method,
      pathname: pick.pathname,
      searchParams: request.nextUrl.searchParams,
      rsc: request.headers.has('rsc'),
      personal: Boolean(preview) || posted !== null || referred,
      marketPrefix: headers.get(MARKET_HEADERS.prefix) ?? '',
      cookie: (name) => request.cookies.get(name)?.value,
      handedBack,
      resting: honoResting(),
    })
  if ((plain || hono) && shared) headers.set('x-edge-cache-control', shared)
  // A shared copy goes to visitors from every region, so where the banner depends on the region
  // it is drawn without one and the browser asks `/api/consent-region` (`lib/consent-cookie.ts`).
  if (shared && lock.bannerRegions === 'consent_required') headers.set(CONSENT_PENDING_HEADER, '1')

  const url = request.nextUrl.clone()
  url.pathname = locked
    ? `${PASSWORD_PREFIX}/${storeId}`
    : plain
      ? plainPath(storeId, pick.pathname)
      : hono
        ? honoPath(storeId, pick.pathname)
        : route.path
  if (!locked) toSectionRendering(url, headers, storeId, request.method, pick.pathname)
  const response = NextResponse.rewrite(url, { request: { headers } })
  return finishPageResponse(response, {
    request,
    storeId,
    headers,
    host,
    hostname,
    pick,
    preview,
    param,
    secure,
    locked,
    seoFile,
    referred,
    shared,
    handedBack,
  })
}

export const config = {
  // /api/health is excluded: it's an infra liveness/readiness probe (Docker HEALTHCHECK,
  // deploy/docker-compose.prod.yml), not tied to any store's host, so it must answer even
  // when the request's Host header ("localhost" inside the container, no store configured
  // for it) would otherwise 404 here. `flags/`, `courier-logos/` and `email/` are files in
  // `public/`: through the proxy they were rewritten into the store's pages and 404ed
  // (checkout's Delhivery logo, and the emails' route truck and social icons, owner 22 Nov 2026).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|flags/|courier-logos/|email/|api/health).*)',
  ],
}
