import { CONSENT_COOKIE } from '@commerce/core/preferences'
import { withQuery } from '@commerce/core/redirects'
import { THEME_PREVIEW_PARAM } from '@commerce/core/theme'
import { type HostRoute, resolveHost } from '@commerce/db'
import { type NextRequest, NextResponse } from 'next/server'
import { SEO_FILES } from './data/seo'
import { accountsHostname } from './lib/accounts-host'
import { analyticsAllowed } from './lib/consent-cookie'
import { forwardNonce, newNonce, scriptCsp, storefrontFrameAncestors } from './lib/csp'
import { db } from './lib/db'
import { redirectFor } from './lib/redirects'
import {
  DERIVED_HEADERS,
  PASSWORD_PREFIX,
  primaryRedirect,
  routeForAccounts,
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

/** A version id from the admin (`?theme-version=`): a uuid, nothing else reaches the header. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const resolve = createStoreResolver<HostRoute>({
  lookup: (hostname) => resolveHost(db(), hostname),
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
  const nonce = newNonce()
  const csp = scriptCsp({
    nonce,
    dev: process.env.NODE_ENV !== 'production',
    frameAncestors: storefrontFrameAncestors(process.env.ADMIN_URL),
  })
  const response = await routeRequest(request, (headers) => forwardNonce(headers, nonce, csp))
  response.headers.set(csp.name, csp.value)
  return response
}

async function routeRequest(request: NextRequest, withNonce: (headers: Headers) => void) {
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
  const hostRoute = hostname ? await resolve(hostname) : null
  if (!hostname || !hostRoute) {
    return new NextResponse(`No store is configured for ${hostname ?? 'this host'}.`, {
      status: 404,
      headers: { 'content-type': 'text/plain' },
    })
  }
  const { storeId } = hostRoute

  // Old domains and the www/apex twin send shoppers to the primary domain.
  const target = primaryRedirect({
    hostname,
    port: host?.split(':')[1] ?? '',
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    protocol: request.nextUrl.protocol,
    primaryHostname: hostRoute.primaryHostname,
    redirect: hostRoute.redirect,
    inFrame: request.headers.get('sec-fetch-dest') === 'iframe',
    previewing: request.nextUrl.searchParams.has(THEME_PREVIEW_PARAM),
    dev: process.env.NODE_ENV !== 'production',
  })
  if (target) return NextResponse.redirect(target, 301)

  const route = routeForStore(storeId, request.nextUrl.pathname)
  if (route.kind === 'forbidden') return new NextResponse('Not found', { status: 404 })

  // Never trust routing headers from the client; set only what the proxy derived.
  const headers = new Headers(request.headers)
  for (const h of DERIVED_HEADERS) headers.delete(h)
  withNonce(headers)
  headers.set('x-store-id', storeId)
  const country = visitorCountry(request)
  if (country) headers.set('x-visitor-country', country)
  // Imported Shopify themes read `form.posted_successfully?` after our form handlers
  // redirect back with `?form_posted=<type>` (lib/liquid-theme.ts).
  const posted = request.nextUrl.searchParams.get('form_posted')
  if (posted && /^[a-z_]{1,40}$/.test(posted)) headers.set('x-form-posted', posted)
  headers.set('x-pathname', request.nextUrl.pathname)

  if (route.kind === 'passthrough') return NextResponse.next({ request: { headers } })

  // URL redirects (Content → Menus → URL redirects, imported Shopify paths) answer
  // before anything renders, so an old link never shows the password page first.
  if (request.method === 'GET' || request.method === 'HEAD') {
    const target = await redirectFor(storeId, request.nextUrl.pathname)
    if (target) {
      const to = new URL(withQuery(target, request.nextUrl.search), request.nextUrl)
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
  const seoFile = (SEO_FILES as readonly string[]).includes(request.nextUrl.pathname)
  const locked =
    lock.enabled &&
    !seoFile &&
    !preview &&
    !hasAccess(storeId, lock.password, request.cookies.get(ACCESS_COOKIE)?.value)

  const url = request.nextUrl.clone()
  url.pathname = locked ? `${PASSWORD_PREFIX}/${storeId}` : route.path
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
  return response
}

export const config = {
  // /api/health is excluded: it's an infra liveness/readiness probe (Docker HEALTHCHECK,
  // deploy/docker-compose.prod.yml), not tied to any store's host, so it must answer even
  // when the request's Host header ("localhost" inside the container, no store configured
  // for it) would otherwise 404 here.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
}
