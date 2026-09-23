/**
 * What every writer shares: the store scope, the run's reporter (counters,
 * issues, dry-run samples) and the import mapping.
 */
import type { StoreTx } from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
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
  inStore: InStore
  media: MediaHost
  report: Reporter
  log: (message: string) => void
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
  private pendingIssues: Issue[] = []
  private issueCount = 0
  private lastFlush = 0

  constructor(
    private readonly inStore: InStore,
    private readonly storeId: string,
    private readonly runId: string,
    private readonly now: () => number = Date.now,
  ) {}

  of(resource: ImportResource): ResourceProgress {
    this.progress[resource] ??= empty()
    return this.progress[resource]
  }

  setTotal(resource: ImportResource, total: number) {
    this.of(resource).total = total
  }

  addTotal(resource: ImportResource, n: number) {
    this.of(resource).total += n
  }

  count(resource: ImportResource, outcome: 'created' | 'updated' | 'skipped' | 'failed') {
    const p = this.of(resource)
    p.processed++
    p[outcome]++
  }

  sample(sample: PreviewSample) {
    const same = this.preview.filter((s) => s.resource === sample.resource).length
    if (same < SAMPLES_PER_RESOURCE) this.preview.push(sample)
  }

  issue(issue: Issue) {
    this.issueCount++
    if (this.issueCount <= ISSUE_CAP) this.pendingIssues.push(issue)
  }

  /** Persist progress (throttled unless forced) and any queued issues. */
  async flush(force = false) {
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

export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)
