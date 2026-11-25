/** SOURCE OF TRUTH: the Loyalty points referral cookie — WHAT: a member's link (`?ref=CODE`, 8 letters and digits) kept in a first-party cookie until the friend signs in or checks out, and when a landing sets it / WHY: the proxy, the `/api/loyalty` routes and checkout read the same name and rule; pure so it is tested without Next */

/** Host-only, first-party: the member code a friend arrived with. */
export const LOYALTY_REF_COOKIE = 'wc_lref'

/** How long a friend's link is remembered. */
export const LOYALTY_REF_MAX_AGE = 30 * 24 * 60 * 60

/** A member's referral code as core stores it (upper case), or null for anything else. */
export function loyaltyRefCode(raw: string | null | undefined): string | null {
  const v = raw?.trim().toUpperCase() ?? ''
  return /^[A-Z0-9]{6,12}$/.test(v) ? v : null
}

export type LoyaltyRefLandingInput = {
  /** The landing URL's `?ref=`. */
  param: string | null
  /** The cookie already set, if any. */
  existing: string | undefined
  method: string
  prefetch: boolean
  bot: boolean
  /** The shopper said yes to marketing cookies (the owner's rule for referral cookies, 12 Nov). */
  marketing: boolean
}

/**
 * The code a landing should keep in the cookie, or null to leave it alone: a real page open
 * (GET, not a prefetch or a bot) with a code that looks like a member's, after a yes to
 * marketing cookies, and not the code already kept. Without that yes, the Referral pop-up still
 * keeps the code when the shopper presses "Get my reward" (their own request).
 */
export function loyaltyRefLanding(input: LoyaltyRefLandingInput): string | null {
  if (input.method !== 'GET' || input.prefetch || input.bot || !input.marketing) return null
  const code = loyaltyRefCode(input.param)
  if (!code || code === loyaltyRefCode(input.existing)) return null
  return code
}

/** The cookie's options. Read on the server only, so it is httpOnly. */
export function loyaltyRefCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: LOYALTY_REF_MAX_AGE,
  }
}
