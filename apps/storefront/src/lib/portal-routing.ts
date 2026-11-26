/**
 * The affiliate portal's addresses (Affiliates app). The portal is its own small app, outside the
 * store's theme, under the internal segment `/-f/<storeId>`. It answers on:
 *
 * - `affiliate.<store domain>` (`affiliate.waimers.in`): every path is the portal's, from `/`.
 *   The host is connected like any other domain (Settings › Domains), so it gets its DNS check,
 *   Cloudflare custom hostname and certificate from the same flow.
 * - `/affiliate/...` on every domain of the store (`www.waimers.in/affiliate`,
 *   `<slug>.koomerce.app/affiliate`): the fallback that always works. Once the portal host is
 *   live, page loads there move to it (`portalRedirect`).
 */

/** Internal segment the portal's pages live under; never in a public URL. */
export const PORTAL_PREFIX = '/-f'
/** The subdomain the portal answers on. */
export const PORTAL_SUBDOMAIN = 'affiliate'
/** The portal's path on the store's own domains. */
export const PORTAL_PATH = '/affiliate'
/** Where the portal's links start: `''` on the portal host, `/affiliate` on a store domain. */
export const PORTAL_BASE_HEADER = 'x-portal-base'
/**
 * The store-domain page that carries a signed-in shopper over to the portal host. It must answer
 * on the store's domain, where their session cookie is, so it never moves to the portal host.
 */
export const PORTAL_CONTINUE_PATH = `${PORTAL_PATH}/continue`

type Route = { kind: 'rewrite'; path: string } | { kind: 'forbidden' } | { kind: 'passthrough' }

/** `waimers.in` for `affiliate.waimers.in`; null for any other host. */
export function portalHostBase(host: string | null): string | null {
  if (!host) return null
  const prefix = `${PORTAL_SUBDOMAIN}.`
  if (!host.startsWith(prefix)) return null
  const base = host.slice(prefix.length)
  // At least `name.tld` after the prefix: `affiliate.localhost` is a store's own name, not ours.
  return base.includes('.') ? base : null
}

/** Hostnames to look the store up by, for a portal host's base: as given, then its www twin. */
export function portalStoreHosts(base: string): string[] {
  return base.startsWith('www.') ? [base, base.slice(4)] : [base, `www.${base}`]
}

/** The portal host for one of the store's domains: `www.waimers.in` → `affiliate.waimers.in`. */
export function portalHostFor(hostname: string): string {
  const base = hostname.startsWith('www.') ? hostname.slice(4) : hostname
  return `${PORTAL_SUBDOMAIN}.${base}`
}

/** `/affiliate` → `''`, `/affiliate/payouts` → `/payouts`; null for any other path. */
export function portalPathRest(pathname: string): string | null {
  if (pathname === PORTAL_PATH) return ''
  if (pathname.startsWith(`${PORTAL_PATH}/`)) return pathname.slice(PORTAL_PATH.length)
  return null
}

/** The internal path of a portal page. */
export function portalInternalPath(storeId: string, rest: string): string {
  return `${PORTAL_PREFIX}/${storeId}${rest === '/' ? '' : rest}`
}

/** Route a request on a portal host: Next's files and the API pass, everything else is the portal. */
export function routeForPortalHost(storeId: string, pathname: string): Route {
  if (pathname.startsWith('/_next/') || pathname.startsWith('/api/')) return { kind: 'passthrough' }
  // Internal segments (`/-s/...`, `/-f/...`) are never reachable from a URL.
  if (/^\/-[a-z](\/|$)/.test(pathname)) return { kind: 'forbidden' }
  // The store-domain hand-off has no meaning here.
  if (pathname === '/continue') return { kind: 'forbidden' }
  return { kind: 'rewrite', path: portalInternalPath(storeId, pathname) }
}

export type PortalRedirectInput = {
  hostname: string
  /** Request port, empty when none. */
  port: string
  pathname: string
  search: string
  protocol: string
  method: string
  /** The store has `affiliate.<domain>` connected and live. */
  portalLive: boolean
  dev: boolean
}

/**
 * Where a page load of `/affiliate/...` on a store domain goes once the portal host is live:
 * the same page there (`/affiliate/payouts` → `affiliate.waimers.in/payouts`). Null to serve it
 * here: the host is not live, a non-page request, or the sign-in hand-off.
 */
export function portalRedirect(input: PortalRedirectInput): string | null {
  if (!input.portalLive) return null
  if (input.method !== 'GET' && input.method !== 'HEAD') return null
  if (input.pathname === PORTAL_CONTINUE_PATH) return null
  const rest = portalPathRest(input.pathname)
  if (rest === null) return null
  const scheme = input.dev ? input.protocol : 'https:'
  const port = input.dev && input.port ? `:${input.port}` : ''
  return `${scheme}//${portalHostFor(input.hostname)}${port}${rest || '/'}${input.search}`
}

/** The portal host's origin for a store domain's origin: `https://www.waimers.in` → `https://affiliate.waimers.in`. */
export function portalOriginFor(origin: string): string {
  const url = new URL(origin)
  url.hostname = portalHostFor(url.hostname)
  return url.origin
}
