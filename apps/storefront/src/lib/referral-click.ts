import {
  decodeReferral,
  encodeReferral,
  isBotUserAgent,
  refCodeOf,
  SESSION_IDLE_MS,
} from '@commerce/core/marketing'

export type ReferralClickInput = {
  /** The landing URL's `?ref=`. */
  param: string | null
  /** The shopper's current referral cookie, if any. */
  existing: string | undefined
  method: string
  userAgent: string | null
  /** A router or browser prefetch, not a shopper opening the link. */
  prefetch: boolean
  /** The shopper said yes to marketing cookies on the banner (owner, 12 Nov 2026). */
  marketing: boolean
  now: Date
}

/** A landing kept in the tab is honoured this long after the click. */
const PENDING_MAX_AGE_MS = 24 * 60 * 60_000

/**
 * What the proxy does with an affiliate link landing (`?ref=<code>`): the referral cookie to
 * set, and whether the click counts. Pure. Bots, link previews and prefetches get neither. The
 * same code again inside half an hour is the same visit (a reload, the back button): the cookie
 * moves to now but the click is not counted twice. The count is the affiliate's per-day total
 * and stores nothing about the shopper, so it needs no consent. The cookie waits for a yes to
 * marketing cookies (`cookie: null` until then); the banner sets it later from the landing it
 * kept in the tab (`referralCookieFromPending`). A coupon code earns either way.
 */
export function referralClick(
  input: ReferralClickInput,
): { code: string; cookie: string | null; count: boolean } | null {
  const code = refCodeOf(input.param)
  if (!code || input.method !== 'GET' || input.prefetch) return null
  if (isBotUserAgent(input.userAgent)) return null
  const previous = decodeReferral(input.existing)
  const repeat =
    previous?.code === code && input.now.getTime() - previous.at.getTime() < SESSION_IDLE_MS
  return {
    code,
    cookie: input.marketing ? encodeReferral({ code, at: input.now }) : null,
    count: !repeat,
  }
}

/**
 * The referral cookie for a landing the banner kept in the tab, once the shopper says yes to
 * marketing: dated at the click, so the store's link window counts from then. Null for anything
 * that is not a code, a time in the future or a landing over a day old.
 */
export function referralCookieFromPending(raw: unknown, now: Date): string | null {
  if (!raw || typeof raw !== 'object') return null
  const { code: rawCode, at } = raw as { code?: unknown; at?: unknown }
  const code = refCodeOf(typeof rawCode === 'string' ? rawCode : null)
  if (!code || typeof at !== 'number' || !Number.isFinite(at)) return null
  const age = now.getTime() - at
  if (age < 0 || age > PENDING_MAX_AGE_MS) return null
  return encodeReferral({ code, at: new Date(at) })
}

/**
 * Whether a request is a prefetch (Next's router, or the browser's speculation rules). A
 * prerender is not: the shopper may well open it, and then the cookie must already be there.
 */
export function isPrefetch(headers: Headers): boolean {
  if (headers.has('next-router-prefetch')) return true
  const purpose = headers.get('sec-purpose') ?? headers.get('purpose') ?? ''
  return purpose.includes('prefetch') && !purpose.includes('prerender')
}
