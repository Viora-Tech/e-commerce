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

// The banner's choice and the tags it allows live in a zod-free module the storefront's
// consent manager imports on every page; re-exported so server code keeps one import.
export * from './consent'
