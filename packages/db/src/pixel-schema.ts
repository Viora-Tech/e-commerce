import { sql } from 'drizzle-orm'
import {
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
import { newId, order, store } from './schema'

/*
 * Pixels app (Meta Pixel + Conversions API). Design:
 * docs/superpowers/specs/2026-10-24-pixels-design.md §3. Status words are the ones in
 * @commerce/core/pixels; keep the check constraints in step.
 */

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const at = (name: string) => timestamp(name, { withTimezone: true })

export type PixelPlatform = 'meta'
export type PixelEventName =
  | 'PageView'
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase'
/**
 * When the server Purchase is sent. `paid_or_delivered`: a prepaid order when it is paid, a COD
 * order when it is delivered (owner decision, 2026-10-24).
 */
export type PixelPurchaseTrigger = 'placed' | 'paid' | 'delivered' | 'paid_or_delivered'
export type PixelConnectionStatus = 'active' | 'paused' | 'errored'
export type PixelEventOrigin = 'storefront' | 'order' | 'test'
export type PixelEventStatus = 'queued' | 'sent' | 'failed' | 'skipped'
export type PixelSkipReason =
  | 'no_consent'
  | 'test_order'
  | 'imported'
  | 'too_old'
  | 'paused'
  | 'errored'
  | 'no_tracking'

/** Which customer details a server event carried. Booleans only: never the values. */
export type PixelMatched = Partial<
  Record<
    'em' | 'ph' | 'fn' | 'ln' | 'ct' | 'st' | 'zp' | 'external_id' | 'fbp' | 'fbc' | 'ip' | 'ua',
    boolean
  >
>

/**
 * What the storefront collector saw for a shopper, stamped on `cart.tracking` and copied onto
 * `order.tracking` (next to `attribution`), so the server Purchase can match the browser one.
 * `ip`/`ua` are cleared from orders after 30 days by the daily prune.
 */
export type PixelTracking = {
  fbp?: string | undefined
  fbc?: string | undefined
  fbclid?: string | undefined
  ip?: string | undefined
  ua?: string | undefined
  landingUrl?: string | undefined
  consent?: { marketing: boolean; analytics: boolean; version: number; at: string } | undefined
}

/**
 * One pixel a store sends to. `token_enc` is the merchant's Conversions API token, encrypted
 * with `encryptSecret`; null means browser only. The token is never read back to a client:
 * `token_hint` (its last 4 characters) is what the admin shows.
 */
export const pixelConnection = pgTable(
  'pixel_connection',
  {
    id: id(),
    storeId: storeId(),
    platform: text('platform').$type<PixelPlatform>().notNull().default('meta'),
    /** Meta pixel (dataset) id: 10 to 20 digits. */
    pixelId: text('pixel_id').notNull(),
    name: text('name').notNull().default(''),
    tokenEnc: text('token_enc'),
    tokenHint: text('token_hint'),
    testEventCode: text('test_event_code'),
    events: text('events')
      .array()
      .$type<PixelEventName[]>()
      .notNull()
      .default(
        sql`ARRAY['PageView','ViewContent','AddToCart','InitiateCheckout','Purchase']::text[]`,
      ),
    purchaseTrigger: text('purchase_trigger')
      .$type<PixelPurchaseTrigger>()
      .notNull()
      .default('placed'),
    status: text('status').$type<PixelConnectionStatus>().notNull().default('active'),
    /** Meta's last refusal, in its words (no token, no customer data). Cleared on success. */
    lastError: text('last_error'),
    lastErrorAt: at('last_error_at'),
    lastSentAt: at('last_sent_at'),
    createdBy: text('created_by'),
    createdAt: at('created_at').notNull().defaultNow(),
    updatedAt: at('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('pixel_connection_platform', sql`${t.platform} in ('meta')`),
    check(
      'pixel_connection_trigger',
      sql`${t.purchaseTrigger} in ('placed','paid','delivered','paid_or_delivered')`,
    ),
    check('pixel_connection_status', sql`${t.status} in ('active','paused','errored')`),
    check('pixel_connection_pixel_id', sql`${t.pixelId} ~ '^[0-9]{10,20}$'`),
    uniqueIndex('pixel_connection_store_pixel').on(t.storeId, t.platform, t.pixelId),
  ],
)

/**
 * One event sent (or skipped) for one pixel, kept 30 days. Successful storefront PageViews are
 * only counted in `pixel_event_day`, never logged row by row. No raw customer data: `matched`
 * says which details were sent, `error` is Meta's message (500 characters at most).
 */
export const pixelEventLog = pgTable(
  'pixel_event_log',
  {
    id: id(),
    storeId: storeId(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => pixelConnection.id, { onDelete: 'cascade' }),
    eventId: text('event_id').notNull(),
    eventName: text('event_name').$type<PixelEventName>().notNull(),
    origin: text('origin').$type<PixelEventOrigin>().notNull(),
    status: text('status').$type<PixelEventStatus>().notNull().default('queued'),
    skipReason: text('skip_reason').$type<PixelSkipReason>(),
    httpStatus: integer('http_status'),
    fbtraceId: text('fbtrace_id'),
    error: text('error'),
    attempts: integer('attempts').notNull().default(0),
    matched: jsonb('matched').$type<PixelMatched>().notNull().default({}),
    valuePaise: integer('value_paise'),
    orderId: uuid('order_id').references(() => order.id, { onDelete: 'set null' }),
    createdAt: at('created_at').notNull().defaultNow(),
    sentAt: at('sent_at'),
  },
  (t) => [
    check('pixel_event_log_origin', sql`${t.origin} in ('storefront','order','test')`),
    check('pixel_event_log_status', sql`${t.status} in ('queued','sent','failed','skipped')`),
    check(
      'pixel_event_log_skip_reason',
      sql`${t.skipReason} is null or ${t.skipReason} in ('no_consent','test_order','imported','too_old','paused','errored','no_tracking')`,
    ),
    check('pixel_event_log_error_length', sql`${t.error} is null or length(${t.error}) <= 500`),
    uniqueIndex('pixel_event_log_event').on(t.connectionId, t.eventName, t.eventId, t.origin),
    index('pixel_event_log_store_created').on(t.storeId, t.createdAt.desc()),
  ],
)

/** Daily counts per pixel, IST day, event and origin: the 7-day strip and successful PageViews. */
export const pixelEventDay = pgTable(
  'pixel_event_day',
  {
    storeId: storeId(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => pixelConnection.id, { onDelete: 'cascade' }),
    /** The calendar day in India (`Asia/Kolkata`). */
    day: date('day').notNull(),
    eventName: text('event_name').$type<PixelEventName>().notNull(),
    origin: text('origin').$type<PixelEventOrigin>().notNull(),
    sent: integer('sent').notNull().default(0),
    failed: integer('failed').notNull().default(0),
    skipped: integer('skipped').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.connectionId, t.day, t.eventName, t.origin] }),
    index('pixel_event_day_store_day').on(t.storeId, t.day),
  ],
)
