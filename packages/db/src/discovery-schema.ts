import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { newId, product, store } from './schema'

/*
 * Search & discovery app: what shoppers searched and clicked (the app's Overview), the
 * merchant's search boosts (pinned products per search, boost or bury by tag, type or vendor)
 * and hand-picked product recommendations. Under RLS like every tenant table.
 */

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)

/**
 * One storefront search or recommendation event, written by the storefront's beacon after a
 * yes to analytics. No IP, no customer, no raw visitor id: `session_key` is a hash of the store
 * and the anonymous `wc_vid` cookie, only good for linking a search to the click, add and order
 * that follow it within 30 minutes. Deleted after 90 days by the retention job.
 */
export const discoveryEvent = pgTable(
  'discovery_event',
  {
    id: id(),
    storeId: storeId(),
    sessionKey: text('session_key').notNull(),
    /** `search`, or the recommendation row the event came from (`related`, `complementary`). */
    source: text('source').notNull(),
    kind: text('kind').notNull(),
    /** The search, normalised (lower case, single spaces) and cut to 100 characters. */
    query: text('query'),
    /** Products the search found; null for every other kind. */
    results: integer('results'),
    /** The product clicked or added; for an impression, the product page it showed on. */
    productId: uuid('product_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** The Overview reads a period; the retention job deletes the oldest. */
    index('discovery_event_store_created').on(t.storeId, t.createdAt),
    /** Linking a search to the session's next click, add and order. */
    index('discovery_event_store_session').on(t.storeId, t.sessionKey, t.createdAt),
    check(
      'discovery_event_source_check',
      sql`${t.source} in ('search', 'related', 'complementary')`,
    ),
    check(
      'discovery_event_kind_check',
      sql`${t.kind} in ('search', 'impression', 'click', 'add', 'checkout')`,
    ),
  ],
)

/**
 * A product pinned to the top of the results for one search (Shopify's "product boosts"), in
 * the merchant's order. `term` is the normalised search (`normaliseSearchQuery`).
 */
export const searchPin = pgTable(
  'search_pin',
  {
    id: id(),
    storeId: storeId(),
    term: text('term').notNull(),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('search_pin_term_product').on(t.storeId, t.term, t.productId)],
)

/**
 * Products with a tag, type or vendor moved up (`boost`) or down (`bury`) in every search's
 * results. Matched exactly as the product carries the value.
 */
export const searchBoost = pgTable(
  'search_boost',
  {
    id: id(),
    storeId: storeId(),
    field: text('field').notNull(),
    value: text('value').notNull(),
    action: text('action').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('search_boost_field_value').on(t.storeId, t.field, t.value),
    check('search_boost_field_check', sql`${t.field} in ('tag', 'type', 'vendor')`),
    check('search_boost_action_check', sql`${t.action} in ('boost', 'bury')`),
  ],
)

/**
 * The merchant's own picks for a product's "You may also like" (`related`) and "Pairs well
 * with" (`complementary`) rows, in order. They show first; the automatic ones fill the rest.
 */
export const productRecommendation = pgTable(
  'product_recommendation',
  {
    id: id(),
    storeId: storeId(),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    recommendedId: uuid('recommended_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    intent: text('intent').notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => [
    uniqueIndex('product_recommendation_pick').on(
      t.storeId,
      t.productId,
      t.intent,
      t.recommendedId,
    ),
    check('product_recommendation_intent_check', sql`${t.intent} in ('related', 'complementary')`),
  ],
)
