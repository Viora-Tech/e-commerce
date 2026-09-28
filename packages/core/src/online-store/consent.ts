/** SOURCE OF TRUTH: cookie consent, tag gating — WHAT: the banner's stored choice (`wc_consent`) and which analytics/marketing tags it allows / WHY: the storefront's consent manager runs on every page, so this stays free of zod and the database */
/**
 * The cookie consent banner's choice and the tags it lets load. No zod and no
 * database: the storefront's consent manager runs on every page, so it imports
 * this through `@commerce/core/consent` instead of the preferences schema.
 * `./preferences` re-exports all of it, so server code is unchanged.
 */

/** Consent categories the banner asks about; `necessary` is always on. */
export const CONSENT_CATEGORIES = ['necessary', 'analytics', 'marketing'] as const
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number]
export type Consent = { analytics: boolean; marketing: boolean }

/** A choice as the cookie keeps it: which banner version it answered, and when. */
export type StoredConsent = Consent & {
  /** Banner version the shopper answered; 0 for cookies from before versions existed. */
  version: number
  /** Seconds since the epoch; 0 when unknown. */
  at: number
}

/** Cookie holding the shopper's choice; `a1m0.v2.t1790000000` style so it is readable and tiny. */
export const CONSENT_COOKIE = 'wc_consent'
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180

export function encodeConsent(c: Consent, version: number, at: Date): string {
  const seconds = Math.floor(at.getTime() / 1000)
  return `a${c.analytics ? 1 : 0}m${c.marketing ? 1 : 0}.v${version}.t${seconds}`
}

/** The stored choice, or null when the shopper has not chosen yet (or the cookie is junk). */
export function decodeConsent(raw: string | null | undefined): StoredConsent | null {
  const m = /^a([01])m([01])(?:\.v(\d{1,6})\.t(\d{1,12}))?$/.exec(raw ?? '')
  if (!m) return null
  return {
    analytics: m[1] === '1',
    marketing: m[2] === '1',
    version: m[3] ? Number(m[3]) : 0,
    at: m[4] ? Number(m[4]) : 0,
  }
}

/**
 * The choice that still counts: one made for the banner the store shows now.
 * When the merchant changes the banner and asks everyone again, older answers
 * lapse and the banner comes back, with everything optional off meanwhile.
 */
export function currentConsent(
  stored: StoredConsent | null,
  bannerVersion: number,
): Consent | null {
  if (!stored || stored.version < bannerVersion) return null
  return { analytics: stored.analytics, marketing: stored.marketing }
}

/**
 * Which tags may load. Nothing optional loads before the shopper says yes to
 * its category (DPDP: consent is opt in); analytics tags need analytics, the
 * Meta pixel needs marketing.
 */
export function allowedTags(
  prefs: ConsentPreferences,
  consent: Consent | null,
): { ga4: string | null; gtm: string | null; metaPixel: string | null } {
  const analytics = consent?.analytics === true
  const marketing = consent?.marketing === true
  const t = prefs.tracking
  return {
    ga4: analytics && t.ga4 ? t.ga4 : null,
    gtm: analytics && t.gtm ? t.gtm : null,
    metaPixel: marketing && t.metaPixel ? t.metaPixel : null,
  }
}

/** The slice of the store's preferences the tags read. */
export type ConsentPreferences = {
  tracking: { ga4: string; gtm: string; metaPixel: string }
}
