import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { newId, store } from './schema'

/*
 * A store's own layout for one transactional email (Settings → Notifications → Edit design).
 * One row per store and template; no row means the built-in email. `design` is the block list
 * (`@commerce/notifications` `EmailTemplateDesign`), validated by the API on save and parsed
 * again on every send. Carries `store_id` and sits under RLS. Migration 0261.
 */
export const emailTemplateDesign = pgTable(
  'email_template_design',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    /** The `TemplateId` (`order_placed`). */
    template: text('template').notNull(),
    design: jsonb('design').notNull(),
    /** Staff email of whoever saved it last. */
    updatedBy: text('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('email_template_design_store_template').on(t.storeId, t.template)],
)
