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

export type PrimaryRedirectInput = {
  /** Request hostname, lower case, no port. */
  hostname: string
  /** Request port, empty when none. */
  port: string
  pathname: string
  search: string
  protocol: string
  /** The store's live primary hostname, if any. */
  primaryHostname: string | null
  /** The domain is set to send its visitors to the primary. */
  redirect: boolean
  /** Admin thumbnails and the theme editor load the storefront in a frame. */
  inFrame: boolean
  /** A theme-preview link is being opened. */
  previewing: boolean
  /** Development: keep the request's scheme and port instead of forcing https. */
  dev: boolean
}

/** Paths that must answer on whichever host they were called on. */
const NEVER_REDIRECT = ['/api/', '/_next/', '/webhooks/']

/**
 * Where a non-primary domain sends its visitor, or null to serve the page.
 * Production always lands on https at the default port; development keeps
 * the scheme and port, so `http://old.test:3100` goes to `http://new.test:3100`.
 */
export function primaryRedirect(input: PrimaryRedirectInput): string | null {
  const primary = input.primaryHostname
  if (!input.redirect || !primary || primary === input.hostname) return null
  if (input.inFrame || input.previewing) return null
  if (NEVER_REDIRECT.some((p) => input.pathname.startsWith(p))) return null
  if (internal(input.pathname, INTERNAL_PREFIX) || internal(input.pathname, PASSWORD_PREFIX)) {
    return null
  }
  const scheme = input.dev ? input.protocol : 'https:'
  const port = input.dev && input.port ? `:${input.port}` : ''
  return `${scheme}//${primary}${port}${input.pathname}${input.search}`
}
