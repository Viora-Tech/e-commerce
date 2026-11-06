import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { customer, newId, store } from './schema'

/*
 * Customer privacy (DPDP Act 2023) and shopper sign-in by phone: cookie consent
 * records, marketing consent history, data requests (export or delete), the
 * privacy audit trail, and one-time codes sent to a phone or for confirming an
 * account deletion. Every table carries `store_id` and sits under RLS.
 */

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

/**
 * One row per choice made in the storefront cookie banner: what was allowed,
 * when, and which banner text (version) the shopper saw. Proof of consent; the
 * cookie in the browser is only a copy.
 */
export const cookieConsent = pgTable(
  'cookie_consent',
  {
    id: id(),
    storeId: storeId(),
    /** The anonymous visitor cookie, when the browser had one. */
    visitorId: text('visitor_id'),
    /** Set when a signed-in shopper made the choice. */
    customerId: uuid('customer_id').references(() => customer.id),
    analytics: boolean('analytics').notNull(),
    marketing: boolean('marketing').notNull(),
    /** Settings → Customer privacy bumps it to ask everyone again. */
    bannerVersion: integer('banner_version').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('cookie_consent_store_created').on(t.storeId, t.createdAt),
    index('cookie_consent_customer').on(t.customerId),
  ],
)

/**
 * How often the cookie banner was shown each day. A plain count with no visitor or cookie, so
 * set beside `cookie_consent` it shows how many shoppers never answer.
 */
export const cookieBannerDay = pgTable(
  'cookie_banner_day',
  {
    storeId: storeId(),
    day: date('day').notNull(),
    shown: integer('shown').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.storeId, t.day] })],
)

const MARKETING_CONSENT_CHANNELS = ['email', 'whatsapp', 'sms'] as const
const PRIVACY_ACTORS = ['customer', 'staff', 'system'] as const

/**
 * Every grant and withdrawal of marketing consent, per channel. The flags on
 * `customer` (accepts_marketing, accepts_whatsapp, accepts_sms) are the current
 * state that sends check; this is the history that proves it.
 */
export const marketingConsentEvent = pgTable(
  'marketing_consent_event',
  {
    id: id(),
    storeId: storeId(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customer.id),
    channel: text('channel', { enum: MARKETING_CONSENT_CHANNELS }).notNull(),
    granted: boolean('granted').notNull(),
    /** Where it happened: `checkout`, `newsletter`, `account`, `unsubscribe_link`, `admin`, `import`. */
    source: text('source').notNull(),
    actorType: text('actor_type', { enum: PRIVACY_ACTORS }).notNull(),
    /** Staff user id when a merchant recorded it. */
    actorId: text('actor_id'),
    createdAt: createdAt(),
  },
  (t) => [
    index('marketing_consent_event_customer').on(t.customerId, t.createdAt),
    check(
      'marketing_consent_event_channel_check',
      sql`${t.channel} in ('email', 'whatsapp', 'sms')`,
    ),
  ],
)

const DATA_REQUEST_KINDS = ['export', 'delete'] as const
const DATA_REQUEST_STATUSES = ['open', 'in_progress', 'completed', 'rejected'] as const
const DATA_REQUEST_SOURCES = ['account', 'email', 'phone', 'other'] as const

/**
 * A shopper asking for a copy of their data or for it to be erased. Made from
 * the storefront account page, or logged by staff when the ask came by email or
 * phone. `due_at` is set from the store's response window when it is created.
 */
export const dataRequest = pgTable(
  'data_request',
  {
    id: id(),
    storeId: storeId(),
    /** Per-store running number, shown as #1, #2 in the queue. */
    number: integer('number').notNull(),
    kind: text('kind', { enum: DATA_REQUEST_KINDS }).notNull(),
    status: text('status', { enum: DATA_REQUEST_STATUSES }).notNull().default('open'),
    source: text('source', { enum: DATA_REQUEST_SOURCES }).notNull(),
    /** Null when the person is not a customer of the store (nothing to export or erase). */
    customerId: uuid('customer_id').references(() => customer.id),
    /** How to reach the person, as they gave it; cleared when the customer is erased. */
    contactEmail: text('contact_email'),
    contactPhone: text('contact_phone'),
    /** What the person asked, in staff's words or theirs. */
    note: text('note'),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    /** Why it was declined, or what was done. */
    resolution: text('resolution'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('data_request_store_number').on(t.storeId, t.number),
    index('data_request_store_status').on(t.storeId, t.status, t.dueAt),
    index('data_request_customer').on(t.customerId),
    check('data_request_kind_check', sql`${t.kind} in ('export', 'delete')`),
    check(
      'data_request_status_check',
      sql`${t.status} in ('open', 'in_progress', 'completed', 'rejected')`,
    ),
    check('data_request_source_check', sql`${t.source} in ('account', 'email', 'phone', 'other')`),
  ],
)

/**
 * Who did what, when, to whose personal data: requests made and moved,
 * exports downloaded, customers erased, consent changed by staff, privacy
 * settings saved. Append only: the app role may insert and read, never update
 * or delete (see migration 0075). `detail` never holds personal data.
 */
export const privacyAuditEvent = pgTable(
  'privacy_audit_event',
  {
    id: id(),
    storeId: storeId(),
    dataRequestId: uuid('data_request_id').references(() => dataRequest.id),
    customerId: uuid('customer_id').references(() => customer.id),
    actorType: text('actor_type', { enum: PRIVACY_ACTORS }).notNull(),
    actorId: text('actor_id'),
    /** Staff name or email at the time, so the trail reads well after they leave. */
    actorLabel: text('actor_label'),
    /** e.g. `request.created`, `request.status`, `export.downloaded`, `customer.anonymised`. */
    action: text('action').notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index('privacy_audit_event_store_created').on(t.storeId, t.createdAt),
    index('privacy_audit_event_request').on(t.dataRequestId),
    index('privacy_audit_event_customer').on(t.customerId),
  ],
)

const CUSTOMER_OTP_PURPOSES = ['login', 'delete_account'] as const
const CUSTOMER_OTP_CHANNELS = ['email', 'sms', 'whatsapp'] as const

/**
 * A pending one-time code sent by SMS or WhatsApp to sign in, or by any channel
 * to confirm an account deletion. Only hashes are kept: the destination (email
 * or phone) is hashed with the store id, and the code hash binds the same.
 * Email sign-in keeps its own `customer_login_code` table.
 */
export const customerOtp = pgTable(
  'customer_otp',
  {
    id: id(),
    storeId: storeId(),
    purpose: text('purpose', { enum: CUSTOMER_OTP_PURPOSES }).notNull(),
    channel: text('channel', { enum: CUSTOMER_OTP_CHANNELS }).notNull(),
    destinationHash: text('destination_hash').notNull(),
    /** The signed-in customer confirming a deletion; null for sign-in codes. */
    customerId: uuid('customer_id').references(() => customer.id),
    codeHash: text('code_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('customer_otp_store_purpose_destination').on(
      t.storeId,
      t.purpose,
      t.destinationHash,
    ),
    check('customer_otp_purpose_check', sql`${t.purpose} in ('login', 'delete_account')`),
    check('customer_otp_channel_check', sql`${t.channel} in ('email', 'sms', 'whatsapp')`),
  ],
)
