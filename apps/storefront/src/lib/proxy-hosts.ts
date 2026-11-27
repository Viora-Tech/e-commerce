import 'server-only'
import { type HostRoute, resolveHost, type StoreMarketRoute, storeMarkets } from '@commerce/db'
import { type NextRequest, NextResponse } from 'next/server'
import { accountsHostname } from './accounts-host'
import { db } from './db'
import {
  PORTAL_BASE_HEADER,
  portalHostBase,
  portalStoreHosts,
  routeForPortalHost,
} from './portal-routing'
import {
  checkoutHostname,
  DERIVED_HEADERS,
  routeForAccounts,
  routeForCheckoutHost,
} from './routing'
import { watchResolvers } from './store-changes'
import { createStoreResolver } from './store-resolver'

/**
 * The proxy's host lookups (`proxy.ts`): which store a hostname belongs to, a store's markets,
 * and the hosts that are not a store's own pages (the platform login domain, a store's branded
 * checkout host, the affiliate portal's host). Split from proxy.ts.
 */

export const resolve = createStoreResolver<HostRoute>({
  lookup: (hostname) => resolveHost(db(), hostname),
  // A miss belongs to no store: any store's change drops it (a domain may have been added).
  storeOf: (_hostname, route) => route?.storeId ?? null,
})

/**
 * A store's markets, cached like hosts. A failed lookup (a database blip, or this storefront
 * running before migration 0177) serves the primary market rather than failing the page.
 */
export const marketsOf = createStoreResolver<StoreMarketRoute[]>({
  lookup: (storeId) => storeMarkets(db(), storeId).catch(() => []),
  storeOf: (storeId) => storeId,
})

/**
 * Hosts and markets follow the store's writes (a domain or market saved in the admin) at once,
 * through the storefront's cache notifications; their TTL only covers a lost listener.
 */
export const watchRouting = watchResolvers(resolve, marketsOf)

/**
 * The answer for a host that is not a store's own domain: the platform login domain, a store's
 * branded checkout host or its affiliate portal host. Null for every other host.
 */
export async function routeOwnHost(
  request: NextRequest,
  hostname: string | null,
  withNonce: (headers: Headers) => void,
): Promise<NextResponse | null> {
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

  // The affiliate portal's own host (`affiliate.<store domain>`, `portal-routing.ts`): the
  // store from the domain under it; every path is the portal's.
  const portalStore = await portalHostStore(hostname)
  if (hostname && portalStore) {
    const route = routeForPortalHost(portalStore, request.nextUrl.pathname)
    if (route.kind === 'forbidden') return new NextResponse('Not found', { status: 404 })
    const headers = new Headers(request.headers)
    for (const h of DERIVED_HEADERS) headers.delete(h)
    withNonce(headers)
    headers.set('x-store-id', portalStore)
    headers.set('x-pathname', request.nextUrl.pathname)
    if (route.kind === 'passthrough') return NextResponse.next({ request: { headers } })
    headers.set(PORTAL_BASE_HEADER, '')
    const url = request.nextUrl.clone()
    url.pathname = route.path
    return NextResponse.rewrite(url, { request: { headers } })
  }
  return null
}

/**
 * The store a portal host (`affiliate.waimers.in`) belongs to: the store of the domain under it
 * (`waimers.in`, or its www twin). Null for any other host, and for a host that is itself another
 * store's domain (a store whose own address starts with `affiliate.`).
 */
async function portalHostStore(hostname: string | null): Promise<string | null> {
  const base = portalHostBase(hostname)
  if (!hostname || !base) return null
  let storeId: string | null = null
  for (const h of portalStoreHosts(base)) {
    storeId = (await resolve(h))?.storeId ?? null
    if (storeId) break
  }
  if (!storeId) return null
  const own = await resolve(hostname)
  return own && own.storeId !== storeId ? null : storeId
}
