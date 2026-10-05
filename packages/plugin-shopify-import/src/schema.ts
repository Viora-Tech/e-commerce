import { newId, store } from '@commerce/db'
import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Tables owned by the Shopify importer app. They join the platform's single
 * migration chain and carry `store_id`, so `apply_store_rls()` isolates them.
 */

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const at = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow()

import type {
  ImportResource,
  ImportSnapshot,
  PreviewSample,
  ResourceProgress,
  SnapshotUse,
} from './client'
import { ISSUE_KINDS, RUN_STATUSES } from './client'

export {
  IMPORT_RESOURCES,
  type ImportResource,
  type PreviewSample,
  type ResourceProgress,
  RUN_STATUSES,
  type RunStatus,
} from './client'

/**
 * The store's Shopify connection for API imports. `access_token` is encrypted
 * with SETTINGS_SECRET like every other stored credential; the API only ever
 * returns it masked.
 */
export const shopifyConnection = pgTable(
  'shopify_import_connection',
  {
    id: id(),
    storeId: storeId(),
    shopDomain: text('shop_domain').notNull(),
    accessToken: text('access_token').notNull(),
    shopName: text('shop_name'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: at('created_at'),
    updatedAt: at('updated_at'),
  },
  (t) => [uniqueIndex('shopify_import_connection_store').on(t.storeId)],
)

/**
 * One import. A dry run fills `progress` and `preview` without writing
 * anything; starting it flips `dry_run` off and runs the same input for real.
 * Runs are safe to repeat: every write matches on the import mapping first.
 */
export const importRun = pgTable(
  'shopify_import_run',
  {
    id: id(),
    storeId: storeId(),
    mode: text('mode', { enum: ['csv', 'api'] }).notNull(),
    resources: text('resources').array().$type<ImportResource[]>().notNull(),
    dryRun: boolean('dry_run').notNull().default(true),
    status: text('status', { enum: RUN_STATUSES }).notNull().default('queued'),
    /** Private storage key of the uploaded CSV (csv mode). */
    fileKey: text('file_key'),
    fileName: text('file_name'),
    progress: jsonb('progress')
      .$type<Partial<Record<ImportResource, ResourceProgress>>>()
      .notNull()
      .default({}),
    preview: jsonb('preview').$type<PreviewSample[]>().notNull().default([]),
    /**
     * A finished preview's copy of what it read (gzipped JSONL per resource in
     * private storage), reused by the import that follows within 24 hours.
     * Deleted when that import finishes, or after 7 days.
     */
    snapshot: jsonb('snapshot').$type<ImportSnapshot>(),
    snapshotTakenAt: timestamp('snapshot_taken_at', { withTimezone: true }),
    /** Set on a real import that read the preview's copy instead of Shopify. */
    snapshotUse: jsonb('snapshot_use').$type<SnapshotUse>(),
    /** Why the run as a whole stopped; row problems go to shopify_import_issue. */
    error: text('error'),
    createdBy: text('created_by'),
    /** Set on "Retry the ones that were missed": the run whose problems this one retries. */
    retryOf: uuid('retry_of').references((): AnyPgColumn => importRun.id, {
      onDelete: 'set null',
    }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: at('created_at'),
    updatedAt: at('updated_at'),
  },
  (t) => [
    check('shopify_import_run_mode', sql`${t.mode} in ('csv', 'api')`),
    check(
      'shopify_import_run_status',
      sql`${t.status} in ('queued', 'running', 'completed', 'failed')`,
    ),
    index('shopify_import_run_store_created').on(t.storeId, t.createdAt),
    index('shopify_import_run_snapshot_taken')
      .on(t.snapshotTakenAt)
      .where(sql`${t.snapshotTakenAt} is not null`),
  ],
)

/** A row or record that could not be imported, with the reason. */
export const importIssue = pgTable(
  'shopify_import_issue',
  {
    id: id(),
    storeId: storeId(),
    runId: uuid('run_id')
      .notNull()
      .references(() => importRun.id, { onDelete: 'cascade' }),
    resource: text('resource').notNull(),
    /** CSV line number (1 is the header); null for API records. */
    row: integer('row'),
    /** Handle, email, order name or Shopify id, whatever identifies the record. */
    ref: text('ref'),
    message: text('message').notNull(),
    /**
     * The record's import key (Shopify id, or the CSV key such as `handle:tee`) when the
     * problem is one a retry can fix; null for problems a retry would only repeat.
     */
    sourceId: text('source_id'),
    /** What failed: the record itself, one of its images, or a file from Files. */
    kind: text('kind', { enum: ISSUE_KINDS }),
    createdAt: at('created_at'),
  },
  (t) => [
    index('shopify_import_issue_run').on(t.runId),
    check('shopify_import_issue_kind', sql`${t.kind} in ('record', 'media', 'file')`),
  ],
)

/**
 * Shopify id (or a stable CSV key such as `handle:tee`) → our row id, per
 * resource. Re-running an import updates what it created before instead of
 * duplicating it; media rows are keyed by source URL so images download once.
 */
export const importMapping = pgTable(
  'shopify_import_mapping',
  {
    id: id(),
    storeId: storeId(),
    resource: text('resource').notNull(),
    sourceId: text('source_id').notNull(),
    localId: uuid('local_id').notNull(),
    updatedAt: at('updated_at'),
  },
  (t) => [
    uniqueIndex('shopify_import_mapping_source').on(t.storeId, t.resource, t.sourceId),
    index('shopify_import_mapping_local').on(t.storeId, t.resource, t.localId),
  ],
)
