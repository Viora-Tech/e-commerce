import { customer, media, newId, order, product, store } from '@commerce/db'
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Tables owned by the Reviews app. They live in the platform's single migration chain
 * (packages/db/drizzle) and every one carries `store_id`, so `apply_store_rls()` isolates
 * them like core tables.
 */

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const at = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow()

export const REVIEW_STATUSES = ['pending', 'published', 'hidden'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export const REVIEW_SOURCES = ['storefront', 'judgeme'] as const
export type ReviewSource = (typeof REVIEW_SOURCES)[number]

/** Why a review waits for the merchant (the settings that held it), for the activity log. */
export const HELD_REASONS = ['rating', 'photos', 'all'] as const
export type HeldReason = (typeof HELD_REASONS)[number]

/**
 * One product review. `reviewerEmail` is private: never shown on the storefront or in the
 * admin list, only used for the verified-buyer check, the per-customer limit and the reply
 * email. `externalId` is the review's id where it came from (Judge.me), unique per store, so
 * importing the same export twice adds nothing.
 */
export const review = pgTable(
  'review',
  {
    id: id(),
    storeId: storeId(),
    // A product deleted for good takes its reviews with it, but core's `deleteProduct` archives
    // any product that has reviews (or was ever ordered) instead, so they are kept. Null for a
    // store review: one about the shop as a whole (Judge.me's store reviews), which only the
    // store-wide showcase lists.
    productId: uuid('product_id').references(() => product.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id').references(() => order.id, { onDelete: 'set null' }),
    customerId: uuid('customer_id').references(() => customer.id, { onDelete: 'set null' }),
    rating: integer('rating').notNull(),
    title: text('title').notNull().default(''),
    body: text('body').notNull().default(''),
    /** As shown on the store: first name and last initial for storefront reviews. */
    reviewerName: text('reviewer_name').notNull().default(''),
    reviewerEmail: text('reviewer_email'),
    status: text('status', { enum: REVIEW_STATUSES }).notNull().default('pending'),
    heldReason: text('held_reason', { enum: HELD_REASONS }),
    verifiedBuyer: boolean('verified_buyer').notNull().default(false),
    source: text('source', { enum: REVIEW_SOURCES }).notNull().default('storefront'),
    externalId: text('external_id'),
    helpfulCount: integer('helpful_count').notNull().default(0),
    /** The store's public reply, shown under the review; the customer is emailed once. */
    reply: text('reply'),
    replyAt: timestamp('reply_at', { withTimezone: true }),
    /** Picked for the home page's reviews showcase. */
    featured: boolean('featured').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    /** When the review was written (an imported review keeps its original date). */
    createdAt: at('created_at'),
    updatedAt: at('updated_at'),
  },
  (t) => [
    check('review_rating_check', sql`${t.rating} between 1 and 5`),
    check('review_status_check', sql`${t.status} in ('pending', 'published', 'hidden')`),
    check('review_source_check', sql`${t.source} in ('storefront', 'judgeme')`),
    check(
      'review_held_reason_check',
      sql`${t.heldReason} is null or ${t.heldReason} in ('rating', 'photos', 'all')`,
    ),
    uniqueIndex('review_store_external').on(t.storeId, t.externalId),
    index('review_store_product_status').on(t.storeId, t.productId, t.status),
    index('review_store_status_created').on(t.storeId, t.status, t.createdAt),
    index('review_order').on(t.orderId),
    index('review_customer').on(t.customerId),
  ],
)

/**
 * A photo on a review. `mediaId` points at the copy in the store's Files (stripped of
 * location data); an imported Judge.me photo keeps its `sourceUrl` until the copy job has
 * fetched it, and only rows with a copy are shown.
 */
export const reviewMedia = pgTable(
  'review_media',
  {
    id: id(),
    storeId: storeId(),
    reviewId: uuid('review_id')
      .notNull()
      .references(() => review.id, { onDelete: 'cascade' }),
    mediaId: uuid('media_id').references(() => media.id, { onDelete: 'set null' }),
    sourceUrl: text('source_url'),
    /** Set when copying the source failed for good (gone, too large, not an image). */
    copyError: text('copy_error'),
    position: integer('position').notNull().default(0),
    createdAt: at('created_at'),
  },
  (t) => [index('review_media_store_review').on(t.storeId, t.reviewId)],
)

/**
 * One review request per product of a delivered order: emailed `dueAt` (days after
 * delivery), reminded once if no review came, never again after the customer opts out.
 */
export const reviewRequest = pgTable(
  'review_request',
  {
    id: id(),
    storeId: storeId(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    optedOutAt: timestamp('opted_out_at', { withTimezone: true }),
    createdAt: at('created_at'),
  },
  (t) => [
    uniqueIndex('review_request_store_order_product').on(t.storeId, t.orderId, t.productId),
    index('review_request_store_due').on(t.storeId, t.dueAt),
    index('review_request_store_email').on(t.storeId, sql`lower(${t.email})`),
  ],
)
