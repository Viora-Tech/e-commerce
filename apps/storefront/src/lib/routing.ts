/**
 * Internal route segment every store page lives under. Never appears in a
 * public URL: the proxy rewrites `host/path` to `/-s/<storeId>/path`, and
 * refuses requests that arrive with the prefix already present.
 */
export const INTERNAL_PREFIX = '/-s'
/** Internal segment for the storefront password page, served in place of any page while locked. */
export const PASSWORD_PREFIX = '/-p'

const internal = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

export type Route =
  | { kind: 'rewrite'; path: string }
  | { kind: 'forbidden' }
  | { kind: 'passthrough' }

export function routeForStore(storeId: string, pathname: string): Route {
  if (internal(pathname, INTERNAL_PREFIX) || internal(pathname, PASSWORD_PREFIX)) {
    return { kind: 'forbidden' }
  }
  if (pathname.startsWith('/_next/') || pathname.startsWith('/api/')) {
    return { kind: 'passthrough' }
  }
  const rest = pathname === '/' ? '' : pathname
  return { kind: 'rewrite', path: `${INTERNAL_PREFIX}/${storeId}${rest}` }
}

/** Headers the proxy derives. Stripped from every incoming request so a client cannot forge them. */
export const DERIVED_HEADERS = ['x-store-id', 'x-visitor-country', 'x-theme-preview'] as const
