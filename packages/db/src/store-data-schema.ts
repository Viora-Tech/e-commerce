import { sql } from 'drizzle-orm'
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { newId, store } from './schema'

/**
 * Store export and offboarding (Settings → General → "Your store's data").
 *
 * `store_export` is one requested full-data export: queued, built by the worker into a
 * zip (one NDJSON file per table) in the store's own storage, then downloadable until it
 * expires. Per store, under RLS like every tenant table.
 *
 * `platform_audit_event` is the platform's record of store-level actions that must
 * outlive the store itself: an export requested, the store deleted. It has no `store_id`
 * column on purpose (deleting a store removes every row that has one), only
 * `subject_store_id`, and the app role may insert into it but never read, change or
 * delete it (migration 0078). The platform owner reads it on the owner connection.
 */

const STORE_EXPORT_STATUSES = ['queued', 'running', 'ready', 'failed'] as const
export type StoreExportStatus = (typeof STORE_EXPORT_STATUSES)[number]

export const storeExport = pgTable(
  'store_export',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    status: text('status').$type<StoreExportStatus>().notNull().default('queued'),
    /** Storage key of the zip, `stores/<id>/private/exports/<id>-<random>.zip`. Never public. */
    key: text('key'),
    sizeBytes: integer('size_bytes'),
    tableCount: integer('table_count'),
    rowCount: integer('row_count'),
    error: text('error'),
    /** Better Auth user id and email of the member who asked for it. */
    requestedBy: text('requested_by'),
    requestedByEmail: text('requested_by_email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** After this the file is deleted and the row stays as history. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [
    index('store_export_store_created').on(t.storeId, t.createdAt),
    check(
      'store_export_status_check',
      sql`${t.status} in ('queued', 'running', 'ready', 'failed')`,
    ),
  ],
)

export const platformAuditEvent = pgTable(
  'platform_audit_event',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    /** The store acted on. Not a foreign key: the row must survive the store's deletion. */
    subjectStoreId: uuid('subject_store_id').notNull(),
    subjectStoreSlug: text('subject_store_slug'),
    subjectStoreName: text('subject_store_name'),
    actorUserId: text('actor_user_id'),
    actorEmail: text('actor_email'),
    /** `store.export_requested`, `store.export_downloaded`, `store.deleted`. */
    action: text('action').notNull(),
    /** Counts and ids only, never personal data. */
    detail: jsonb('detail').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('platform_audit_event_subject').on(t.subjectStoreId, t.createdAt)],
)

/**
 * The platform console's access log (`/platform`, Koomerce staff only): one row per page or
 * API read a staff member made, with the store it looked into when there is one. No
 * `store_id` (the console is cross-store and the row must outlive a store) and no grant to the
 * app role at all: the console writes and reads it on the owner connection (migration 0186).
 */
export const platformAccessLog = pgTable(
  'platform_access_log',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    actorUserId: text('actor_user_id').notNull(),
    actorEmail: text('actor_email').notNull(),
    /** `overview.read`, `stores.list`, `stores.detail`, `users.list`, `audit.list`, … */
    action: text('action').notNull(),
    /** The store looked into, when the read was about one. Not a foreign key. */
    storeId: uuid('store_id_ref'),
    /** What was read inside it, or the search used (`q=waimers`, `page=2`). */
    target: text('target'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('platform_access_log_created').on(t.createdAt),
    index('platform_access_log_store').on(t.storeId, t.createdAt),
    index('platform_access_log_actor').on(t.actorEmail, t.createdAt),
  ],
)
