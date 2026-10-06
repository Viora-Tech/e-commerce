import { newId, store } from '@commerce/db'
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Tables owned by the Forms app. They live in the platform's single migration chain
 * (packages/db/drizzle) and carry `store_id`, so `apply_store_rls()` isolates them like
 * core tables.
 */

/**
 * One message a shopper sent from a theme's contact or advice form. `fields` holds every
 * other `contact[...]` field of the form (an advice form's "skin type") as JSON text.
 */
export const contactMessage = pgTable(
  'contact_message',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    name: text('name').notNull().default(''),
    email: text('email').notNull().default(''),
    phone: text('phone').notNull().default(''),
    body: text('body').notNull().default(''),
    fields: text('fields').notNull().default('{}'),
    /** The storefront path the form was on, e.g. `/pages/contact`. */
    path: text('path').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('contact_message_store_created').on(t.storeId, t.createdAt)],
)
