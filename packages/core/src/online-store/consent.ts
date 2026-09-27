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

/** Cookie holding the shopper's choice; `a1m0` style so it is readable and tiny. */
export const CONSENT_COOKIE = 'wc_consent'
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 180

export function encodeConsent(c: Consent): string {
  return `a${c.analytics ? 1 : 0}m${c.marketing ? 1 : 0}`
}

/** The stored choice, or null when the shopper has not chosen yet. */
export function decodeConsent(raw: string | null | undefined): Consent | null {
  const m = /^a([01])m([01])$/.exec(raw ?? '')
  return m ? { analytics: m[1] === '1', marketing: m[2] === '1' } : null
}

/** The slice of the store's preferences the banner and its tags read. */
export type ConsentPreferences = {
  privacy: { bannerEnabled: boolean; message: string }
  tracking: { ga4: string; gtm: string; metaPixel: string }
}

/**
 * Which tags may load. Without a banner there is nothing to ask, so tags load; with
 * one, they wait for the shopper's choice per category.
 */
export function allowedTags(
  prefs: ConsentPreferences,
  consent: Consent | null,
): { ga4: string | null; gtm: string | null; metaPixel: string | null } {
  const analytics = !prefs.privacy.bannerEnabled || consent?.analytics === true
  const marketing = !prefs.privacy.bannerEnabled || consent?.marketing === true
  const t = prefs.tracking
  return {
    ga4: analytics && t.ga4 ? t.ga4 : null,
    gtm: analytics && t.gtm ? t.gtm : null,
    metaPixel: marketing && t.metaPixel ? t.metaPixel : null,
  }
}
