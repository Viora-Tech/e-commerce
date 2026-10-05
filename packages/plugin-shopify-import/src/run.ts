/**
 * Execute one import run inside the worker: read the source (the uploaded CSV
 * or the Admin API), then write, or only count and sample on a dry run.
 *
 * An API preview keeps what it read (`snapshot.ts`); the import that follows
 * within 24 hours reads that copy plus only what Shopify changed since, then
 * deletes it.
 */
import type { LookupAll } from '@commerce/core/safe-fetch'
import type { StorageProvider } from '@commerce/storage'
import { and, eq } from 'drizzle-orm'
import type { SnapshotUse } from './client'
import { clientFor } from './connection'
import { createMediaHost } from './media'
import { type Only, runApi, runCsv } from './read-write'
import { errorMessage, type ImportContext, type InStore, Reporter } from './runtime'
import { IMPORT_RESOURCES, type ImportResource, importIssue, importRun } from './schema'
import { retryTargets } from './service'
import { cleanupSnapshots, dropSnapshot, freshSnapshot, SnapshotSession } from './snapshot'
import { remainingFilter } from './status'

export type RunDeps = {
  storeId: string
  inStore: InStore
  storage: () => Promise<StorageProvider>
  settingsSecret: string
  log: (message: string) => void
  /**
   * Queues a hosted image for the media pipeline (`ctx.processMedia` in the
   * worker). Throws when the queue is unreachable; see `queueImportedMedia`.
   */
  processMedia?: ((mediaId: string) => Promise<void>) | undefined
  /** Injected in tests: Shopify API and image downloads. */
  fetch?: typeof fetch
  /** Injected in tests: DNS for the image-download SSRF check. */
  lookup?: LookupAll
  sleep?: (ms: number) => Promise<void>
  /** Injected in tests: the clock snapshots are dated and aged by. */
  now?: () => Date
}

/** How often a running import touches its row (see RUN_STALE_MS in service.ts). */
const HEARTBEAT_MS = 60_000

/** Resources whose import copies images or files into the store's storage. */
const MEDIA_RESOURCES: readonly ImportResource[] = [
  'products',
  'collections',
  'articles',
  'files',
  'metaobjects',
  'metafields',
]

/** Write and delete a tiny private file; the reason when storage refuses, else null. */
async function probeStorage(deps: RunDeps, runId: string): Promise<string | null> {
  const key = `stores/${deps.storeId}/private/imports/${runId}/write-test.txt`
  try {
    const provider = await deps.storage()
    await provider.put({ key, body: new TextEncoder().encode('ok'), contentType: 'text/plain' })
    await provider.delete(key)
    return null
  } catch (err) {
    return errorMessage(err).slice(0, 300)
  }
}

/**
 * `onMediaImported` for a real (not dry) run: queue each newly hosted image
 * for processing. The media host only calls it the first time a source is
 * hosted and the job id is the media id, so a re-run never queues twice. A
 * queue failure never fails the row: it becomes an issue on the resource
 * being imported, and the image stays `processing` for `bun run
 * media:reprocess`.
 */
function queueImportedMedia(
  report: Reporter,
  processMedia: (mediaId: string) => Promise<void>,
): (mediaId: string, contentType: string, src: string) => Promise<void> {
  return async (mediaId, _contentType, src) => {
    try {
      await processMedia(mediaId)
    } catch (err) {
      report.issue({
        resource: report.current ?? 'products',
        ref: src,
        message: `Image ${src} was copied but not queued for optimising (${errorMessage(err)}). It stays as uploaded until media is reprocessed.`,
      })
    }
  }
}

/**
 * Run (or re-run) one import. Never throws for a problem with the data: the
 * run ends `failed` with the reason and the merchant starts it again, which
 * is safe because every write matches on the import mapping first.
 */
export async function executeRun(deps: RunDeps, runId: string): Promise<void> {
  const now = deps.now ?? (() => new Date())
  const [run] = await deps.inStore((tx) =>
    tx.select().from(importRun).where(eq(importRun.id, runId)),
  )
  if (!run) return
  const files = { inStore: deps.inStore, storage: deps.storage }
  // Housekeeping first: this store's week-old snapshots, and a preview's previous copy.
  await cleanupSnapshots(files, now()).catch((err) =>
    deps.log(`snapshot cleanup failed: ${errorMessage(err)}`),
  )
  if (run.dryRun && run.snapshot) {
    await dropSnapshot(files, runId, run.snapshot).catch(() => {})
  }
  const reuse =
    !run.dryRun && run.mode === 'api' ? freshSnapshot(run.snapshot, now().getTime()) : null
  // A retry imports only what the run it retries reported problems for.
  const retryOf = run.retryOf
  const only: Only = retryOf
    ? { ids: await deps.inStore((tx) => retryTargets(tx, retryOf)) }
    : run.onlyMissing
      ? { keep: await deps.inStore((tx) => remainingFilter(tx, run.resources)) }
      : null
  await deps.inStore(async (tx) => {
    await tx.delete(importIssue).where(eq(importIssue.runId, runId))
    await tx
      .update(importRun)
      .set({
        status: 'running',
        progress: {},
        preview: [],
        error: null,
        snapshotUse: null,
        startedAt: new Date(),
        finishedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(importRun.id, runId))
  })
  const report = new Reporter(deps.inStore, deps.storeId, runId)
  const saveUse = (use: SnapshotUse) =>
    deps.inStore(async (tx) => {
      await tx.update(importRun).set({ snapshotUse: use }).where(eq(importRun.id, runId))
    })
  const snap = new SnapshotSession({
    storeId: deps.storeId,
    runId,
    storage: deps.storage,
    log: deps.log,
    mode:
      run.mode !== 'api'
        ? { kind: 'off' }
        : run.dryRun
          ? { kind: 'record', takenAt: now() }
          : reuse
            ? { kind: 'reuse', snapshot: reuse }
            : { kind: 'off' },
    onReuse: saveUse,
  })
  const ctx: ImportContext = {
    storeId: deps.storeId,
    runId,
    dryRun: run.dryRun,
    inStore: deps.inStore,
    media: createMediaHost({
      storeId: deps.storeId,
      inStore: deps.inStore,
      storage: deps.storage,
      ...(deps.fetch ? { fetch: deps.fetch } : {}),
      ...(deps.lookup ? { lookup: deps.lookup } : {}),
      // A dry run never hosts media (writers return before downloading); no queue either way.
      ...(deps.processMedia && !run.dryRun
        ? { onMediaImported: queueImportedMedia(report, deps.processMedia) }
        : {}),
    }),
    report,
    log: deps.log,
    secret: deps.settingsSecret,
  }
  const resources = IMPORT_RESOURCES.filter((r) => run.resources.includes(r))
  // One write test before copying anything: a broken storage (no bucket connected, the
  // local folder not writable in a container) is one plain issue, not one per image.
  const withMedia = resources.find((r) => MEDIA_RESOURCES.includes(r))
  if (!run.dryRun && withMedia) {
    const broken = await probeStorage(deps, runId)
    if (broken) {
      ctx.mediaOff = broken
      ctx.media = { host: async () => null, urlOf: async () => null }
      report.issue({
        resource: withMedia,
        message: `Storage isn't writable: ${broken}. Images and files were skipped. Connect Cloudflare R2 or Amazon S3, then retry.`,
      })
      deps.log(`storage not writable, media skipped: ${broken}`)
    }
  }
  // Proof of life while Shopify prepares an export and nothing else touches the row; a
  // run silent for RUN_STALE_MS lost its worker and is failed by the next read (service.ts).
  const heartbeat = setInterval(() => {
    deps
      .inStore((tx) =>
        tx
          .update(importRun)
          .set({ updatedAt: new Date() })
          .where(and(eq(importRun.id, runId), eq(importRun.status, 'running'))),
      )
      .catch(() => {})
  }, HEARTBEAT_MS)
  heartbeat.unref?.()
  try {
    if (run.mode === 'csv') {
      const resource = resources[0]
      if (!resource || !run.fileKey) throw new Error('This import has no file')
      await runCsv(ctx, deps.storage, resource, run.fileKey, only)
    } else {
      const client = await deps.inStore((tx) =>
        clientFor(tx, deps.settingsSecret, {
          inStore: deps.inStore,
          ...(deps.fetch ? { fetch: deps.fetch } : {}),
          ...(deps.sleep ? { sleep: deps.sleep } : {}),
        }),
      )
      if (!client) throw new Error('Connect your Shopify store first')
      await runApi(ctx, client, resources, snap, only)
    }
    await report.flush(true)
    const takenAt = snap.takenAt
    const keep = run.dryRun && takenAt && Object.keys(snap.recorded).length > 0
    await deps.inStore((tx) =>
      tx
        .update(importRun)
        .set({
          status: 'completed',
          finishedAt: new Date(),
          updatedAt: new Date(),
          snapshotUse: snap.use,
          ...(keep
            ? {
                snapshot: { takenAt, streams: snap.recorded },
                snapshotTakenAt: new Date(takenAt),
              }
            : {}),
        })
        .where(eq(importRun.id, runId)),
    )
    // The import is done with the preview's copy: delete it, unless something was missed and a
    // retry can still read it (it moves to the retry run; the 7-day cleanup takes the rest).
    if (!run.dryRun && run.snapshot && (report.retryable === 0 || !reuse)) {
      await dropSnapshot(files, runId, run.snapshot).catch((err) =>
        deps.log(`could not delete the preview copy: ${errorMessage(err)}`),
      )
    }
    deps.log(`${run.dryRun ? 'previewed' : 'imported'} ${resources.join(', ')}`)
  } catch (err) {
    await report.flush(true).catch(() => {})
    // A failed preview keeps nothing; a failed import keeps the preview's copy for Try again.
    if (run.dryRun) {
      await dropSnapshot(files, runId, { takenAt: '', streams: snap.recorded }).catch(() => {})
    }
    await deps.inStore((tx) =>
      tx
        .update(importRun)
        .set({
          status: 'failed',
          error: errorMessage(err).slice(0, 1000),
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(importRun.id, runId)),
    )
    deps.log(`run ${runId} failed: ${errorMessage(err)}`)
  } finally {
    clearInterval(heartbeat)
  }
}
