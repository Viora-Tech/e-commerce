/** SOURCE OF TRUTH: Pixels app rules shared by the storefront, admin and worker — WHAT: event names, event ids, which Purchase trigger fires on which order event, the consent gate and skip reasons / WHY: browser and server copies of an event must agree on the id and on whether it is sent at all, so the rules live in one pure module */
import type {
  PixelEventName,
  PixelPurchaseTrigger,
  PixelSkipReason,
  PixelTracking,
} from '@commerce/db'

/*
 * Pure: no database, no node:crypto. The storefront's browser code imports it through
 * `@commerce/core/pixels`. Design: docs/superpowers/specs/2026-10-24-pixels-design.md §4.
 */

export type { PixelEventName, PixelPurchaseTrigger, PixelSkipReason, PixelTracking }

export const PIXEL_EVENTS = [
  'PageView',
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
] as const satisfies readonly PixelEventName[]

export const PURCHASE_TRIGGERS = [
  'placed',
  'paid',
  'delivered',
  'paid_or_delivered',
] as const satisfies readonly PixelPurchaseTrigger[]

/** At most this many pixels per store (design §3, builder's call). */
export const MAX_PIXELS_PER_STORE = 10

/** Meta accepts server events up to 7 days after `event_time`. */
export const META_MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** The log keeps 30 days. */
export const PIXEL_LOG_RETENTION_DAYS = 30

const PIXEL_ID = /^[0-9]{10,20}$/

export function isPixelEventName(value: unknown): value is PixelEventName {
  return typeof value === 'string' && (PIXEL_EVENTS as readonly string[]).includes(value)
}

export function isMetaPixelId(value: string): boolean {
  return PIXEL_ID.test(value.trim())
}

// Event ids. The browser `fbq(..., {eventID})` and the server `event_id` must be equal, so
// Meta counts the event once (48 h window). Purchase, InitiateCheckout and AddToCart are
// derived from records both sides know; PageView and ViewContent get a fresh UUID.

const ID_PART = /^[A-Za-z0-9-]{1,64}$/

export function purchaseEventId(orderId: string): string {
  return `ord_${orderId}`
}

export function initiateCheckoutEventId(cartId: string): string {
  return `ic_${cartId}`
}

/** `n` counts the adds to that line, so adding the same line twice is two events. */
export function addToCartEventId(cartLineId: string, n: number): string {
  return `atc_${cartLineId}_${Math.max(1, Math.floor(n))}`
}

/**
 * An event id from the browser, accepted only in the shapes we mint: `ord_`, `ic_`, `atc_` or a
 * bare UUID. Anything else is refused, so a page cannot write arbitrary text into the log.
 */
export function isValidEventId(name: PixelEventName, id: string): boolean {
  if (id.length > 120) return false
  if (name === 'Purchase') return id.startsWith('ord_') && ID_PART.test(id.slice(4))
  if (name === 'InitiateCheckout') return id.startsWith('ic_') && ID_PART.test(id.slice(3))
  if (name === 'AddToCart') return /^atc_[A-Za-z0-9-]{1,64}_\d{1,4}$/.test(id)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

// First-party Meta cookies, set by our own `/api/px` so Safari's 7-day cap on script cookies
// does not apply. Format: `fb.<subdomain index>.<creation ms>.<random or fbclid>`.

export const FBP_COOKIE = '_fbp'
export const FBC_COOKIE = '_fbc'
/** 390 days, Meta's own lifetime for these cookies. */
export const FB_COOKIE_MAX_AGE = 60 * 60 * 24 * 390

const FBP = /^fb\.[0-2]\.\d{10,13}\.\d{1,20}$/
const FBC = /^fb\.[0-2]\.\d{10,13}\.[A-Za-z0-9_-]{1,500}$/
const FBCLID = /^[A-Za-z0-9_-]{1,500}$/

/** `_fbp` for a browser that has none: creation time plus a random 10-digit number. */
export function mintFbp(now: Date, random: number): string {
  const n = Math.floor(Math.abs(random) * 1e10) % 1e10
  return `fb.1.${now.getTime()}.${String(n).padStart(10, '0')}`
}

/** `_fbc` from an ad click's `fbclid`, or null when it is not a plausible click id. */
export function fbcFromClick(fbclid: string | null | undefined, now: Date): string | null {
  const id = fbclid?.trim() ?? ''
  return FBCLID.test(id) ? `fb.1.${now.getTime()}.${id}` : null
}

export function isValidFbp(value: string | null | undefined): value is string {
  return typeof value === 'string' && FBP.test(value)
}

export function isValidFbc(value: string | null | undefined): value is string {
  return typeof value === 'string' && FBC.test(value)
}

/** The click id inside an `_fbc`, so a new click with the same id keeps the old cookie. */
export function fbclidOf(fbc: string): string {
  return fbc.split('.').slice(3).join('.')
}

// Purchase trigger.

export type OrderPurchaseEvent = 'order.placed' | 'order.paid' | 'order.delivered'

/**
 * Whether this order event sends Purchase for a pixel with this trigger.
 * `paid_or_delivered`: prepaid orders when paid, cash on delivery when delivered.
 */
export function purchaseTriggerMatches(
  trigger: PixelPurchaseTrigger,
  event: OrderPurchaseEvent,
  paymentMethod: string | null | undefined,
): boolean {
  if (trigger === 'placed') return event === 'order.placed'
  if (trigger === 'paid') return event === 'order.paid'
  if (trigger === 'delivered') return event === 'order.delivered'
  return paymentMethod === 'cod' ? event === 'order.delivered' : event === 'order.paid'
}

/**
 * The browser sends Purchase only for pixels set to "placed": a paid or delivered server
 * Purchase can come after Meta's 48 h dedup window, and the two would count twice.
 */
export function browserSendsPurchase(trigger: PixelPurchaseTrigger): boolean {
  return trigger === 'placed'
}

/** Paid and delivered can arrive after Meta's 7-day limit: the admin warns. */
export function triggerMayBeTooLate(trigger: PixelPurchaseTrigger): boolean {
  return trigger !== 'placed'
}

// Consent and skips.

/** Pixel events need marketing consent (DPDP opt in), browser and server alike. */
export function hasMarketingConsent(tracking: PixelTracking | null | undefined): boolean {
  return tracking?.consent?.marketing === true
}

export type PurchaseOrderFacts = {
  isTest: boolean
  importedFrom: string | null
  tracking: PixelTracking | null
  placedAt: Date
}

/**
 * Why an order's server Purchase is not sent, or null to send it. Test orders (gateway test
 * keys) and imported orders never count; an order without collector tracking or without
 * marketing consent is skipped; Meta refuses events older than 7 days.
 */
export function purchaseSkipReason(o: PurchaseOrderFacts, now: Date): PixelSkipReason | null {
  if (o.isTest) return 'test_order'
  if (o.importedFrom) return 'imported'
  if (!o.tracking) return 'no_tracking'
  if (!hasMarketingConsent(o.tracking)) return 'no_consent'
  if (now.getTime() - o.placedAt.getTime() > META_MAX_EVENT_AGE_MS) return 'too_old'
  return null
}
