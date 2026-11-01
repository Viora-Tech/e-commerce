/**
 * The Reviews app's settings: how reviews are published, who may write one, spam limits,
 * the review request email and what the store shows. Pure and client-safe (zod only):
 * the admin settings page, the API and the storefront share it. Saved in `store.apps`
 * under the app's id (`appSettingsOf` / `withAppSettings`), so the app needs no table
 * for them and a reinstall keeps them.
 */
import { z } from 'zod'

export const REVIEWS_ID = 'reviews'

/** `all`: publish at once. `high`: 4 and 5 stars at once, hold the rest. `none`: hold every review. */
export const PUBLISH_MODES = ['all', 'high', 'none'] as const
export type PublishMode = (typeof PUBLISH_MODES)[number]

export const WHO_CAN_REVIEW = ['verified', 'anyone'] as const
export type WhoCanReview = (typeof WHO_CAN_REVIEW)[number]

export const REVIEW_SORTS = ['helpful', 'newest', 'highest', 'lowest'] as const
export type ReviewSort = (typeof REVIEW_SORTS)[number]

/** How review requests reach the buyer: email, WhatsApp (an approved template) or both. */
export const REQUEST_CHANNELS = ['email', 'whatsapp', 'both'] as const
export type RequestChannel = (typeof REQUEST_CHANNELS)[number]

/** Most orders one "Request reviews from past orders" run asks; run it again for more. */
export const PAST_ORDERS_MAX = 2000

/** Requests from one run go out at most this many orders an hour, so a big list trickles out. */
export const PAST_ORDERS_PER_HOUR = 200

/** The widest date range one run may cover. */
export const PAST_ORDERS_MAX_DAYS = 366

/** Shortest and longest product question (Q&A) we take, and the longest answer. */
export const QUESTION_MIN = 5
export const QUESTION_MAX = 500
export const ANSWER_MAX = 2000

/** The most photos one review may carry. */
export const MAX_REVIEW_PHOTOS = 5

/** `{{ product.title }}` in the subject becomes the product's name. */
export const DEFAULT_REQUEST_SUBJECT = 'How was your {{ product.title }}?'

export const ReviewsSettingsSchema = z.object({
  publishing: z.enum(PUBLISH_MODES).default('high'),
  /** Hold every review with photos so the merchant sees them first. */
  holdPhotos: z.boolean().default(true),
  whoCanReview: z.enum(WHO_CAN_REVIEW).default('verified'),
  /** Most reviews one customer (by email) can send in a day. */
  maxPerDay: z.number().int().min(1).max(50).default(3),
  requestEmail: z
    .object({
      enabled: z.boolean().default(true),
      daysAfterDelivery: z.number().int().min(0).max(60).default(7),
      /** Days after the request with no review before one reminder; 0 sends none. */
      reminderDays: z.number().int().min(0).max(60).default(5),
      subject: z.string().trim().max(150).default(DEFAULT_REQUEST_SUBJECT),
      channel: z.enum(REQUEST_CHANNELS).default('email'),
    })
    .default({
      enabled: true,
      daysAfterDelivery: 7,
      reminderDays: 5,
      subject: DEFAULT_REQUEST_SUBJECT,
      channel: 'email',
    }),
  /**
   * Thanks for a photo review: a one-time discount code, made when the review is published
   * (reviews written on the store only, never imports) and emailed to the reviewer.
   */
  photoReward: z
    .object({
      enabled: z.boolean().default(false),
      /** Whole percent off one order. */
      percent: z.number().int().min(1).max(90).default(10),
      /** Days the code works for. */
      days: z.number().int().min(1).max(365).default(30),
    })
    .default({ enabled: false, percent: 10, days: 30 }),
  /**
   * The AI "What customers say" summary on product pages, refreshed by the worker when new
   * reviews arrive. Off by default: it uses the store's AI allowance (product writer).
   */
  aiSummary: z.object({ enabled: z.boolean().default(false) }).default({ enabled: false }),
  storefront: z
    .object({
      starsOnCards: z.boolean().default(true),
      showPhotos: z.boolean().default(true),
      sort: z.enum(REVIEW_SORTS).default('helpful'),
    })
    .default({ starsOnCards: true, showPhotos: true, sort: 'helpful' }),
})

export type ReviewsSettings = z.infer<typeof ReviewsSettingsSchema>

export const defaultReviewsSettings: ReviewsSettings = ReviewsSettingsSchema.parse({})

/** The saved entry, or the defaults where it is missing or broken. */
export function parseReviewsSettings(raw: unknown): ReviewsSettings {
  const r = ReviewsSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultReviewsSettings
}

/**
 * Where one order's review request goes under the store's channel choice: the order's email
 * for email, its phone for WhatsApp, both for both. Null when the chosen channel has no
 * address to reach (a WhatsApp-only store and an order without a phone).
 */
export function requestContact(
  channel: RequestChannel,
  contact: { email?: string | null | undefined; phone?: string | null | undefined },
): { email: string | null; phone: string | null } | null {
  const email = channel === 'whatsapp' ? null : contact.email?.trim().toLowerCase() || null
  const phone = channel === 'email' ? null : contact.phone?.replace(/[^\d+]/g, '') || null
  return email || phone ? { email, phone } : null
}

/** The review request subject with the product's name in. */
export function requestSubject(subject: string, productTitle: string): string {
  const text = subject.trim() || DEFAULT_REQUEST_SUBJECT
  return text.replace(/\{\{\s*product\.title\s*\}\}/g, productTitle)
}

/**
 * Whether a new review goes live straight away, and if not why it waits. A review with
 * photos waits when the store checks photos first, whatever its rating.
 */
export function publishDecision(
  settings: Pick<ReviewsSettings, 'publishing' | 'holdPhotos'>,
  input: { rating: number; photos: number },
): { status: 'published' | 'pending'; heldReason: 'rating' | 'photos' | 'all' | null } {
  if (settings.publishing === 'none') return { status: 'pending', heldReason: 'all' }
  if (settings.holdPhotos && input.photos > 0) return { status: 'pending', heldReason: 'photos' }
  if (settings.publishing === 'high' && input.rating < 4) {
    return { status: 'pending', heldReason: 'rating' }
  }
  return { status: 'published', heldReason: null }
}

/** "Aarav Mehta" → "Aarav M.": what the store shows of a reviewer's name. */
export function displayName(raw: string): string {
  const parts = raw.trim().split(/\s+/).filter(Boolean)
  const first = parts[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first
}
