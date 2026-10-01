/** SOURCE OF TRUTH: store export and offboarding — export requests, the worker job, downloads, store delete and the platform audit trail */
import { randomBytes } from 'node:crypto'
import {
  platformAuditEvent,
  type StoreExportStatus,
  type StoreTx,
  store,
  storeExport,
} from '@commerce/db'
import type { StorageProvider } from '@commerce/storage'
import { and, desc, eq, gt, inArray, isNotNull, lt } from 'drizzle-orm'
import { deleteStoreFiles, deleteStoreRows, storeFilesPrefix, storeMediaKeys } from './delete'
import { buildStoreExport } from './export'

/** One job per requested export; the worker builds the zip (see `apps/worker/src/store-export.ts`). */
export const STORE_EXPORT_QUEUE = '{store}-export'

export type StoreExportJob = { storeId: string; exportId: string }

export type StoreExportQueue = {
  add(
    name: string,
    data: StoreExportJob,
    opts?: { jobId?: string; attempts?: number; removeOnComplete?: boolean },
  ): Promise<unknown>
}

/** How long a finished export can be downloaded before its file is deleted. */
export const STORE_EXPORT_TTL_DAYS = 7

export type StoreActor = { userId: string; email: string }

export type StoreExportRow = {
  id: string
  status: StoreExportStatus
  sizeBytes: number | null
  tableCount: number | null
  rowCount: number | null
  error: string | null
  requestedByEmail: string | null
  createdAt: Date
  finishedAt: Date | null
  expiresAt: Date | null
  /** Ready, not yet expired, and its file is still there. */
  downloadable: boolean
}

/** Runs `fn` in a transaction scoped to the store: `withStore` in the worker, the request's own tx in the API. */
export type InStore = <T>(fn: (tx: StoreTx) => Promise<T>) => Promise<T>

async function storeLabel(tx: StoreTx, storeId: string) {
  const [s] = await tx
    .select({ slug: store.slug, name: store.name })
    .from(store)
    .where(eq(store.id, storeId))
  return s ?? { slug: null, name: null }
}

/** Appends to the platform's own audit trail (insert only for the app role). */
async function recordPlatformAudit(
  tx: StoreTx,
  input: {
    storeId: string
    actor: StoreActor | null
    action: 'store.export_requested' | 'store.export_downloaded' | 'store.deleted'
    detail?: Record<string, unknown> | undefined
  },
): Promise<void> {
  const label = await storeLabel(tx, input.storeId)
  await tx.insert(platformAuditEvent).values({
    subjectStoreId: input.storeId,
    subjectStoreSlug: label.slug,
    subjectStoreName: label.name,
    actorUserId: input.actor?.userId ?? null,
    actorEmail: input.actor?.email ?? null,
    action: input.action,
    detail: input.detail ?? null,
  })
}

const toRow = (r: typeof storeExport.$inferSelect, now: Date): StoreExportRow => ({
  id: r.id,
  status: r.status,
  sizeBytes: r.sizeBytes,
  tableCount: r.tableCount,
  rowCount: r.rowCount,
  error: r.error,
  requestedByEmail: r.requestedByEmail,
  createdAt: r.createdAt,
  finishedAt: r.finishedAt,
  expiresAt: r.expiresAt,
  downloadable:
    r.status === 'ready' && !!r.key && (!r.expiresAt || r.expiresAt.getTime() > now.getTime()),
})

/** The store's latest exports, newest first. */
export async function listStoreExports(
  tx: StoreTx,
  now: Date = new Date(),
): Promise<StoreExportRow[]> {
  const rows = await tx.select().from(storeExport).orderBy(desc(storeExport.createdAt)).limit(10)
  return rows.map((r) => toRow(r, now))
}

/** A queued or running export older than this is treated as lost (worker down) and does not block a new one. */
const STALE_EXPORT_MS = 60 * 60_000

/**
 * Queues a full export. One at a time: while an export is queued or running, asking again
 * returns that one instead of starting a second.
 */
export async function requestStoreExport(
  tx: StoreTx,
  storeId: string,
  actor: StoreActor,
  now: Date = new Date(),
): Promise<{ exportId: string; created: boolean }> {
  const [pending] = await tx
    .select({ id: storeExport.id })
    .from(storeExport)
    .where(
      and(
        inArray(storeExport.status, ['queued', 'running']),
        gt(storeExport.createdAt, new Date(now.getTime() - STALE_EXPORT_MS)),
      ),
    )
    .limit(1)
  if (pending) return { exportId: pending.id, created: false }
  const [row] = await tx
    .insert(storeExport)
    .values({ storeId, requestedBy: actor.userId, requestedByEmail: actor.email })
    .returning({ id: storeExport.id })
  if (!row) throw new Error('could not create the export')
  await recordPlatformAudit(tx, {
    storeId,
    actor,
    action: 'store.export_requested',
    detail: { exportId: row.id },
  })
  return { exportId: row.id, created: true }
}

/**
 * Builds the zip and puts it in the store's storage, as three short transactions so the
 * admin sees "running" while it works: mark running, build and upload, mark ready. A
 * failure marks the export failed with the reason and rethrows (the worker logs it).
 * Expired exports' files are deleted on the way.
 */
export async function runStoreExport(
  inStore: InStore,
  input: {
    storeId: string
    exportId: string
    provider: StorageProvider
    secret: string
    now?: (() => Date) | undefined
  },
): Promise<void> {
  const now = input.now ?? (() => new Date())
  const started = await inStore(async (tx) => {
    const [row] = await tx
      .update(storeExport)
      .set({ status: 'running', error: null })
      .where(
        and(eq(storeExport.id, input.exportId), inArray(storeExport.status, ['queued', 'failed'])),
      )
      .returning({ id: storeExport.id })
    return !!row
  })
  if (!started) return // already built (a retried job) or gone with its store

  try {
    const built = await inStore(async (tx) => {
      const result = await buildStoreExport(tx, input.storeId, { secret: input.secret, now: now() })
      const key = `${storeFilesPrefix(input.storeId)}private/exports/${input.exportId}-${randomBytes(16).toString('hex')}.zip`
      await input.provider.put({ key, body: result.zip, contentType: 'application/zip' })
      return { key, size: result.zip.byteLength, tables: result.tableCount, rows: result.rowCount }
    })
    await inStore(async (tx) => {
      const finishedAt = now()
      await tx
        .update(storeExport)
        .set({
          status: 'ready',
          key: built.key,
          sizeBytes: built.size,
          tableCount: built.tables,
          rowCount: built.rows,
          finishedAt,
          expiresAt: new Date(finishedAt.getTime() + STORE_EXPORT_TTL_DAYS * 86_400_000),
        })
        .where(eq(storeExport.id, input.exportId))
      await purgeExpiredExports(tx, input.provider, finishedAt)
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await inStore((tx) =>
      tx
        .update(storeExport)
        .set({ status: 'failed', error: message.slice(0, 500), finishedAt: now() })
        .where(eq(storeExport.id, input.exportId)),
    )
    throw err
  }
}

/** Deletes the files of exports past their expiry; the rows stay as history. */
export async function purgeExpiredExports(
  tx: StoreTx,
  provider: StorageProvider,
  now: Date = new Date(),
): Promise<number> {
  const expired = await tx
    .select({ id: storeExport.id, key: storeExport.key })
    .from(storeExport)
    .where(and(isNotNull(storeExport.key), lt(storeExport.expiresAt, now)))
  for (const e of expired) {
    if (e.key) await provider.delete(e.key)
    await tx.update(storeExport).set({ key: null }).where(eq(storeExport.id, e.id))
  }
  return expired.length
}

/** The zip's bytes for a download, or null when it is not ready, expired or missing. */
export async function readStoreExport(
  tx: StoreTx,
  provider: StorageProvider,
  input: { storeId: string; exportId: string; actor: StoreActor; now?: Date | undefined },
): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const now = input.now ?? new Date()
  const [row] = await tx.select().from(storeExport).where(eq(storeExport.id, input.exportId))
  if (!row || !toRow(row, now).downloadable || !row.key) return null
  const bytes = await provider.get(row.key)
  if (!bytes) return null
  await recordPlatformAudit(tx, {
    storeId: input.storeId,
    actor: input.actor,
    action: 'store.export_downloaded',
    detail: { exportId: row.id },
  })
  const { slug } = await storeLabel(tx, input.storeId)
  const day = (row.finishedAt ?? row.createdAt).toISOString().slice(0, 10)
  return { bytes, filename: `${slug ?? 'store'}-data-${day}.zip` }
}

/** What the "Delete store" dialog asks the owner to type: the store's name, as shown. */
export const deleteConfirmationMatches = (typed: string, storeName: string): boolean =>
  typed.trim().toLowerCase() === storeName.trim().toLowerCase() && storeName.trim().length > 0

/**
 * Closes a store for good: its files first (so a storage failure leaves the store intact
 * to try again), then every row (`deleteStoreRows`), then one `store.deleted` entry in
 * the platform audit trail with the counts. Call it in the store's own transaction.
 */
export async function deleteStore(
  tx: StoreTx,
  input: { storeId: string; actor: StoreActor; providers: StorageProvider[] },
): Promise<{ files: number; rows: number; tables: number }> {
  const label = await storeLabel(tx, input.storeId)
  const files = await deleteStoreFiles(input.providers, input.storeId, await storeMediaKeys(tx))
  const deleted = await deleteStoreRows(tx, input.storeId)
  await tx.insert(platformAuditEvent).values({
    subjectStoreId: input.storeId,
    subjectStoreSlug: label.slug,
    subjectStoreName: label.name,
    actorUserId: input.actor.userId,
    actorEmail: input.actor.email,
    action: 'store.deleted',
    detail: {
      files,
      rows: deleted.rows,
      tables: deleted.tables,
      organizationId: deleted.organizationId,
    },
  })
  return { files, rows: deleted.rows, tables: Object.keys(deleted.tables).length }
}
