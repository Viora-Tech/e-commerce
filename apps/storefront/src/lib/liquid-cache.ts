import { createHash, randomBytes } from 'node:crypto'
import type { LiquidPageContext } from '@commerce/core'

/**
 * Keys and helpers for caching an imported theme's rendered Liquid (`liquid-theme.ts`). Pure:
 * no database, no request. The store and its version are added by `store-cache.ts`; what is
 * here is everything else a render reads: the theme's files (theme id + version), the request
 * (origin, path, the form that was just posted) and the section's own settings.
 *
 * Renders write a placeholder where the request's CSP nonce goes, so one cached render serves
 * every request with that request's own nonce. The placeholder is random per process: theme
 * data cannot contain it, so a script that came in with data never gains a nonce.
 */
export const NONCE_MARK: string = (() => {
  // One per process, not per module copy: the render cache is shared by every route bundle
  // (pages, the plain HTML route, theme actions), so they must all read the same placeholder.
  const g = globalThis as unknown as { __liquidNonceMark?: string }
  g.__liquidNonceMark ??= `nonce${randomBytes(16).toString('hex')}`
  return g.__liquidNonceMark
})()

/** Cached Liquid with this request's nonce in place of the placeholder. */
export function withNonce(html: string, nonce: string): string {
  return html.includes(NONCE_MARK) ? html.replaceAll(NONCE_MARK, nonce) : html
}

/** What a Liquid render reads besides store data and the cart. */
export type LiquidRenderScope = {
  themeId: string
  /** The theme's files version (the import row's `updated_at`). */
  themeVersion: string
  origin: string
  /** Path only: Liquid never sees the query string. */
  path: string
  template: string
  /** `?form_posted=<type>` after one of our form handlers, or null. */
  postedForm: string | null
  /** The shopper's A/B test variations (`assignmentsKey`), blank when in none. */
  experiments?: string | undefined
  /** The page's market, language and country (`liquidMarketFor`), blank in the store's own. */
  market?: string | undefined
}

function scopeKey(scope: LiquidRenderScope): string {
  return [
    scope.themeId,
    scope.themeVersion,
    scope.origin,
    scope.path,
    scope.template,
    scope.postedForm ?? '',
    // Only when set, so pages outside any experiment keep their cache keys.
    ...(scope.experiments ? [scope.experiments] : []),
    ...(scope.market ? [`market:${scope.market}`] : []),
  ].join('|')
}

/** A short, stable digest of plain data, for cache keys. */
export function digest(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(value)).digest('base64url')
}

/**
 * A digest of rendered markup as it would be for any request: the request's nonce taken out.
 * Two renders of a section that differ only in their nonce have the same digest.
 */
export function markupDigest(html: string, nonce: string): string {
  const plain = nonce ? html.replaceAll(nonce, '') : html
  return createHash('sha1').update(plain).digest('base64url')
}

/** One section: the scope plus a digest of everything the section was placed with. */
export function sectionCacheKey(scope: LiquidRenderScope, section: unknown): string {
  return `liquid-section|${scopeKey(scope)}|${digest(section)}`
}

/** The theme's layout (`layout/theme.liquid`) around one page. */
export function layoutCacheKey(scope: LiquidRenderScope): string {
  return `liquid-layout|${scopeKey(scope)}`
}

/** What a render touched that decides how long, and for whom, its output may be kept. */
export type RenderTrace = {
  /** Read the shopper's cart (a cart count, the cart drawer). */
  cart: boolean
  /** Read the `customer` global (the signed-in shopper, or nil). */
  customer: boolean
  /** Read the clock (`'now' | date`). */
  clock: boolean
  /** Failed, or ran out of passes before every value had loaded. */
  failed: boolean
}

export function newTrace(): RenderTrace {
  return { cart: false, customer: false, clock: false, failed: false }
}

/**
 * The Liquid `cart` global, wrapped so any read of it marks the current trace. Liquid copies the
 * globals object per render but keeps this one object, so every read goes through the wrapper.
 */
export function traceCartReads<T extends object>(cart: T, current: () => RenderTrace): T {
  const mark = () => {
    current().cart = true
  }
  return new Proxy(cart, {
    get(target, key, receiver) {
      mark()
      return Reflect.get(target, key, receiver)
    },
    has(target, key) {
      mark()
      return Reflect.has(target, key)
    },
    ownKeys(target) {
      mark()
      return Reflect.ownKeys(target)
    },
  })
}

/**
 * Traces every render of `ctx` into the current trace: cart reads, clock reads and reads of the
 * `customer` global (signed in or nil).
 */
export function traceContextReads(ctx: LiquidPageContext, current: () => RenderTrace): void {
  ctx.globals.cart = traceCartReads(ctx.globals.cart as object, current)
  ctx.runtime.onClock = () => {
    current().clock = true
  }
  ctx.runtime.onCustomer = () => {
    current().customer = true
  }
}

/** What a cached render depends on besides its key: the cart, the signed-in shopper. */
export type CachedReads = { cart: boolean; customer: boolean }

/** A section's cached render: the HTML and what it read. */
export type CachedLiquid = { html: string } & CachedReads

/**
 * Whether a cached render can be served: anything not reading the cart or the shopper; a
 * cart-reading one only to a shopper whose cart is empty, and a `customer`-reading one only to
 * a signed-out shopper (that is what each was rendered with). Each is only looked at for a
 * render that read it.
 */
export async function servable(
  entry: CachedReads,
  cartEmpty: () => Promise<boolean>,
  signedOut: () => Promise<boolean>,
): Promise<boolean> {
  if (entry.cart && !(await cartEmpty())) return false
  return !entry.customer || (await signedOut())
}

/**
 * Whether a fresh render may be kept: a cart-reading one only when it was rendered with an empty
 * cart, a `customer`-reading one only when nobody was signed in (a shopper's own cart, name or
 * email is never cached).
 */
export function keepable(trace: RenderTrace, cartEmpty: boolean, signedIn: boolean): boolean {
  return (!trace.cart || cartEmpty) && (!trace.customer || !signedIn)
}

/** A failed render is kept this long: long enough to spare the CPU, short enough to recover. */
const FAILED_TTL_MS = 30_000

/** A render that shows the time is kept this long. */
const CLOCK_TTL_MS = 60_000

/** How long a render lives: briefly when it failed or shows the time, else the default. */
export function renderTtl(trace: RenderTrace, defaultMs: number): number {
  if (trace.failed) return Math.min(FAILED_TTL_MS, defaultMs)
  if (trace.clock) return Math.min(CLOCK_TTL_MS, defaultMs)
  return defaultMs
}
