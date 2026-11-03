import { sql } from 'drizzle-orm'
import { check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { newId, store } from './schema'

/*
 * Settings → Activity log: every change a member made to the store, who made it and from where.
 * Written by the store procedure middleware after a change succeeds (`packages/api/src/
 * procedures/activity.ts`), never for a read. Kept for a year (the worker's daily prune).
 */

/** Where a change came from: the admin, the AI assistant, an MCP client, an access token, the worker or the storefront. */
export const STORE_ACTIVITY_SOURCES = [
  'admin',
  'assistant',
  'mcp',
  'api',
  'worker',
  'storefront',
] as const
export type StoreActivitySource = (typeof STORE_ACTIVITY_SOURCES)[number]

/**
 * What changed: the fields' values before and after when the handler said so, otherwise the
 * input it was given. Secrets and personal data are removed before the row is written.
 */
export type StoreActivityChanges = {
  input?: unknown
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

export const storeActivity = pgTable(
  'store_activity',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    /** Kept as text with the name and email beside it: the member may leave the store later. */
    actorUserId: text('actor_user_id'),
    actorName: text('actor_name'),
    actorEmail: text('actor_email'),
    source: text('source').$type<StoreActivitySource>().notNull(),
    /** The procedure, e.g. `shipping.zones.create`. */
    action: text('action').notNull(),
    /** The MCP & API area it belongs to (`settings`, `orders`…), or its router namespace. */
    area: text('area').notNull(),
    resourceType: text('resource_type'),
    resourceId: text('resource_id'),
    /** One plain line: "Shipping zones: create · Kinja". */
    summary: text('summary').notNull(),
    changes: jsonb('changes').$type<StoreActivityChanges>(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('store_activity_store').on(t.storeId, t.createdAt),
    index('store_activity_actor').on(t.storeId, t.actorUserId, t.createdAt),
    check(
      'store_activity_source',
      sql`${t.source} in ('admin','assistant','mcp','api','worker','storefront')`,
    ),
  ],
)
