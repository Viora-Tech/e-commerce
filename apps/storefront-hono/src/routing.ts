import { settingsSecret } from '@commerce/config'
import { resolveHost, type StoreMarketRoute, storeMarkets } from '@commerce/db'
import {
  forwardNonce,
  NONCE_HEADER,
  newNonce,
  scriptCsp,
  storefrontFrameAncestors,
} from '@/lib/csp'
import { db } from '@/lib/db'
import { HONO_FORWARD_HEADER, HONO_HOST_HEADER, honoForwardNonce } from '@/lib/hono-island/route'
import { MARKET_COOKIE, marketHeaders, pickMarket } from '@/lib/markets'
import { DERIVED_HEADERS } from '@/lib/routing'
import { createStoreResolver, hostnameFromHeader } from '@/lib/store-resolver'

/**
 * Behind the Next storefront (production): a request it forwards (`lib/hono-island/forward.ts`)
 * carries the headers its proxy derived (store, path, market, the shopper's cookies) and the outer
 * nonce, signed for that store and host (`x-hono-forward`). Only such a request is trusted; the
 * page uses that nonce and Next sets the CSP on the outer response.
 *
 * Direct (development and the benchmark, or `STOREFRONT_HONO_DIRECT=1`): the rest of this file,
 * what the Next proxy (`apps/storefront/src/proxy.ts`) works out before a product page renders,
 * with its own functions: the store from the Host header (cached for a minute, misses too), the
 * market and its headers, a fresh nonce and the CSP that names it. `STORE_ID` pins one store for
 * the pilot when the host does not resolve.
 *
 * Left out for the pilot (a full port takes them over): the primary-domain and market redirects,
 * URL redirects, the order-token swap, theme previews, the password page and the edge cache headers.
 */

const resolve = createStoreResolver({ lookup: (hostname) => resolveHost(db(), hostname) })
const marketsOf = createStoreResolver<StoreMarketRoute[]>({
  lookup: (storeId) => storeMarkets(db(), storeId).catch(() => []),
})

function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return undefined
}

export type Routed = {
  storeId: string
  /** The request headers the page reads, as the proxy forwards them. */
  headers: Headers
  /** The CSP the response carries; null behind Next, whose outer response carries it. */
  csp: { name: string; value: string } | null
}

/** A request the Next storefront forwarded, with its headers as the page reads them; else null. */
export function forwardedRequest(req: Request, secret: string): Routed | null {
  const storeId = req.headers.get('x-store-id')
  const host = req.headers.get(HONO_HOST_HEADER)
  const nonce = honoForwardNonce(secret, { storeId, host }, req.headers.get(HONO_FORWARD_HEADER))
  if (!nonce || !storeId || !host) return null
  const headers = new Headers(req.headers)
  headers.delete(HONO_FORWARD_HEADER)
  headers.delete(HONO_HOST_HEADER)
  headers.set('host', host)
  headers.set(NONCE_HEADER, nonce)
  return { storeId, headers, csp: null }
}

/** Requests that did not come through Next are answered only outside production, or when allowed. */
export const directAllowed = () =>
  process.env.NODE_ENV !== 'production' || process.env.STOREFRONT_HONO_DIRECT === '1'

export async function routeRequest(req: Request, pathname: string): Promise<Routed | null> {
  if (req.headers.has(HONO_FORWARD_HEADER)) return forwardedRequest(req, settingsSecret())
  if (!directAllowed()) return null
  const hostname = hostnameFromHeader(req.headers.get('host'))
  const route = hostname ? await resolve(hostname) : null
  const pinned = process.env.STORE_ID
  const storeId = route?.storeId ?? pinned
  if (!storeId) return null
  const markets = (await marketsOf(storeId)) ?? []
  const pick = pickMarket({
    markets,
    hostname: hostname ?? 'localhost',
    primaryHostname: route?.primaryHostname ?? null,
    pathname,
    cookie: cookieValue(req.headers.get('cookie'), MARKET_COOKIE),
  })
  const nonce = newNonce()
  const csp = scriptCsp({
    nonce,
    dev: process.env.NODE_ENV !== 'production',
    frameAncestors: storefrontFrameAncestors(process.env.ADMIN_URL),
  })
  const headers = new Headers(req.headers)
  for (const h of DERIVED_HEADERS) headers.delete(h)
  forwardNonce(headers, nonce, csp)
  headers.set('x-store-id', storeId)
  for (const [name, value] of marketHeaders(
    pick,
    markets,
    hostname ?? 'localhost',
    route?.primaryHostname ?? null,
  )) {
    headers.set(name, value)
  }
  headers.set('x-pathname', pick.pathname)
  return { storeId, headers, csp }
}
