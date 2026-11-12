import { createHmac, timingSafeEqual } from 'node:crypto'
import { HONO_PREFIX } from '../routing'

/**
 * Which requests the proxy sends to the Bun + Hono product page service (`apps/storefront-hono`),
 * and whether its answer can go to the shopper. Pure apart from the HMAC; `proxy.ts` asks once per
 * request and `app/-x/[storeId]/products/[handle]/route.ts` judges the answer.
 *
 * Side by side with Next: only `/products/<handle>` of a store with `delivery.honoProduct` on, only
 * while `STOREFRONT_HONO_URL` is set, and anything the service cannot answer well (an error, a
 * timeout, a page it does not draw, a 404) is drawn by the Next page through the plain path's
 * signed hand-back (`lib/plain-html/forward.ts`).
 */

/** A shopper (or the owner) can opt one browser out: `wc_hono=off` keeps the Next product page. */
export const HONO_OPT_OUT_COOKIE = 'wc_hono'

/** Marks a request the Next storefront forwards to the service; carries the outer nonce, signed. */
export const HONO_FORWARD_HEADER = 'x-hono-forward'

/** The Host the shopper asked for (fetch sets its own `host`); covered by the signature. */
export const HONO_HOST_HEADER = 'x-hono-host'

/** What the service answers in `x-storefront-render` for a page it drew. */
export const HONO_RENDER = 'hono'

/** Query params that change the product page Next draws (alternate template, review links). */
const PERSONAL_PARAMS = ['view', 'review', 'write'] as const

const PRODUCT = /^\/products\/([^/]+)\/?$/

/** The product handle on a `/products/<handle>` path, decoded; null for any other path. */
export function honoProductHandle(pathname: string): string | null {
  const raw = PRODUCT.exec(pathname)?.[1]
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}

export type HonoRouteInput = {
  /** The store's `delivery.honoProduct` switch. */
  enabled: boolean
  /** `STOREFRONT_HONO_URL`; unset turns the service off for every store. */
  serviceUrl: string | null
  method: string
  pathname: string
  searchParams: URLSearchParams
  /** A client-side navigation's payload (`RSC: 1`): only the Next page can answer it. */
  rsc: boolean
  /** A theme preview, the password page, a form result or a referral landing. */
  personal: boolean
  /** The request is in a subfolder market (`/ae`): not drawn by the service yet. */
  marketPrefix: string
  cookie: (name: string) => string | undefined
  /** This is a page handed back to Next (`PLAIN_SKIP_HEADER` verified). */
  handedBack: boolean
  /** The breaker is open after repeated failures (`honoBreaker`). */
  resting: boolean
}

/** Whether this request goes to the Hono service. */
export function wantsHono(input: HonoRouteInput): boolean {
  if (!input.enabled || !input.serviceUrl || input.handedBack || input.resting) return false
  if (input.method !== 'GET' && input.method !== 'HEAD') return false
  if (input.rsc || input.personal || input.marketPrefix) return false
  if (input.cookie(HONO_OPT_OUT_COOKIE) === 'off') return false
  if (PERSONAL_PARAMS.some((p) => input.searchParams.has(p))) return false
  return honoProductHandle(input.pathname) !== null
}

/** Where the page loads the island's script and its chunks from (`app/api/hono-island`). */
export const HONO_ISLAND_PATH = '/api/hono-island'

/** An island file name the asset route may fetch (built names: `[name]-[hash].js|css`); else null. */
export function honoIslandFile(name: string): string | null {
  return /^[A-Za-z0-9_-]{1,80}\.(js|css)$/.test(name) ? name : null
}

/** The content type an island file is served with. */
export function islandFileType(name: string): string {
  return name.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8'
}

/** The internal path the proxy rewrites a Hono product page to. */
export function honoPath(storeId: string, pathname: string): string {
  return `${HONO_PREFIX}/${storeId}${pathname}`
}

/** What a forward is signed for: the store, the shopper's host and the outer nonce. */
export type HonoForward = { storeId: string; host: string; nonce: string }

const sign = (secret: string, f: HonoForward) =>
  createHmac('sha256', secret)
    .update(`hono-forward|${f.storeId}|${f.host}|${f.nonce}`)
    .digest('base64url')

/** The forward header's value: the outer request's nonce, signed for this store and host. */
export function honoForwardToken(secret: string, f: HonoForward): string {
  return `${f.nonce}.${sign(secret, f)}`
}

/**
 * The nonce a verified forward carries, so the service writes the page with the nonce the
 * outer response's CSP names and trusts the store and market headers beside it; null otherwise.
 */
export function honoForwardNonce(
  secret: string,
  to: { storeId: string | null; host: string | null },
  value: string | null,
): string | null {
  const { storeId, host } = to
  if (!secret || !storeId || !host || !value) return null
  const dot = value.lastIndexOf('.')
  if (dot <= 0) return null
  const nonce = value.slice(0, dot)
  if (!/^[A-Za-z0-9+/=_-]{8,64}$/.test(nonce)) return null
  const given = Buffer.from(value.slice(dot + 1))
  const want = Buffer.from(sign(secret, { storeId, host, nonce }))
  return given.length === want.length && timingSafeEqual(given, want) ? nonce : null
}

/** What came back from the service, as far as the fallback decision needs it. */
export type HonoAnswer =
  | { status: number; render: string | null; contentType: string | null; skip: string | null }
  | { error: 'timeout' | 'unreachable' }

/** Use the service's page, or why Next draws it instead (sent as `x-hono-fallback`). */
export type HonoVerdict = { use: true } | { use: false; reason: string; failure: boolean }

/**
 * Only a whole product page the service says it drew goes to the shopper. A page it chose not
 * to draw (501 with a skip reason) or could not find (404, Next draws its own 404 page) falls
 * back without counting as a failure; errors, timeouts and anything unexpected count toward
 * the breaker.
 */
export function honoVerdict(answer: HonoAnswer): HonoVerdict {
  if ('error' in answer) return { use: false, reason: answer.error, failure: true }
  if (answer.status === 501)
    return { use: false, reason: `skip:${answer.skip ?? '?'}`, failure: false }
  if (answer.status === 404) return { use: false, reason: 'not-found', failure: false }
  if (answer.status !== 200) return { use: false, reason: `status-${answer.status}`, failure: true }
  if (answer.render !== HONO_RENDER) return { use: false, reason: 'not-hono', failure: true }
  if (!answer.contentType?.startsWith('text/html')) {
    return { use: false, reason: 'not-html', failure: true }
  }
  return { use: true }
}

/** Failures in a row before the service rests, and for how long. */
export const BREAKER_FAILURES = 5
export const BREAKER_REST_MS = 30_000

export type Breaker = { failures: number; restUntil: number }

/**
 * A small circuit breaker: after `BREAKER_FAILURES` failures in a row, no page goes to the
 * service for `BREAKER_REST_MS`, so a down service costs shoppers one timeout each only five
 * times, not on every product page. One good answer closes it again.
 */
export function honoBreaker(state: Breaker, now: number) {
  return {
    resting: () => state.restUntil > now,
    note: (verdict: HonoVerdict) => {
      if (verdict.use) {
        state.failures = 0
        state.restUntil = 0
        return
      }
      if (!verdict.failure) return
      state.failures += 1
      if (state.failures >= BREAKER_FAILURES) {
        state.failures = 0
        state.restUntil = now + BREAKER_REST_MS
      }
    },
  }
}

/**
 * A buy box island call (`./actions.ts`) comes from a page on this host: the body is JSON (a
 * cross-site page cannot send that without a preflight the route never answers) and a present
 * `Origin` is this host, as Next checks for its server actions.
 */
export function sameOrigin(req: Request): boolean {
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) return false
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.get('host')
  } catch {
    return false
  }
}
