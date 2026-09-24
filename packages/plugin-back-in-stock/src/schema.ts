import { newId, product, store, variant } from '@commerce/db'
import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Tables owned by the Back-in-stock app. They live in the platform's single
 * migration chain (packages/db/drizzle) and every one carries `store_id`, so
 * `apply_store_rls()` isolates them like core tables.
 */

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const at = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow()

export const SIGNUP_STATUSES = [
  'pending_confirmation',
  'confirmed',
  'notified',
  'unsubscribed',
] as const
export type SignupStatus = (typeof SIGNUP_STATUSES)[number]

export const CHANNELS = ['email', 'whatsapp'] as const
export type Channel = (typeof CHANNELS)[number]

/**
 * One "notify me" signup for one variant. Dedupe is enforced by the two
 * partial unique indexes below: at most one *live* (not unsubscribed) row
 * per (store, variant, email) and per (store, variant, phone). A shopper who
 * unsubscribes can sign up again; the old row stays for history.
 */
export const backInStockSignup = pgTable(
  'back_in_stock_signup',
  {
    id: id(),
    storeId: storeId(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variant.id),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id),
    email: text('email'),
    /** E.164 without the plus. */
    phone: text('phone'),
    status: text('status', { enum: SIGNUP_STATUSES }).notNull().default('pending_confirmation'),
    consentAt: at('consent_at'),
    /** IP the signup was submitted from, for the rate limiter and abuse review only. */
    ip: text('ip'),
    /** Random, single-use: emailed as the confirm link. Cleared once confirmed. */
    confirmToken: text('confirm_token'),
    /** Random, stable for the life of the signup: printed in every message's unsubscribe link. */
    unsubscribeToken: text('unsubscribe_token').notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    createdAt: at('created_at'),
    updatedAt: at('updated_at'),
  },
  (t) => [
    check(
      'back_in_stock_signup_status_check',
      sql`${t.status} in ('pending_confirmation', 'confirmed', 'notified', 'unsubscribed')`,
    ),
    check(
      'back_in_stock_signup_contact_check',
      sql`${t.email} is not null or ${t.phone} is not null`,
    ),
    uniqueIndex('back_in_stock_signup_email_live')
      .on(t.storeId, t.variantId, sql`lower(${t.email})`)
      .where(sql`${t.email} is not null and ${t.status} <> 'unsubscribed'`),
    uniqueIndex('back_in_stock_signup_phone_live')
      .on(t.storeId, t.variantId, t.phone)
      .where(sql`${t.phone} is not null and ${t.status} <> 'unsubscribed'`),
    uniqueIndex('back_in_stock_signup_confirm_token').on(t.confirmToken),
    uniqueIndex('back_in_stock_signup_unsubscribe_token').on(t.unsubscribeToken),
    index('back_in_stock_signup_store_variant_status').on(t.storeId, t.variantId, t.status),
  ],
)

/**
 * Sends metered per store, per calendar month (UTC `YYYY-MM`), per channel.
 * One row per (store, period, channel); `send` increments it with
 * `on conflict do update`, so concurrent batches never lose a count.
 */
export const backInStockUsage = pgTable(
  'back_in_stock_usage',
  {
    id: id(),
    storeId: storeId(),
    period: text('period').notNull(),
    channel: text('channel', { enum: CHANNELS }).notNull(),
    sent: integer('sent').notNull().default(0),
    updatedAt: at('updated_at'),
  },
  (t) => [
    check('back_in_stock_usage_channel_check', sql`${t.channel} in ('email', 'whatsapp')`),
    uniqueIndex('back_in_stock_usage_store_period_channel').on(t.storeId, t.period, t.channel),
  ],
)

/**
 * One row per store: channels on/off, message copy overrides, batch size,
 * and the `unlimited` override for a store exempted from the free quota
 * (set by seed/config, never written by the app itself).
 */
export const backInStockSettings = pgTable(
  'back_in_stock_settings',
  {
    id: id(),
    storeId: storeId(),
    settings: jsonb('settings').notNull().default({}),
    updatedAt: at('updated_at'),
  },
  (t) => [uniqueIndex('back_in_stock_settings_store').on(t.storeId)],
)
