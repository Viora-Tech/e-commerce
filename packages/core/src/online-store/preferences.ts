import { z } from 'zod'
import { MediaRefSchema } from '../theme/schema'

/**
 * Online Store › Preferences, as Shopify has them: the home page's search listing
 * and social image, a storefront password, the cookie consent banner, and the
 * analytics/marketing tags that load only after consent. Browser safe: the admin
 * form imports it directly.
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

const PrivacySchema = z.object({
  /** Show the consent banner and hold analytics and marketing tags until the shopper chooses. */
  bannerEnabled: z.boolean().default(true),
  /** Replaces the default banner copy when set. */
  message: z.string().trim().max(PREFERENCE_LIMITS.message).default(''),
})

const TrackingSchema = z.object({
  ga4: trackingId(GA4_ID, 'A GA4 measurement id looks like G-XXXXXXXXXX', true).default(''),
  gtm: trackingId(GTM_ID, 'A Tag Manager id looks like GTM-XXXXXXX', true).default(''),
  metaPixel: trackingId(META_PIXEL_ID, 'A Meta pixel id is 10 to 20 digits', false).default(''),
})

export const StorePreferencesSchema = z.object({
  seo: SeoSchema.prefault({}),
  password: PasswordSchema.prefault({}),
  privacy: PrivacySchema.prefault({}),
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

/**
 * Which tags may load. Without a banner there is nothing to ask, so tags load; with
 * one, they wait for the shopper's choice per category.
 */
export function allowedTags(
  prefs: Pick<StorePreferences, 'privacy' | 'tracking'>,
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
