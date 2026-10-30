import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { newId, store } from './schema'

/*
 * Home smart cards (0195). The worker rebuilds each store's cards once a day from its own
 * numbers (`@commerce/core` home-cards); Home reads them and a member can dismiss one.
 */

const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)

/**
 * SOURCE OF TRUTH: homeCard
 * WHAT:  One suggestion card on Home ("Demon1 glasspad page: 645 sessions, 1 add to cart"), its
 *        numbers in `data` (`HomeCard`, validated by `parseHomeCard`), keyed by kind plus the
 *        product or collection so a refresh updates it in place.
 * WHY:   A dismissed card keeps its row with `dismissed_at`, so the daily refresh does not bring
 *        it straight back; the refresh drops dismissals after 30 days.
 */
export const homeCard = pgTable(
  'home_card',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: storeId(),
    key: text('key').notNull(),
    data: jsonb('data').notNull(),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('home_card_store_key').on(t.storeId, t.key)],
)

/** When each store's cards were last rebuilt, so the worker refreshes once a day. */
export const homeCardRun = pgTable(
  'home_card_run',
  {
    storeId: storeId().primaryKey(),
    refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('home_card_run_refreshed').on(t.refreshedAt)],
)
