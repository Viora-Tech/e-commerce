/** SOURCE OF TRUTH: cookie consent, tag gating, consent regions — WHAT: the banner's stored choice (`wc_consent`), which analytics/marketing tags it allows, and which countries are asked first (Shopify's regions requiring consent) / WHY: the storefront's consent manager runs on every page, so this stays free of zod and the database */
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
 * Which tags may load for a consent (`effectiveConsent`): analytics tags need analytics, the
 * Meta pixel and the Google Ads tag need marketing. Null (no answer where the banner asks)
 * loads nothing optional.
 */
export function allowedTags(
  prefs: ConsentPreferences,
  consent: Consent | null,
): { ga4: string | null; gtm: string | null; metaPixel: string | null; googleAds: string | null } {
  const analytics = consent?.analytics === true
  const marketing = consent?.marketing === true
  const t = prefs.tracking
  return {
    ga4: analytics && t.ga4 ? t.ga4 : null,
    gtm: analytics && t.gtm ? t.gtm : null,
    metaPixel: marketing && t.metaPixel ? t.metaPixel : null,
    googleAds: marketing && t.googleAds ? t.googleAds : null,
  }
}

/** The slice of the store's preferences the tags read. */
export type ConsentPreferences = {
  tracking: { ga4: string; gtm: string; metaPixel: string; googleAds?: string | undefined }
}

// Regions -------------------------------------------------------------------

/**
 * Shopify's "regions requiring consent" for its customer privacy banner: the EU and EEA, the
 * United Kingdom and Switzerland. Visitors from these countries are asked before optional
 * cookies; everyone else is tracked from the first page, with a way to opt out. ISO 3166-1
 * alpha-2, upper case, as Cloudflare's `CF-IPCountry` sends them.
 */
export const CONSENT_REQUIRED_COUNTRIES: readonly string[] = [
  // European Union
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  // The rest of the EEA, the United Kingdom, Switzerland
  'IS',
  'LI',
  'NO',
  'GB',
  'CH',
]

const REQUIRED = new Set(CONSENT_REQUIRED_COUNTRIES)

/**
 * Settings → Customer privacy → who sees the banner, as Shopify sets it up:
 * `consent_required` (the default) asks only visitors from `CONSENT_REQUIRED_COUNTRIES` and
 * tracks everyone else from the first page; `everyone` asks every visitor before any optional
 * cookie.
 */
export const BANNER_REGIONS = ['consent_required', 'everyone'] as const
export type BannerRegions = (typeof BANNER_REGIONS)[number]
export const DEFAULT_BANNER_REGIONS: BannerRegions = 'consent_required'

/**
 * Whether a visitor from `country` is asked first. An unknown country (no geo header, a
 * local server) is not, as on Shopify.
 */
export function consentRequiredIn(country: string | null | undefined): boolean {
  return country ? REQUIRED.has(country.trim().toUpperCase()) : false
}

/**
 * How one visitor is treated: `ask` shows the banner and waits for a yes; `open` counts
 * analytics and marketing as allowed until the shopper says no. A page a shared cache may hand
 * to visitors from anywhere is drawn `pending` and the browser asks `/api/consent-region`.
 */
export type ConsentRegion = 'open' | 'ask'
export type PageConsentRegion = ConsentRegion | 'pending'

export function consentRegion(
  regions: BannerRegions,
  country: string | null | undefined,
): ConsentRegion {
  return regions === 'everyone' || consentRequiredIn(country) ? 'ask' : 'open'
}

/**
 * What the browser uses when it cannot learn the region of a page drawn `pending` (the check
 * failed, answered nonsense or took longer than `REGION_CHECK_TIMEOUT_MS`): no banner, tracking
 * runs, as for a visitor outside the regions requiring consent. Not saved for the tab, so the
 * next page asks again.
 */
export const REGION_FALLBACK: ConsentRegion = 'open'
export const REGION_CHECK_TIMEOUT_MS = 3000

/** What an `open` visitor who never opened the cookie settings has: everything allowed. */
export const IMPLIED_CONSENT: Consent = { analytics: true, marketing: true }

/**
 * The consent that counts for this visitor. Where the banner asks, only an answer for the
 * current banner version counts (`currentConsent`). Where it does not, a saved answer of any
 * version stands (a no stays a no), and without one everything is allowed. `pending` (region
 * not known yet) allows nothing until the browser learns the region.
 */
export function effectiveConsent(
  stored: StoredConsent | null,
  bannerVersion: number,
  region: PageConsentRegion,
): Consent | null {
  if (region === 'open') {
    return stored ? { analytics: stored.analytics, marketing: stored.marketing } : IMPLIED_CONSENT
  }
  return currentConsent(stored, bannerVersion)
}

/** Whether the banner should ask this visitor now (an imported theme's banner reads it too). */
export function bannerAsks(
  stored: StoredConsent | null,
  bannerVersion: number,
  region: PageConsentRegion,
): boolean {
  return region === 'ask' && currentConsent(stored, bannerVersion) === null
}
