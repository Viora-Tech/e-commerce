/**
 * Internal route segment every store page lives under. Never appears in a
 * public URL: the proxy rewrites `host/path` to `/-s/<storeId>/path`, and
 * refuses requests that arrive with the prefix already present.
 */
export const INTERNAL_PREFIX = '/-s'
/** Internal segment for the storefront password page, served in place of any page while locked. */
export const PASSWORD_PREFIX = '/-p'
/** Internal segment for the platform login domain (`ACCOUNTS_URL`): provider sign-in and callbacks. */
export const ACCOUNTS_PREFIX = '/-a'

const internal = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

export type Route =
  | { kind: 'rewrite'; path: string }
  | { kind: 'forbidden' }
  | { kind: 'passthrough' }

export function routeForStore(storeId: string, pathname: string): Route {
  if (
    internal(pathname, INTERNAL_PREFIX) ||
    internal(pathname, PASSWORD_PREFIX) ||
    internal(pathname, ACCOUNTS_PREFIX)
  ) {
    return { kind: 'forbidden' }
  }
  if (pathname.startsWith('/_next/') || pathname.startsWith('/api/')) {
    return { kind: 'passthrough' }
  }
  const rest = pathname === '/' ? '' : pathname
  return { kind: 'rewrite', path: `${INTERNAL_PREFIX}/${storeId}${rest}` }
}

/** What the platform login domain serves: provider sign-in and the Truecaller callback. */
const ACCOUNTS_PATHS = /^\/(oauth\/(google|apple|facebook)\/(start|callback)|truecaller\/callback)$/

/** Route a request on the platform login domain. Nothing else is served there. */
export function routeForAccounts(pathname: string): Route {
  if (pathname.startsWith('/_next/')) return { kind: 'passthrough' }
  if (!ACCOUNTS_PATHS.test(pathname)) return { kind: 'forbidden' }
  return { kind: 'rewrite', path: `${ACCOUNTS_PREFIX}${pathname}` }
}

/**
 * A store's primary host when `host` is its branded checkout host (`<subdomain>.<primary>`, security
 * audit D-01 phase B), else null. `subdomain` is `CHECKOUT_SUBDOMAIN`; unset → never a checkout host.
 */
export function checkoutHostname(host: string | null, subdomain: string | null): string | null {
  if (!host || !subdomain) return null
  const prefix = `${subdomain}.`
  return host.startsWith(prefix) && host.length > prefix.length ? host.slice(prefix.length) : null
}

/**
 * Route a request on a store's checkout host: only the `/c/<token>` hand-off entry and the checkout
 * pages are served there; everything else is 404, so theme code has nothing to reach on this origin.
 */
export function routeForCheckoutHost(storeId: string, pathname: string): Route {
  if (pathname.startsWith('/_next/') || pathname.startsWith('/api/')) return { kind: 'passthrough' }
  const allowed =
    pathname === '/c' ||
    pathname.startsWith('/c/') ||
    pathname === '/checkout' ||
    pathname.startsWith('/checkout/')
  if (!allowed) return { kind: 'forbidden' }
  return { kind: 'rewrite', path: `${INTERNAL_PREFIX}/${storeId}${pathname}` }
}

/** Headers the proxy derives. Stripped from every incoming request so a client cannot forge them. */
export const DERIVED_HEADERS = [
  'x-store-id',
  'x-visitor-country',
  'x-theme-preview',
  'x-theme-version',
  'x-form-posted',
  'x-pathname',
  'x-listing',
  // Markets (`lib/markets.ts` MARKET_HEADERS).
  'x-market-id',
  'x-market-currency',
  'x-market-locale',
  'x-market-country',
  'x-market-prefix',
  'x-market-countries',
  'x-market-country-currencies',
  'x-market-languages',
] as const

/** Listing params an imported theme's collection and search pages read; the rest is noise. */
const LISTING_PARAM = /^(filter\.|q$|sort_by$|page$|options\[unavailable_products\]$)/

/**
 * A request's listing params (`filter.*`, `q`, `sort_by`, `page`, and a search form's
 * `options[unavailable_products]`) in a stable order, for an
 * imported theme's collection and search pages and the cache key of their render; empty when
 * there are none. Tracking params never split the cache.
 */
export function listingSearch(params: URLSearchParams): string {
  const kept = [...params].filter(([k, v]) => LISTING_PARAM.test(k) && v.trim() !== '')
  kept.sort(([a, x], [b, y]) => (a === b ? x.localeCompare(y) : a.localeCompare(b)))
  const qs = new URLSearchParams(kept.slice(0, 60)).toString()
  return qs.length <= 2000 ? qs : ''
}

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

/**
 * Where a redirecting domain sends its visitors: the store's primary, unless it is the www/apex
 * twin of a market's own domain (`www.waimers.ae` with the UAE market on `waimers.ae`), which
 * goes to that domain instead, so the shopper stays in their market.
 */
export function redirectHostFor(
  hostname: string,
  primaryHostname: string | null,
  marketHosts: readonly (string | null)[],
): string | null {
  const twin = hostname.startsWith('www.') ? hostname.slice(4) : `www.${hostname}`
  return marketHosts.includes(twin) ? twin : primaryHostname
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
