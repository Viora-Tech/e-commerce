/**
 * Execute one import run inside the worker: read the source (the uploaded CSV
 * or the Admin API), then write, or only count and sample on a dry run.
 *
 * An API preview keeps what it read (`snapshot.ts`); the import that follows
 * within 24 hours reads that copy plus only what Shopify changed since, then
 * deletes it.
 */
import { CommerceError } from '@commerce/core'
import type { LookupAll } from '@commerce/core/safe-fetch'
import type { StorageProvider } from '@commerce/storage'
import { and, eq, isNotNull, ne } from 'drizzle-orm'
import type { SnapshotUse } from './client'
import { clientFor } from './connection'
import { FileUsage } from './file-usage'
import { createMediaHost, type MediaHostOptions } from './media'
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
  /** Overrides the image/file copy deadlines and retries (tests). */
  copy?: Pick<MediaHostOptions, 'timeoutMs' | 'largeTimeoutMs' | 'idleTimeoutMs' | 'retries'>
  /** Overrides `STUCK_MS` (tests). */
  stuckMs?: number
  /** Overrides `HEARTBEAT_MS` (tests). */
  heartbeatMs?: number
  /** Overrides `STOP_POLL_MS` (tests). */
  stopPollMs?: number
}

/** How often a running import touches its row (see RUN_STALE_MS in service.ts). */
const HEARTBEAT_MS = 60_000

/**
 * A run where nothing moved for this long (no record written, no issue, no byte of a
 * copy, no answer from Shopify) is stuck: it is stopped and marked failed. Every copy
 * attempt ends within a minute without data, and Shopify is polled every few seconds
 * while it prepares an export, so a live run never comes near this.
 */
const STUCK_MS = 10 * 60_000

/** How often a running import checks whether Stop import was pressed. */
const STOP_POLL_MS = 3000

/** Stop import was pressed: the run ends `cancelled`, not failed. */
class RunStopped extends CommerceError {
  constructor() {
    super('IMPORT_STOPPED', 'The import was stopped')
  }
}

/** The watchdog's reason, shown to the merchant on the run. */
class RunStuck extends CommerceError {
  constructor(ms: number) {
    const minutes = Math.max(1, Math.round(ms / 60_000))
    super(
      'IMPORT_STUCK',
      `The import stopped moving: nothing was downloaded, copied or saved for ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}. Press Try again: it carries on from where it was without duplicating anything.`,
    )
  }
}

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
  // Stopped while it waited, or marked stopped because this worker never answered: drop the job.
  if (run.status === 'cancelled') {
    deps.log(`run ${runId} was stopped; nothing to do`)
    return
  }
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
  const started = await deps.inStore(async (tx) => {
    // Not a run stopped a moment ago, while this job was picking it up.
    const rows = await tx
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
      .where(and(eq(importRun.id, runId), ne(importRun.status, 'cancelled')))
      .returning({ id: importRun.id })
    if (rows.length === 0) return false
    await tx.delete(importIssue).where(eq(importIssue.runId, runId))
    return true
  })
  if (!started) return
  const report = new Reporter(deps.inStore, deps.storeId, runId)
  // Aborted by the watchdog (or when the run ends): every copy still in flight stops.
  const stop = new AbortController()
  const stopped = new Promise<never>((_, reject) => {
    stop.signal.addEventListener('abort', () => reject(stop.signal.reason), { once: true })
  })
  stopped.catch(() => {})
  // Shopify answering (a page, a bulk-export poll) is the run getting somewhere.
  const baseFetch = deps.fetch ?? fetch
  const shopifyFetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const res = await baseFetch(input, init)
    report.touch()
    return res
  }) as typeof fetch
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
    includeUnusedFiles: run.includeUnusedFiles,
    fileUsage: new FileUsage(),
    inStore: deps.inStore,
    media: createMediaHost({
      storeId: deps.storeId,
      inStore: deps.inStore,
      storage: deps.storage,
      ...(deps.fetch ? { fetch: deps.fetch } : {}),
      ...(deps.lookup ? { lookup: deps.lookup } : {}),
      ...(deps.sleep ? { sleep: deps.sleep } : {}),
      ...deps.copy,
      signal: stop.signal,
      onActivity: () => report.touch(),
      onSettled: (ok) => {
        report.copySettled(ok)
        // Progress moves per copy, not only once a whole batch of records is written.
        report.flush().catch(() => {})
      },
      // A dry run never hosts media (writers return before downloading); no queue either way.
      ...(deps.processMedia && !run.dryRun
        ? { onMediaImported: queueImportedMedia(report, deps.processMedia) }
        : {}),
    }),
    report,
    log: deps.log,
    secret: deps.settingsSecret,
    signal: stop.signal,
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
  // Watchdog and proof of life. While the run is getting somewhere (`report.lastActivity`)
  // it touches its row, so a run whose worker died (silent for RUN_STALE_MS) is failed by
  // the next read (service.ts). One where nothing moved for STUCK_MS is stopped here, and
  // its row is no longer touched, so the backstop fires even if stopping it fails.
  const stuckMs = deps.stuckMs ?? STUCK_MS
  const heartbeat = setInterval(() => {
    if (Date.now() - report.lastActivity >= stuckMs) {
      if (!stop.signal.aborted) {
        deps.log(`run ${runId}: nothing moved for ${stuckMs} ms, stopping it`)
        stop.abort(new RunStuck(stuckMs))
      }
      return
    }
    deps
      .inStore((tx) =>
        tx
          .update(importRun)
          .set({ updatedAt: new Date() })
          .where(and(eq(importRun.id, runId), eq(importRun.status, 'running'))),
      )
      .catch(() => {})
  }, deps.heartbeatMs ?? HEARTBEAT_MS)
  heartbeat.unref?.()
  // Stop import: the API sets `stop_requested_at`; between records and copies the
  // run sees the abort and ends within seconds.
  const stopPoll = setInterval(() => {
    deps
      .inStore((tx) =>
        tx
          .select({ id: importRun.id })
          .from(importRun)
          .where(and(eq(importRun.id, runId), isNotNull(importRun.stopRequestedAt))),
      )
      .then((rows) => {
        if (rows.length > 0 && !stop.signal.aborted) {
          deps.log(`run ${runId}: stop requested, stopping`)
          stop.abort(new RunStopped())
        }
      })
      .catch(() => {})
  }, deps.stopPollMs ?? STOP_POLL_MS)
  stopPoll.unref?.()
  const work = async () => {
    if (run.mode === 'csv') {
      const resource = resources[0]
      if (!resource || !run.fileKey) throw new Error('This import has no file')
      await runCsv(ctx, deps.storage, resource, run.fileKey, only)
    } else {
      const client = await deps.inStore((tx) =>
        clientFor(tx, deps.settingsSecret, {
          inStore: deps.inStore,
          fetch: shopifyFetch,
          ...(deps.sleep ? { sleep: deps.sleep } : {}),
        }),
      )
      if (!client) throw new Error('Connect your Shopify store first')
      await runApi(ctx, client, resources, snap, only)
    }
  }
  try {
    const running = work()
    // Stopped by the watchdog, the work may still be unwinding; nobody waits for it.
    running.catch(() => {})
    await Promise.race([running, stopped])
    await report.flush(true)
    report.close()
    const takenAt = snap.takenAt
    const keep = run.dryRun && takenAt && Object.keys(snap.recorded).length > 0
    // Only a run still running: one marked stopped meanwhile stays stopped.
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
        .where(and(eq(importRun.id, runId), eq(importRun.status, 'running'))),
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
    report.close()
    // A failed preview keeps nothing; a failed import keeps the preview's copy for Try again.
    if (run.dryRun) {
      await dropSnapshot(files, runId, { takenAt: '', streams: snap.recorded }).catch(() => {})
    }
    const stopped = stop.signal.reason instanceof RunStopped
    await deps.inStore((tx) =>
      tx
        .update(importRun)
        .set(
          stopped
            ? { status: 'cancelled', finishedAt: new Date(), updatedAt: new Date() }
            : {
                status: 'failed',
                error: errorMessage(err).slice(0, 1000),
                finishedAt: new Date(),
                updatedAt: new Date(),
              },
        )
        .where(and(eq(importRun.id, runId), eq(importRun.status, 'running'))),
    )
    deps.log(`run ${runId} ${stopped ? 'stopped' : `failed: ${errorMessage(err)}`}`)
  } finally {
    clearInterval(heartbeat)
    clearInterval(stopPoll)
    // Anything a failed step left copying stops now rather than running on unseen.
    if (!stop.signal.aborted) stop.abort(new Error('the import ended'))
  }
}
