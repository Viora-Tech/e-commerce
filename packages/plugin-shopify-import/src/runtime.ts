/**
 * What every writer shares: the store scope, the run's reporter (counters,
 * issues, dry-run samples) and the import mapping.
 */
import type { StoreTx } from '@commerce/db'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { FilesEstimate, LeftBehindReason } from './client'
import type { FileUsage } from './file-usage'
import {
  type ImportResource,
  importIssue,
  importMapping,
  importRun,
  type PreviewSample,
  type ResourceProgress,
} from './schema'
import type { Issue } from './types'

export type InStore = <T>(fn: (tx: StoreTx) => Promise<T>) => Promise<T>

export type MediaHost = {
  /** Our media id for a source image URL, re-hosting it once. Null when it cannot be fetched. */
  host(src: string, alt: string | null): Promise<string | null>
  /** Our public URL for a media id (for images inside rich text). */
  urlOf(mediaId: string): Promise<string | null>
}

export type ImportContext = {
  storeId: string
  runId: string
  dryRun: boolean
  /** Files: also copy the ones nothing imported uses (off by default). */
  includeUnusedFiles: boolean
  /** The file names products, collections, pages and articles use, filled as they are read. */
  fileUsage: FileUsage
  inStore: InStore
  media: MediaHost
  report: Reporter
  log: (message: string) => void
  /** SETTINGS_SECRET — encrypts/decrypts `customer.phone` the same way the admin and checkout paths do. */
  secret: string
  /**
   * Set when the store's file storage failed the write test at the start of the
   * run: images and files are skipped without trying (one issue says why).
   */
  mediaOff?: string | null | undefined
  /**
   * Aborted when the run is stopped (Stop import, or the watchdog): the readers
   * stop handing on records between batches and records, and copies end.
   */
  signal?: AbortSignal | undefined
}

const SAMPLES_PER_RESOURCE = 5
const FLUSH_EVERY_MS = 1500
const ISSUE_CAP = 5000

const empty = (): ResourceProgress => ({
  total: 0,
  processed: 0,
  created: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
})

/**
 * Counts, issues and samples for one run, written back to the run row in
 * batches so the admin can poll progress without every record costing a write.
 */
export class Reporter {
  readonly progress: Partial<Record<ImportResource, ResourceProgress>> = {}
  readonly preview: PreviewSample[] = []
  /** The resource the run is working through now; issues raised outside a writer land here. */
  current: ImportResource | null = null
  private pendingIssues: Issue[] = []
  private issueCount = 0
  /** Problems a retry could fix (they carry the record's import key). */
  retryable = 0
  private lastFlush = 0
  /**
   * When the run last got somewhere: a record counted, an issue raised, bytes of a
   * copy arriving, Shopify answering. The run's watchdog (`executeRun`) reads it; a
   * timer that merely proves the worker is alive does not count.
   */
  lastActivity: number
  private closed = false
  /** Records handed to the writers so far, per resource; `total` never shows less than this. */
  private readonly seen: Partial<Record<ImportResource, number>> = {}

  constructor(
    private readonly inStore: InStore,
    private readonly storeId: string,
    private readonly runId: string,
    private readonly now: () => number = Date.now,
  ) {
    this.lastActivity = now()
  }

  /** Something moved. */
  touch() {
    this.lastActivity = this.now()
  }

  /** The run has ended (or was stopped): later flushes from work still unwinding write nothing. */
  close() {
    this.closed = true
  }

  of(resource: ImportResource): ResourceProgress {
    this.progress[resource] ??= empty()
    return this.progress[resource]
  }

  /** Start a resource: its counters show from now on and it becomes `current`. */
  begin(resource: ImportResource): ResourceProgress {
    this.current = resource
    this.touch()
    return this.of(resource)
  }

  setTotal(resource: ImportResource, total: number) {
    this.of(resource).total = total
  }

  /**
   * The resource's size when it is known up front (the preview's saved copy), so the run page
   * shows "308 to bring over" from the start instead of a total growing a batch at a time.
   */
  expect(resource: ImportResource, total: number) {
    const p = this.of(resource)
    p.total = Math.max(total, this.seen[resource] ?? 0)
  }

  /** The resource is read to the end: its total is what was really handed on, not the estimate. */
  settle(resource: ImportResource) {
    const seen = this.seen[resource]
    if (seen !== undefined) this.of(resource).total = seen
  }

  addTotal(resource: ImportResource, n: number) {
    this.touch()
    const seen = (this.seen[resource] ?? 0) + n
    this.seen[resource] = seen
    const p = this.of(resource)
    p.total = Math.max(p.total, seen)
  }

  count(resource: ImportResource, outcome: 'created' | 'updated' | 'skipped' | 'failed') {
    this.touch()
    const p = this.of(resource)
    p.processed++
    p[outcome]++
  }

  /** One image or file copy finished for the current resource, stored or given up on. */
  copySettled(ok: boolean) {
    this.touch()
    if (!this.current) return
    const p = this.of(this.current)
    if (ok) p.copied = (p.copied ?? 0) + 1
    else p.notCopied = (p.notCopied ?? 0) + 1
  }

  /**
   * Note something that stays in Shopify (or arrives changed), summed per
   * reason and detail so the report reads "12 values on customers", not 12 rows.
   */
  leave(resource: ImportResource, reason: LeftBehindReason, count = 1, detail?: string) {
    if (count <= 0) return
    const p = this.of(resource)
    p.left ??= []
    const same = p.left.find((l) => l.reason === reason && l.detail === detail)
    if (same) same.count += count
    else p.left.push(detail === undefined ? { reason, count } : { reason, detail, count })
  }

  /** The Files step's counts and sizes, shown on the preview and kept on the import. */
  setFilesEstimate(estimate: FilesEstimate) {
    this.of('files').estimate = estimate
  }

  sample(sample: PreviewSample) {
    const same = this.preview.filter((s) => s.resource === sample.resource).length
    if (same < SAMPLES_PER_RESOURCE) this.preview.push(sample)
  }

  issue(issue: Issue) {
    this.touch()
    this.issueCount++
    if (issue.sourceId) this.retryable++
    if (this.issueCount <= ISSUE_CAP) this.pendingIssues.push(issue)
  }

  /** Persist progress (throttled unless forced) and any queued issues. */
  async flush(force = false) {
    if (this.closed) return
    if (!force && this.now() - this.lastFlush < FLUSH_EVERY_MS) return
    this.lastFlush = this.now()
    const issues = this.pendingIssues
    this.pendingIssues = []
    await this.inStore(async (tx) => {
      if (issues.length) {
        await tx.insert(importIssue).values(
          issues.map((i) => ({
            storeId: this.storeId,
            runId: this.runId,
            resource: i.resource,
            row: i.row ?? null,
            ref: i.ref ? String(i.ref).slice(0, 300) : null,
            message: i.message.slice(0, 1000),
            sourceId: i.sourceId ?? null,
            kind: i.kind ?? (i.sourceId ? ('record' as const) : null),
          })),
        )
      }
      await tx
        .update(importRun)
        .set({ progress: this.progress, preview: this.preview, updatedAt: new Date() })
        .where(eq(importRun.id, this.runId))
    })
  }
}

export async function findMapping(
  tx: StoreTx,
  resource: string,
  sourceId: string | null | undefined,
): Promise<string | null> {
  if (!sourceId) return null
  const [row] = await tx
    .select({ localId: importMapping.localId })
    .from(importMapping)
    .where(and(eq(importMapping.resource, resource), eq(importMapping.sourceId, sourceId)))
  return row?.localId ?? null
}

export async function saveMapping(
  tx: StoreTx,
  storeId: string,
  resource: string,
  sourceId: string | null | undefined,
  localId: string,
): Promise<void> {
  if (!sourceId) return
  await tx
    .insert(importMapping)
    .values({ storeId, resource, sourceId, localId })
    .onConflictDoUpdate({
      target: [importMapping.storeId, importMapping.resource, importMapping.sourceId],
      set: { localId, updatedAt: sql`now()` },
    })
}

/** Shopify id → our id for many records of one resource, in one query. */
export async function findMappings(
  tx: StoreTx,
  resource: string,
  sourceIds: readonly (string | null | undefined)[],
): Promise<Map<string, string>> {
  const ids = [...new Set(sourceIds.filter((s): s is string => Boolean(s)))]
  if (ids.length === 0) return new Map()
  const rows = await tx
    .select({ sourceId: importMapping.sourceId, localId: importMapping.localId })
    .from(importMapping)
    .where(and(eq(importMapping.resource, resource), inArray(importMapping.sourceId, ids)))
  return new Map(rows.map((r) => [r.sourceId, r.localId]))
}

export type MappingRow = { sourceId: string | null | undefined; localId: string }

/** `saveMapping` for many records in one statement; a repeated source id keeps the last. */
export async function saveMappings(
  tx: StoreTx,
  storeId: string,
  resource: string,
  rows: readonly MappingRow[],
): Promise<void> {
  const unique = new Map<string, string>()
  for (const r of rows) if (r.sourceId) unique.set(r.sourceId, r.localId)
  if (unique.size === 0) return
  await tx
    .insert(importMapping)
    .values([...unique].map(([sourceId, localId]) => ({ storeId, resource, sourceId, localId })))
    .onConflictDoUpdate({
      target: [importMapping.storeId, importMapping.resource, importMapping.sourceId],
      set: { localId: sql`excluded.local_id`, updatedAt: sql`now()` },
    })
}

/**
 * Write one chunk of records in a single transaction (one round of
 * `set_config`/commit and multi-row inserts instead of one per record).
 * `batch` does the writes and returns one result per record without
 * reporting; results are reported only after the commit. If anything in the
 * chunk throws, the whole transaction rolls back and every record goes through
 * `one`, today's record-at-a-time writer, so a bad record is still reported
 * exactly as before and the good ones still land.
 */
export async function writeBatch<T, R>(
  ctx: ImportContext,
  items: readonly T[],
  opts: {
    batch: (tx: StoreTx, items: readonly T[]) => Promise<R[]>
    report: (item: T, result: R) => void
    one: (item: T) => Promise<unknown>
    /** Undo in-memory caches the rolled-back transaction filled. */
    onRollback?: (() => void) | undefined
  },
): Promise<void> {
  if (items.length === 0) return
  let results: R[] | null = null
  try {
    results = await ctx.inStore((tx) => opts.batch(tx, items))
  } catch (err) {
    opts.onRollback?.()
    ctx.log(
      `${ctx.report.current ?? 'batch'}: a batch of ${items.length} failed (${errorMessage(err)}); writing them one at a time`,
    )
  }
  if (results) {
    items.forEach((item, i) => {
      opts.report(item, results[i] as R)
    })
  } else {
    for (const item of items) {
      await opts.one(item)
      await ctx.report.flush()
    }
  }
  await ctx.report.flush()
}

/** Records written per transaction by the batched writers. */
export const WRITE_BATCH_SIZE = 200

export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)
