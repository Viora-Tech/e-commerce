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
  now: Date
}

/**
 * What the proxy does with an affiliate link landing (`?ref=<code>`): the referral cookie to
 * set, and whether the click counts. Pure. Bots, link previews and prefetches get neither. The
 * same code again inside half an hour is the same visit (a reload, the back button): the cookie
 * moves to now but the click is not counted twice. The count is the affiliate's per-day total
 * and stores nothing about the shopper, so it needs no analytics consent.
 */
export function referralClick(
  input: ReferralClickInput,
): { code: string; cookie: string; count: boolean } | null {
  const code = refCodeOf(input.param)
  if (!code || input.method !== 'GET' || input.prefetch) return null
  if (isBotUserAgent(input.userAgent)) return null
  const previous = decodeReferral(input.existing)
  const repeat =
    previous?.code === code && input.now.getTime() - previous.at.getTime() < SESSION_IDLE_MS
  return { code, cookie: encodeReferral({ code, at: input.now }), count: !repeat }
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
