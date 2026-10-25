/** Run bookkeeping for the API router: create, start, list and read imports. */
import { newId, type StoreTx } from '@commerce/db'
import type { StorageProvider } from '@commerce/storage'
import { and, asc, count, desc, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm'
import { type CsvResource, IMPORT_RESOURCES, type ImportResource, MAX_CSV_BYTES } from './client'
import { importIssue, importRun } from './schema'
import { freshSnapshot } from './snapshot'

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
  input: { resources: ImportResource[]; includeUnusedFiles?: boolean; createdBy: string | null },
): Promise<RunRow> {
  if (input.resources.length === 0) throw new ImportError('Choose at least one thing to import')
  const [row] = await tx
    .insert(importRun)
    .values({
      storeId,
      mode: 'api',
      resources: [...new Set(input.resources)],
      includeUnusedFiles: input.includeUnusedFiles ?? false,
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
    .set({
      dryRun: false,
      status: 'queued',
      error: null,
      stopRequestedAt: null,
      stoppedBy: null,
      updatedAt: new Date(),
    })
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
 * A running import touches its row at least every minute while it is getting
 * somewhere (`executeRun`'s heartbeat, plus every progress flush). One silent for
 * this long lost its worker (a crash or out-of-memory kill) without anything
 * marking it failed. A run whose worker is alive but stuck is stopped by
 * `executeRun`'s own watchdog (STUCK_MS in run.ts), which also stops touching the
 * row, so this backstop still applies if stopping it goes wrong.
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

/**
 * Stop import on a running run: its worker checks every few seconds and stops
 * within seconds. One that has not stopped this long after (a hung or dead
 * worker) is marked stopped by the next read; if its job ever wakes up, it sees
 * the run stopped and does nothing.
 */
const STOP_GRACE_MS = 60_000

/**
 * Backstops, run on every read: fail runs `running` with no sign of life for
 * `RUN_STALE_MS` (a lost failure event), and mark stopped those asked to stop
 * more than `STOP_GRACE_MS` ago that their worker never acknowledged.
 */
async function failStaleRuns(tx: StoreTx, now = new Date()): Promise<void> {
  await tx
    .update(importRun)
    .set({ status: 'cancelled', finishedAt: now, updatedAt: now })
    .where(
      and(
        eq(importRun.status, 'running'),
        lt(importRun.stopRequestedAt, new Date(now.getTime() - STOP_GRACE_MS)),
      ),
    )
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

/**
 * Stop import. A queued run is cancelled at once (`jobKey` is its queued job, for
 * the caller to take off the queue). A running one is asked to stop: its worker
 * stops between records and aborts its copies within seconds, then marks it
 * cancelled (`STOP_GRACE_MS` backstop above). Whatever it imported stays.
 */
export async function requestStop(
  tx: StoreTx,
  id: string,
  stoppedBy: string | null,
  now = new Date(),
): Promise<{ run: RunRow; jobKey: string | null }> {
  await failStaleRuns(tx, now)
  const [current] = await tx.select().from(importRun).where(eq(importRun.id, id))
  if (!current) throw new ImportError('Import not found')
  if (current.status !== 'queued' && current.status !== 'running') {
    throw new ImportError('This import is not running')
  }
  if (current.status === 'queued') {
    const [row] = await tx
      .update(importRun)
      .set({
        status: 'cancelled',
        stopRequestedAt: now,
        stoppedBy,
        finishedAt: now,
        updatedAt: now,
      })
      .where(and(eq(importRun.id, id), eq(importRun.status, 'queued')))
      .returning()
    if (row) return { run: row, jobKey: runJobKey(current) }
  }
  // Running (or it started a moment ago): its worker stops it. A second press keeps the first time.
  const [row] = await tx
    .update(importRun)
    .set({ stopRequestedAt: current.stopRequestedAt ?? now, stoppedBy })
    .where(and(eq(importRun.id, id), inArray(importRun.status, ['queued', 'running'])))
    .returning()
  if (!row) throw new ImportError('This import is not running')
  return { run: row, jobKey: null }
}

/** Whether a real import (not a preview) is writing to the store now: the admin's "busy" notice. */
export async function importInProgress(tx: StoreTx): Promise<boolean> {
  const [row] = await tx
    .select({ id: importRun.id })
    .from(importRun)
    .where(and(eq(importRun.status, 'running'), eq(importRun.dryRun, false)))
    .limit(1)
  return Boolean(row)
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
      stoppedBy: importRun.stoppedBy,
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
    .select({
      n: count(),
      retryable: sql<number>`count(distinct (${importIssue.resource}, ${importIssue.sourceId}))
        filter (where ${importIssue.sourceId} is not null)`.mapWith(Number),
    })
    .from(importIssue)
    .where(eq(importIssue.runId, id))
  return { ...row, issueCount: issues?.n ?? 0, retryable: issues?.retryable ?? 0 }
}

/**
 * "Import remaining": one real import of `resources` that writes only records
 * not imported yet or with an open problem (`remainingFilter` in status.ts).
 * A preview copy under a day old moves to it, so it reads that instead of Shopify.
 */
export async function createRemainingRun(
  tx: StoreTx,
  storeId: string,
  input: { resources: ImportResource[]; createdBy: string | null },
): Promise<RunRow> {
  const resources = IMPORT_RESOURCES.filter((r) => input.resources.includes(r))
  if (resources.length === 0) throw new ImportError('Everything is already here')
  await failStaleRuns(tx)
  const [busy] = await tx
    .select({ id: importRun.id })
    .from(importRun)
    .where(inArray(importRun.status, ['queued', 'running']))
    .limit(1)
  if (busy) throw new ImportError('An import is already running; wait for it to finish')
  const withCopy = await tx
    .select({ id: importRun.id, snapshot: importRun.snapshot, at: importRun.snapshotTakenAt })
    .from(importRun)
    .where(isNotNull(importRun.snapshot))
    .orderBy(desc(importRun.snapshotTakenAt))
    .limit(1)
  const copy = withCopy[0] && freshSnapshot(withCopy[0].snapshot) ? withCopy[0] : null
  const [row] = await tx
    .insert(importRun)
    .values({
      storeId,
      mode: 'api',
      resources,
      dryRun: false,
      onlyMissing: true,
      createdBy: input.createdBy,
      ...(copy ? { snapshot: copy.snapshot, snapshotTakenAt: copy.at } : {}),
    })
    .returning()
  if (!row) throw new ImportError('The import was not created')
  if (copy) {
    await tx
      .update(importRun)
      .set({ snapshot: null, snapshotTakenAt: null })
      .where(eq(importRun.id, copy.id))
  }
  return row
}

/** What a retry of `runId` imports again: per resource, the import keys of its problems. */
export async function retryTargets(
  tx: StoreTx,
  runId: string,
): Promise<Map<ImportResource, Set<string>>> {
  const rows = await tx
    .selectDistinct({ resource: importIssue.resource, sourceId: importIssue.sourceId })
    .from(importIssue)
    .where(and(eq(importIssue.runId, runId), isNotNull(importIssue.sourceId)))
  const out = new Map<ImportResource, Set<string>>()
  for (const r of rows) {
    if (!r.sourceId || !IMPORT_RESOURCES.includes(r.resource as ImportResource)) continue
    const resource = r.resource as ImportResource
    const set = out.get(resource) ?? new Set<string>()
    set.add(r.sourceId)
    out.set(resource, set)
  }
  return out
}

/**
 * "Retry the ones that were missed": a new import of only the records (and
 * images, and files) the finished import `previousId` reported problems for.
 * The previous run keeps its report; the new one reports only what it retried.
 * The previous run's copy of what it read moves to the new run, so the retry
 * reads from it while it is fresh.
 */
export async function createRetryRun(
  tx: StoreTx,
  storeId: string,
  previousId: string,
  createdBy: string | null,
): Promise<RunRow> {
  await failStaleRuns(tx)
  const [previous] = await tx.select().from(importRun).where(eq(importRun.id, previousId))
  if (!previous) throw new ImportError('Import not found')
  if (previous.dryRun) throw new ImportError('Import this preview first')
  if (previous.status === 'queued' || previous.status === 'running') {
    throw new ImportError('This import is still running')
  }
  const targets = await retryTargets(tx, previousId)
  const resources = IMPORT_RESOURCES.filter((r) => targets.has(r))
  if (resources.length === 0)
    throw new ImportError('Nothing was missed, so there is nothing to retry')
  const [row] = await tx
    .insert(importRun)
    .values({
      storeId,
      mode: previous.mode,
      resources,
      dryRun: false,
      fileKey: previous.fileKey,
      fileName: previous.fileName,
      createdBy,
      retryOf: previousId,
      snapshot: previous.snapshot,
      snapshotTakenAt: previous.snapshotTakenAt,
    })
    .returning()
  if (!row) throw new ImportError('The retry was not created')
  if (previous.snapshot) {
    await tx
      .update(importRun)
      .set({ snapshot: null, snapshotTakenAt: null })
      .where(eq(importRun.id, previousId))
  }
  return row
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
