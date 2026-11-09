import { z } from 'zod'
import { MediaRefSchema } from '../theme/schema'

/**
 * Online Store › Preferences, as Shopify has them: the home page's search listing
 * and social image, a storefront password, search engine and AI crawler access,
 * site verification tags, and the analytics/marketing tags that load only after
 * consent. The cookie banner itself is Settings → Customer privacy
 * (`@commerce/core/privacy`). Browser safe: the admin form imports it directly.
 */

export const GA4_ID = /^G-[A-Z0-9]{4,12}$/
export const GTM_ID = /^GTM-[A-Z0-9]{4,10}$/
export const META_PIXEL_ID = /^\d{10,20}$/
export const GOOGLE_ADS_ID = /^AW-\d{6,12}$/
/** A site verification token: what goes in the meta tag's `content`. */
export const VERIFICATION_TOKEN = /^[A-Za-z0-9_.:=+/-]{4,120}$/

/** An optional tracking id: blank, or matching its format after trimming. */
const trackingId = (pattern: RegExp, message: string, upper: boolean) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? (upper ? v.trim().toUpperCase() : v.trim()) : v),
    z.union([z.literal(''), z.string().regex(pattern, message)]),
  )

/**
 * A site verification token. Merchants paste either the token or the whole
 * `<meta name="…" content="TOKEN">` tag the search console hands them; the tag's
 * `content` is kept either way.
 */
const verificationToken = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v
    const tag = /content\s*=\s*["']([^"']*)["']/i.exec(v)
    return (tag?.[1] ?? v).trim()
  },
  z.union([
    z.literal(''),
    z.string().regex(VERIFICATION_TOKEN, 'Paste the code from the meta tag, or the whole tag'),
  ]),
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
  googleAds: trackingId(GOOGLE_ADS_ID, 'A Google Ads tag id looks like AW-123456789', true).default(
    '',
  ),
})

/** Who may crawl the storefront. Off keeps it out of Google; the password page always does. */
const IndexingSchema = z.object({
  /** Search engines may index the store (robots.txt, sitemap, `robots` meta). */
  searchEngines: z.boolean().default(true),
  /** AI crawlers (GPTBot, ClaudeBot, Google-Extended…) may read it, and llms.txt is served. */
  aiCrawlers: z.boolean().default(true),
})

/** Ownership tags the search consoles and ad platforms ask for, set on every page. */
const VerificationSchema = z.object({
  google: verificationToken.default(''),
  bing: verificationToken.default(''),
  meta: verificationToken.default(''),
  pinterest: verificationToken.default(''),
})

/**
 * How the storefront sends its pages. `plainHtml` (off by default, per store): an imported Shopify
 * theme's home and content pages go out as the theme's own HTML and CSS with small scripts only
 * where a page must be live, without the React runtime (docs/design/storefront-plain-html.md).
 * Pages it cannot serve that way yet are drawn as before.
 */
const DeliverySchema = z.object({
  plainHtml: z.boolean().default(false),
})

export const StorePreferencesSchema = z.object({
  seo: SeoSchema.prefault({}),
  password: PasswordSchema.prefault({}),
  tracking: TrackingSchema.prefault({}),
  indexing: IndexingSchema.prefault({}),
  verification: VerificationSchema.prefault({}),
  delivery: DeliverySchema.prefault({}),
})
export type StorePreferences = z.infer<typeof StorePreferencesSchema>

export const defaultPreferences: StorePreferences = StorePreferencesSchema.parse({})

/** Stored preferences, falling back to defaults for anything missing or invalid. */
export function parsePreferences(raw: unknown): StorePreferences {
  const r = StorePreferencesSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultPreferences
}

/**
 * Whether search engines may index the storefront: never while the password page is on,
 * and not when the merchant switched indexing off.
 */
export function searchIndexable(prefs: StorePreferences): boolean {
  return !prefs.password.enabled && prefs.indexing.searchEngines
}

// The banner's choice and the tags it allows live in a zod-free module the storefront's
// consent manager imports on every page; re-exported so server code keeps one import.
export * from './consent'
