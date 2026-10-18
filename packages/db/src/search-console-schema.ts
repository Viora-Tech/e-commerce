import { sql } from 'drizzle-orm'
import {
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { newId, store } from './schema'

/**
 * Google Search Console app: the store's search numbers, copied from Google's Search Analytics
 * API once a day (and on "Refresh now") so the app's pages, the product page and the SEO report
 * read them without calling Google. One row per Google row: the last 28 days Google has final
 * numbers for (`current`) and the 28 before (`previous`), broken down by page, search, page and
 * search together, device and country, plus one `total` row per period. Each sync replaces the
 * store's rows; disconnecting deletes them. Under RLS like every tenant table.
 */
export const searchConsoleRow = pgTable(
  'search_console_row',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    period: text('period').notNull(),
    dimension: text('dimension').notNull(),
    /** The URL as Google reports it. */
    page: text('page'),
    /** The URL's path, lowercase, as our items are matched (`searchPath`). */
    path: text('path'),
    query: text('query'),
    /** Device or country code. */
    segment: text('segment'),
    clicks: integer('clicks').notNull().default(0),
    impressions: integer('impressions').notNull().default(0),
    position: doublePrecision('position').notNull().default(0),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('search_console_row_store_dimension').on(t.storeId, t.dimension, t.period),
    index('search_console_row_store_path').on(t.storeId, t.path),
    check('search_console_row_period_check', sql`${t.period} in ('current', 'previous')`),
    check(
      'search_console_row_dimension_check',
      sql`${t.dimension} in ('total', 'page', 'query', 'page_query', 'device', 'country')`,
    ),
  ],
)
