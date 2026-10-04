/** Run bookkeeping for the API router: create, start, list and read imports. */
import { newId, type StoreTx } from '@commerce/db'
import type { StorageProvider } from '@commerce/storage'
import { and, asc, count, desc, eq, inArray, lt } from 'drizzle-orm'
import { type CsvResource, type ImportResource, MAX_CSV_BYTES } from './client'
import { importIssue, importRun } from './schema'

export class ImportError extends Error {}

export type RunRow = typeof importRun.$inferSelect

export const csvKey = (storeId: string, runId: string) =>
  `stores/${storeId}/private/imports/${runId}.csv`

/** Store the uploaded CSV privately and create a dry run for it. */
export async function createCsvRun(
  tx: StoreTx,
  storeId: string,
  storage: StorageProvider,
  input: { resource: CsvResource; fileName: string; csv: string; createdBy: string | null },
): Promise<RunRow> {
  const body = new TextEncoder().encode(input.csv)
  if (body.byteLength === 0) throw new ImportError('The file is empty')
  if (body.byteLength > MAX_CSV_BYTES) {
    throw new ImportError('The file is larger than 15 MB. Split it, or import over the API.')
  }
  const id = newId()
  const fileKey = csvKey(storeId, id)
  await storage.put({ key: fileKey, body, contentType: 'text/csv' })
  const [row] = await tx
    .insert(importRun)
    .values({
      id,
      storeId,
      mode: 'csv',
      resources: [input.resource],
      dryRun: true,
      fileKey,
      fileName: input.fileName.slice(0, 200),
      createdBy: input.createdBy,
    })
    .returning()
  if (!row) throw new ImportError('The import was not created')
  return row
}

export async function createApiRun(
  tx: StoreTx,
  storeId: string,
  input: { resources: ImportResource[]; createdBy: string | null },
): Promise<RunRow> {
  if (input.resources.length === 0) throw new ImportError('Choose at least one thing to import')
  const [row] = await tx
    .insert(importRun)
    .values({
      storeId,
      mode: 'api',
      resources: [...new Set(input.resources)],
      dryRun: true,
      createdBy: input.createdBy,
    })
    .returning()
  if (!row) throw new ImportError('The import was not created')
  return row
}

/**
 * Turn a finished preview into the real import, or run a finished import again
 * (safe: it matches what it created before). Refused while one is running.
 */
export async function startRun(tx: StoreTx, id: string): Promise<RunRow> {
  await failStaleRuns(tx)
  const [current] = await tx.select().from(importRun).where(eq(importRun.id, id))
  if (!current) throw new ImportError('Import not found')
  if (current.status === 'queued' || current.status === 'running') {
    throw new ImportError('This import is already running')
  }
  const [row] = await tx
    .update(importRun)
    .set({ dryRun: false, status: 'queued', error: null, updatedAt: new Date() })
    .where(eq(importRun.id, id))
    .returning()
  if (!row) throw new ImportError('Import not found')
  return row
}

/**
 * The queue's dedupe key for one start of a run. BullMQ keeps a failed job
 * and silently ignores a new one with the same id, so the key changes with
 * every start (`startRun` and the create calls stamp `updatedAt`); a double
 * click never reaches the queue twice because `startRun` refuses a run that is
 * already queued or running.
 */
export const runJobKey = (run: Pick<RunRow, 'id' | 'updatedAt'>) =>
  `run-${run.id}-${run.updatedAt.getTime()}`

/**
 * A running import touches its row at least every minute (`executeRun`'s
 * heartbeat, plus every progress flush). One silent for this long lost its
 * worker (a crash or out-of-memory kill) without anything marking it failed.
 */
const RUN_STALE_MS = 10 * 60 * 1000

const INTERRUPTED_ERROR =
  'The import stopped unexpectedly (the server restarted or ran out of memory). Press Try again: it carries on from the start without duplicating anything.'

/**
 * End a run whose job died for good (called from the importer's `jobFailed`
 * handler). Only a run still waiting or running changes; a finished one keeps
 * its result.
 */
export async function failInterruptedRun(tx: StoreTx, id: string): Promise<boolean> {
  const rows = await tx
    .update(importRun)
    .set({
      status: 'failed',
      error: INTERRUPTED_ERROR,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(importRun.id, id), inArray(importRun.status, ['queued', 'running'])))
    .returning({ id: importRun.id })
  return rows.length > 0
}

/** Backstop for a lost failure event: fail runs `running` with no sign of life for `RUN_STALE_MS`. */
async function failStaleRuns(tx: StoreTx, now = new Date()): Promise<void> {
  await tx
    .update(importRun)
    .set({ status: 'failed', error: INTERRUPTED_ERROR, finishedAt: now, updatedAt: now })
    .where(
      and(
        eq(importRun.status, 'running'),
        lt(importRun.updatedAt, new Date(now.getTime() - RUN_STALE_MS)),
      ),
    )
}

/** Mark a run failed when its job could not be queued, so the page does not wait forever. */
export async function failRun(tx: StoreTx, id: string, error: string): Promise<void> {
  await tx
    .update(importRun)
    .set({ status: 'failed', error, finishedAt: new Date(), updatedAt: new Date() })
    .where(eq(importRun.id, id))
}

export async function listRuns(tx: StoreTx, input: { page: number; perPage: number }) {
  await failStaleRuns(tx)
  const [total] = await tx.select({ n: count() }).from(importRun)
  const items = await tx
    .select({
      id: importRun.id,
      mode: importRun.mode,
      resources: importRun.resources,
      dryRun: importRun.dryRun,
      status: importRun.status,
      fileName: importRun.fileName,
      progress: importRun.progress,
      error: importRun.error,
      createdBy: importRun.createdBy,
      createdAt: importRun.createdAt,
      finishedAt: importRun.finishedAt,
    })
    .from(importRun)
    .orderBy(desc(importRun.createdAt), desc(importRun.id))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  return { items, total: total?.n ?? 0 }
}

export async function getRun(tx: StoreTx, id: string) {
  await failStaleRuns(tx)
  const [row] = await tx.select().from(importRun).where(eq(importRun.id, id))
  if (!row) return null
  const [issues] = await tx
    .select({ n: count() })
    .from(importIssue)
    .where(eq(importIssue.runId, id))
  return { ...row, issueCount: issues?.n ?? 0 }
}

export async function listIssues(
  tx: StoreTx,
  input: { runId: string; page: number; perPage: number; resource?: string | undefined },
) {
  const where = and(
    eq(importIssue.runId, input.runId),
    input.resource ? eq(importIssue.resource, input.resource) : undefined,
  )
  const [total] = await tx.select({ n: count() }).from(importIssue).where(where)
  const items = await tx
    .select({
      id: importIssue.id,
      resource: importIssue.resource,
      row: importIssue.row,
      ref: importIssue.ref,
      message: importIssue.message,
    })
    .from(importIssue)
    .where(where)
    .orderBy(asc(importIssue.row), asc(importIssue.createdAt), asc(importIssue.id))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  return { items, total: total?.n ?? 0 }
}
