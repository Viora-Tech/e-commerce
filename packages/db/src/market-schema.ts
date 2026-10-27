import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { store, storeDomain } from './schema'

/*
 * Markets (0177): markets and their countries, reference exchange rates, translations, and the
 * store's running numbers. `schema.ts` imports this file back (carts and orders point at
 * `market`), so nothing here may read a binding from `./schema` while the module loads: ids
 * come from `uuid` directly, and `store` / `storeDomain` are only read inside `references()`.
 */

const id = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7())
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
/** A check constraint's `in (...)` list, from the same array the column's enum uses. */
const oneOf = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '))

/** How a market rounds converted prices: as converted, to whole units, or to .99. */
export const MARKET_ROUNDING = ['none', 'whole', 'x99'] as const
export type MarketRounding = (typeof MARKET_ROUNDING)[number]

/** Import duties: paid by the buyer on delivery (DAP), or collected at checkout (DDP). */
export const MARKET_DUTIES = ['dap', 'ddp'] as const
export type MarketDuties = (typeof MARKET_DUTIES)[number]

/**
 * SOURCE OF TRUTH: market, marketRegion, MARKET_ROUNDING, MARKET_DUTIES
 * WHAT:  A group of countries the store sells to with its own currency, language, prices and
 *        way in (a `/<subfolder>` prefix or its own domain), Shopify Markets style. Every store
 *        has exactly one primary market (India, rupees, no subfolder, created by 0177); the
 *        storefront proxy picks the market for each request (`apps/storefront/src/lib/markets.ts`).
 * WHY:   Prices, reports and GST stay in rupees (`*_paise`); a market only changes what the
 *        shopper sees and is charged in, recorded on the order as presentment money.
 */
export const market = pgTable(
  'market',
  {
    id: id(),
    storeId: storeId(),
    name: text('name').notNull(),
    /** URL-safe name the admin uses (`gulf`, `usa`). */
    handle: text('handle').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    enabled: boolean('enabled').notNull().default(true),
    /** ISO 4217 (`AED`, `USD`). The primary market's is the store's own (`INR`). */
    currency: text('currency').notNull(),
    /** Default language, a BCP 47 language code (`en`, `ar`, `hi`). */
    locale: text('locale').notNull().default('en'),
    /** Other languages offered here; `/<lang>-<subfolder>` (or `/<lang>` in the primary) picks one. */
    locales: text('locales').array().notNull().default([]),
    /**
     * The URL prefix that serves this market (`ae`, `en-us`). Two-letter parts only, so it can
     * never shadow a storefront route. Null: reached through its own domain or the shopper's
     * choice. The primary market never has one.
     */
    subfolder: text('subfolder'),
    /** A domain only this market answers on (`waimers.ae`); the market is picked from the host. */
    storeDomainId: uuid('store_domain_id').references(() => storeDomain.id, {
      onDelete: 'set null',
    }),
    /** Basis points added to the converted price: +1000 is 10% above, -500 is 5% below. */
    priceAdjustmentBp: integer('price_adjustment_bp').notNull().default(0),
    rounding: text('rounding', { enum: MARKET_ROUNDING }).notNull().default('none'),
    /** Null: the latest reference rate (`exchange_rate`). Set: the store's own presentment units per rupee. */
    manualRate: numeric('manual_rate', { precision: 18, scale: 8 }),
    duties: text('duties', { enum: MARKET_DUTIES }).notNull().default('dap'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('market_store_handle').on(t.storeId, t.handle),
    uniqueIndex('market_one_primary').on(t.storeId).where(sql`${t.isPrimary}`),
    uniqueIndex('market_store_subfolder')
      .on(t.storeId, t.subfolder)
      .where(sql`${t.subfolder} is not null`),
    check('market_currency', sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check('market_locale', sql`${t.locale} ~ '^[a-z]{2,3}$'`),
    check(
      'market_subfolder',
      sql`${t.subfolder} is null or ${t.subfolder} ~ '^[a-z]{2}(-[a-z]{2})?$'`,
    ),
    check('market_primary_root', sql`not ${t.isPrimary} or ${t.subfolder} is null`),
    check('market_rounding', sql`${t.rounding} in (${oneOf(MARKET_ROUNDING)})`),
    check('market_duties', sql`${t.duties} in (${oneOf(MARKET_DUTIES)})`),
    check('market_adjustment', sql`${t.priceAdjustmentBp} between -5000 and 20000`),
    check('market_manual_rate', sql`${t.manualRate} is null or ${t.manualRate} > 0`),
  ],
)

/** One country in one market: a country belongs to at most one market of a store. */
export const marketRegion = pgTable(
  'market_region',
  {
    id: id(),
    storeId: storeId(),
    marketId: uuid('market_id')
      .notNull()
      .references(() => market.id, { onDelete: 'cascade' }),
    /** ISO 3166-1 alpha-2 (`AE`). */
    countryCode: text('country_code').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('market_region_store_country').on(t.storeId, t.countryCode),
    index('market_region_market').on(t.marketId),
    check('market_region_country', sql`${t.countryCode} ~ '^[A-Z]{2}$'`),
  ],
)

/** Where a rate came from: the daily ECB reference job, RBI, a CBIC customs notification (export invoices), the gateway, or typed. */
export const EXCHANGE_RATE_SOURCES = ['ecb', 'rbi', 'cbic', 'gateway', 'manual'] as const
export type ExchangeRateSource = (typeof EXCHANGE_RATE_SOURCES)[number]

/**
 * Reference exchange rates, platform-wide (no store_id, so no RLS): one `base` unit (a rupee)
 * in `quote` on `as_of`. Markets without a manual rate convert with the latest row.
 */
export const exchangeRate = pgTable(
  'exchange_rate',
  {
    id: id(),
    base: text('base').notNull().default('INR'),
    quote: text('quote').notNull(),
    rate: numeric('rate', { precision: 18, scale: 8 }).notNull(),
    asOf: date('as_of', { mode: 'string' }).notNull(),
    source: text('source', { enum: EXCHANGE_RATE_SOURCES }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('exchange_rate_pair_day').on(t.base, t.quote, t.asOf, t.source),
    check('exchange_rate_codes', sql`${t.base} ~ '^[A-Z]{3}$' and ${t.quote} ~ '^[A-Z]{3}$'`),
    check('exchange_rate_positive', sql`${t.rate} > 0`),
    check('exchange_rate_source', sql`${t.source} in (${oneOf(EXCHANGE_RATE_SOURCES)})`),
  ],
)

/** What can carry a translation (Markets languages). */
export const TRANSLATABLE_RESOURCES = [
  'product',
  'variant',
  'collection',
  'page',
  'article',
  'blog',
  'navigation_menu',
  'metaobject',
  'shop',
] as const
export type TranslatableResource = (typeof TRANSLATABLE_RESOURCES)[number]

/**
 * One field of one resource in another language (`product` / its id / `ar` / `title`). The
 * value is a string, or Lexical JSON for rich text (descriptions). Missing rows fall back to
 * the original. `resource_id` is the store's own id for `shop`.
 */
export const translation = pgTable(
  'translation',
  {
    id: id(),
    storeId: storeId(),
    resourceType: text('resource_type', { enum: TRANSLATABLE_RESOURCES }).notNull(),
    resourceId: uuid('resource_id').notNull(),
    locale: text('locale').notNull(),
    field: text('field').notNull(),
    value: jsonb('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('translation_unique').on(
      t.storeId,
      t.resourceType,
      t.resourceId,
      t.locale,
      t.field,
    ),
    check('translation_resource', sql`${t.resourceType} in (${oneOf(TRANSLATABLE_RESOURCES)})`),
    check('translation_locale', sql`${t.locale} ~ '^[a-z]{2,3}$'`),
  ],
)

/**
 * A store's running numbers (`order`: the next order number), off the `store` row so the
 * checkout transaction that takes one does not lock the store's settings with it (schema
 * review 2026-10-27, P1 item 4). 0177 seeds `order` from the store row.
 */
export const storeCounter = pgTable(
  'store_counter',
  {
    id: id(),
    storeId: storeId(),
    name: text('name').notNull(),
    /** The next value to hand out. */
    value: bigint('value', { mode: 'number' }).notNull(),
  },
  (t) => [uniqueIndex('store_counter_store_name').on(t.storeId, t.name)],
)
