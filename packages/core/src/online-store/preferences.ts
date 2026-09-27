import { z } from 'zod'
import { MediaRefSchema } from '../theme/schema'

/**
 * Online Store › Preferences, as Shopify has them: the home page's search listing
 * and social image, a storefront password, and the analytics/marketing tags that
 * load only after consent. The cookie banner itself is Settings → Customer privacy
 * (`@commerce/core/privacy`). Browser safe: the admin form imports it directly.
 */

export const GA4_ID = /^G-[A-Z0-9]{4,12}$/
export const GTM_ID = /^GTM-[A-Z0-9]{4,10}$/
export const META_PIXEL_ID = /^\d{10,20}$/

/** An optional tracking id: blank, or matching its format after trimming. */
const trackingId = (pattern: RegExp, message: string, upper: boolean) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? (upper ? v.trim().toUpperCase() : v.trim()) : v),
    z.union([z.literal(''), z.string().regex(pattern, message)]),
  )

export const PREFERENCE_LIMITS = {
  seoTitle: 70,
  seoDescription: 320,
  imageAlt: 200,
  password: 100,
  passwordMin: 4,
  message: 500,
} as const

const SeoSchema = z.object({
  title: z.string().trim().max(PREFERENCE_LIMITS.seoTitle).default(''),
  description: z.string().trim().max(PREFERENCE_LIMITS.seoDescription).default(''),
  image: MediaRefSchema.nullable().default(null),
  imageAlt: z.string().trim().max(PREFERENCE_LIMITS.imageAlt).default(''),
})

const PasswordSchema = z
  .object({
    enabled: z.boolean().default(false),
    password: z.string().max(PREFERENCE_LIMITS.password).default(''),
    message: z.string().trim().max(PREFERENCE_LIMITS.message).default(''),
  })
  .refine((p) => !p.enabled || p.password.trim().length >= PREFERENCE_LIMITS.passwordMin, {
    message: `Choose a password of at least ${PREFERENCE_LIMITS.passwordMin} characters`,
    path: ['password'],
  })

const TrackingSchema = z.object({
  ga4: trackingId(GA4_ID, 'A GA4 measurement id looks like G-XXXXXXXXXX', true).default(''),
  gtm: trackingId(GTM_ID, 'A Tag Manager id looks like GTM-XXXXXXX', true).default(''),
  metaPixel: trackingId(META_PIXEL_ID, 'A Meta pixel id is 10 to 20 digits', false).default(''),
})

export const StorePreferencesSchema = z.object({
  seo: SeoSchema.prefault({}),
  password: PasswordSchema.prefault({}),
  tracking: TrackingSchema.prefault({}),
})
export type StorePreferences = z.infer<typeof StorePreferencesSchema>

export const defaultPreferences: StorePreferences = StorePreferencesSchema.parse({})

/** Stored preferences, falling back to defaults for anything missing or invalid. */
export function parsePreferences(raw: unknown): StorePreferences {
  const r = StorePreferencesSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultPreferences
}

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
  prefs: Pick<StorePreferences, 'tracking'>,
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
