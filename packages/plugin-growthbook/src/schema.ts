import { newId, order, store } from '@commerce/db'
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

/**
 * The table owned by the GrowthBook app. It lives in the platform's single migration chain
 * (packages/db/drizzle) and carries `store_id`, so `apply_store_rls()` isolates it like core
 * tables.
 */

/**
 * A/B test events, read by GrowthBook through a SQL data source (developer docs "GrowthBook").
 * `exposure`: the visitor saw a page drawn with that experiment's variation (first time per
 * variation). `purchase`: the visitor placed an order, with its total. Written only after a yes
 * to analytics on the cookie banner, keyed by the anonymous `wc_vid` visitor id.
 */
export const experimentEvent = pgTable(
  'experiment_event',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    visitorId: text('visitor_id').notNull(),
    kind: text('kind', { enum: ['exposure', 'purchase'] }).notNull(),
    /** The experiment's tracking key and the variation shown (0 = control); exposures only. */
    experimentKey: text('experiment_key'),
    variationId: integer('variation_id'),
    /** The order placed; purchases only. */
    orderId: uuid('order_id').references(() => order.id, { onDelete: 'cascade' }),
    valuePaise: integer('value_paise'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('experiment_event_kind', sql`${t.kind} in ('exposure','purchase')`),
    uniqueIndex('experiment_event_exposure')
      .on(t.storeId, t.visitorId, t.experimentKey, t.variationId)
      .where(sql`kind = 'exposure'`),
    uniqueIndex('experiment_event_order').on(t.orderId).where(sql`kind = 'purchase'`),
    index('experiment_event_store_created').on(t.storeId, t.createdAt),
  ],
)
