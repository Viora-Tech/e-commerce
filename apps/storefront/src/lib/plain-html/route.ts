import { createHmac, timingSafeEqual } from 'node:crypto'
import { PLAIN_PREFIX } from '../routing'

/**
 * Which requests the proxy sends down the plain HTML path (`app/-h/[storeId]/[[...path]]`): an
 * imported Shopify theme's page written straight into the response, with no React runtime
 * (docs/design/storefront-plain-html.md). Pure apart from the HMAC; `proxy.ts` asks once per
 * request.
 *
 * Only what the proxy can tell cheaply is decided here (the store's switch, the path, the
 * request). Whether the page itself can go out plain (every section the theme's own, no React
 * widget the page needs) is checked by the route, which hands an ineligible page back to the
 * React page through this same server (`forward.ts`), marked with `PLAIN_SKIP_HEADER`.
 */

/** The page kinds the plain path draws so far. */
export type PlainKind = 'home' | 'page'

/** Our own route under `/pages/` (`app/-s/[storeId]/pages/wishlist`), never a theme page. */
const OWN_PAGES = new Set(['wishlist'])

const PAGE = /^\/pages\/([^/]+)\/?$/

/** The kind of page `pathname` is, when the plain path can draw it; null otherwise. */
export function plainKind(pathname: string): PlainKind | null {
  if (pathname === '/') return 'home'
  const handle = PAGE.exec(pathname)?.[1]
  if (handle && !OWN_PAGES.has(handle.toLowerCase())) return 'page'
  return null
}

/** The page's handle on a `/pages/<handle>` path, decoded; null for any other path. */
export function plainPageHandle(pathname: string): string | null {
  const raw = PAGE.exec(pathname)?.[1]
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** A shopper (or the owner) can opt one browser out: `wc_plain=off` keeps the React pages. */
export const PLAIN_OPT_OUT_COOKIE = 'wc_plain'

/** Marks the route's hand-back to the React page; carries the nonce the outer request used. */
export const PLAIN_SKIP_HEADER = 'x-plain-skip'

export type PlainRouteInput = {
  /** Preferences › Storefront speed is on for this store. */
  enabled: boolean
  /** `STOREFRONT_PLAIN_HTML=off`: the whole deployment keeps the React pages. */
  killed: boolean
  method: string
  pathname: string
  /** A client-side navigation's payload (`RSC: 1`): only the React page can answer it. */
  rsc: boolean
  /** A theme preview, the password page, a form result or a referral landing. */
  personal: boolean
  /** The request is in a subfolder market (`/ae`): not drawn plain yet. */
  marketPrefix: string
  /** Cookies the request carries, by name and value. */
  cookie: (name: string) => string | undefined
  /** This is the route handing the page back (`PLAIN_SKIP_HEADER` verified). */
  handedBack: boolean
}

/** Whether this request goes down the plain HTML path. */
export function wantsPlainHtml(input: PlainRouteInput): boolean {
  if (!input.enabled || input.killed || input.handedBack) return false
  if (input.method !== 'GET' && input.method !== 'HEAD') return false
  if (input.rsc || input.personal || input.marketPrefix) return false
  if (input.cookie(PLAIN_OPT_OUT_COOKIE) === 'off') return false
  return plainKind(input.pathname) !== null
}

/** The internal path the proxy rewrites a plain page to. */
export function plainPath(storeId: string, pathname: string): string {
  return `${PLAIN_PREFIX}/${storeId}${pathname === '/' ? '' : pathname}`
}

const sign = (secret: string, nonce: string) =>
  createHmac('sha256', secret).update(`plain-skip|${nonce}`).digest('base64url')

/** The hand-back header's value: the outer request's nonce, signed with the settings secret. */
export function plainSkipToken(secret: string, nonce: string): string {
  return `${nonce}.${sign(secret, nonce)}`
}

/**
 * The nonce a verified hand-back carries, so the React page is written with the nonce the
 * outer response's CSP header names; null for anything else (a client cannot forge one).
 */
export function plainSkipNonce(secret: string, value: string | null): string | null {
  if (!secret || !value) return null
  const dot = value.lastIndexOf('.')
  if (dot <= 0) return null
  const nonce = value.slice(0, dot)
  if (!/^[A-Za-z0-9+/=_-]{8,64}$/.test(nonce)) return null
  const given = Buffer.from(value.slice(dot + 1))
  const want = Buffer.from(sign(secret, nonce))
  return given.length === want.length && timingSafeEqual(given, want) ? nonce : null
}
