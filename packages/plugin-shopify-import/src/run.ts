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
import { fetchFiles } from './api-files'
import { stockRefresher } from './api-stock'
import { REQUIRED_SCOPES, type SnapshotUse } from './client'
import { mapLimit } from './concurrency'
import { clientFor } from './connection'
import { parseCustomersCsv } from './csv-customers'
import { parseOrdersCsv } from './csv-orders'
import { parseProductsCsv } from './csv-products'
import { createMediaHost } from './media'
import { createReferenceResolver } from './references'
import {
  errorMessage,
  type ImportContext,
  type InStore,
  Reporter,
  WRITE_BATCH_SIZE,
} from './runtime'
import { IMPORT_RESOURCES, type ImportResource, importIssue, importRun } from './schema'
import {
  fetchArticles,
  fetchCollections,
  fetchCustomers,
  fetchMenus,
  fetchOrders,
  fetchPages,
  fetchProducts,
  fetchRedirects,
} from './shopify-api'
import { type ShopifyClient, ShopifyError } from './shopify-client'
import { cleanupSnapshots, dropSnapshot, freshSnapshot, SnapshotSession } from './snapshot'
import { writeArticle, writeCollection, writeMenu, writePage, writeRedirect } from './write-content'
import { customerSourceId, writeCustomers } from './write-customers'
import { importDiscounts } from './write-discounts'
import { writeFile } from './write-files'
import { importGiftCards } from './write-gift-cards'
import { importMetafields } from './write-metafields'
import { importMetaobjects } from './write-metaobjects'
import { orderSourceId, writeOrders } from './write-orders'
import { productSourceId, writeProducts } from './write-products'

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

/** Records per write batch: products are heavy (images, variants), customers light. */
const PRODUCT_BATCH = 25
const ORDER_BATCH = 100
/** How often a running import touches its row (see RUN_STALE_MS in service.ts). */
const HEARTBEAT_MS = 60_000

/** Regroup a reader's pages into batches of `size` for the batched writers. */
async function* rebatch<T>(source: AsyncGenerator<T[]>, size: number): AsyncGenerator<T[]> {
  let pending: T[] = []
  for await (const page of source) {
    pending.push(...page)
    while (pending.length >= size) {
      yield pending.slice(0, size)
      pending = pending.slice(size)
    }
  }
  if (pending.length) yield pending
}

/**
 * `concurrency` > 1 runs a batch's writes with `mapLimit` instead of one at a
 * time. Safe for any resource whose writes are independent: `Reporter.count`/
 * `issue`/`sample` are plain synchronous methods (no `await` inside), so
 * however these calls interleave across concurrent writers, each one runs to
 * completion before the next gets a turn on the event loop — no locking
 * needed.
 */
async function forEachBatch<T>(
  ctx: ImportContext,
  resource: ImportResource,
  source: AsyncGenerator<T[]>,
  write: (item: T) => Promise<unknown>,
  concurrency = 1,
) {
  ctx.report.begin(resource)
  for await (const batch of source) {
    ctx.report.addTotal(resource, batch.length)
    if (concurrency > 1) {
      await mapLimit(batch, concurrency, async (item) => {
        await write(item)
        await ctx.report.flush()
      })
    } else {
      for (const item of batch) {
        await write(item)
        await ctx.report.flush()
      }
    }
    await ctx.report.flush()
  }
}

/** Like `forEachBatch`, but hands whole batches to a batched writer (`writeBatch` in runtime). */
async function forEachChunk<T>(
  ctx: ImportContext,
  resource: ImportResource,
  source: AsyncGenerator<T[]>,
  size: number,
  write: (items: T[]) => Promise<void>,
) {
  ctx.report.begin(resource)
  for await (const chunk of rebatch(source, size)) {
    ctx.report.addTotal(resource, chunk.length)
    await write(chunk)
    await ctx.report.flush()
  }
}

async function* chunksOf<T>(items: T[]): AsyncGenerator<T[]> {
  yield items
}

async function runCsv(ctx: ImportContext, deps: RunDeps, resource: ImportResource, key: string) {
  const provider = await deps.storage()
  const bytes = await provider.get(key)
  if (!bytes) throw new Error('The uploaded file is no longer available. Upload it again.')
  const text = new TextDecoder().decode(bytes)
  const cache = new Map<string, string>()
  if (resource === 'products') {
    const { products, issues } = parseProductsCsv(text)
    ctx.report.begin(resource)
    for (const i of issues) ctx.report.issue(i)
    await forEachChunk(ctx, 'products', chunksOf(products), PRODUCT_BATCH, (b) =>
      writeProducts(ctx, b),
    )
  } else if (resource === 'customers') {
    const { customers, issues } = parseCustomersCsv(text)
    ctx.report.begin(resource)
    for (const i of issues) ctx.report.issue(i)
    await forEachChunk(ctx, 'customers', chunksOf(customers), WRITE_BATCH_SIZE, (b) =>
      writeCustomers(ctx, b),
    )
  } else if (resource === 'orders') {
    const { orders, issues } = parseOrdersCsv(text)
    ctx.report.begin(resource)
    for (const i of issues) ctx.report.issue(i)
    await forEachChunk(ctx, 'orders', chunksOf(orders), ORDER_BATCH, (b) =>
      writeOrders(ctx, b, cache),
    )
  } else {
    throw new Error(`Shopify has no ${resource} CSV export`)
  }
}

async function runApi(
  ctx: ImportContext,
  client: ShopifyClient,
  resources: ImportResource[],
  snap: SnapshotSession,
) {
  const wanted = (r: ImportResource) => resources.includes(r)
  const cache = new Map<string, string>()
  const onBulkFallback = (reason: unknown) =>
    ctx.log(`Shopify bulk read fell back to paged fetching: ${errorMessage(reason)}`)
  const byHandle = (item: { sourceId: string | null; handle: string }) =>
    item.sourceId ?? `handle:${item.handle}`
  // Products before collections (membership) and orders (line matching); customers before orders.
  if (wanted('products')) {
    ctx.log('Asking Shopify to prepare your products…')
    const products = snap.read({
      resource: 'products',
      idOf: productSourceId,
      full: () => fetchProducts(client, onBulkFallback),
      delta: (search) => fetchProducts(client, onBulkFallback, search),
      // Stock changes do not move a product's update time; read it fresh.
      refresher: () => stockRefresher(client),
    })
    await forEachChunk(ctx, 'products', products, PRODUCT_BATCH, (b) => writeProducts(ctx, b))
  }
  if (wanted('collections')) {
    const collections = snap.read({
      resource: 'collections',
      idOf: byHandle,
      full: () => fetchCollections(client),
      delta: (search) => fetchCollections(client, search),
    })
    await forEachBatch(ctx, 'collections', collections, (c) => writeCollection(ctx, c))
  }
  if (wanted('customers')) {
    ctx.log('Asking Shopify to prepare your customers…')
    const customers = snap.read({
      resource: 'customers',
      idOf: customerSourceId,
      full: () => fetchCustomers(client, onBulkFallback),
      delta: (search) => fetchCustomers(client, onBulkFallback, search),
    })
    await forEachChunk(ctx, 'customers', customers, WRITE_BATCH_SIZE, (b) => writeCustomers(ctx, b))
  }
  if (wanted('orders')) {
    ctx.log('Asking Shopify to prepare your orders…')
    const orders = snap.read({
      resource: 'orders',
      idOf: orderSourceId,
      full: () => fetchOrders(client, onBulkFallback),
      delta: (search) => fetchOrders(client, onBulkFallback, search),
    })
    await forEachChunk(ctx, 'orders', orders, ORDER_BATCH, (b) => writeOrders(ctx, b, cache))
  }
  if (wanted('pages')) {
    const pages = snap.read({
      resource: 'pages',
      idOf: byHandle,
      full: () => fetchPages(client),
      delta: (search) => fetchPages(client, search),
    })
    await forEachBatch(ctx, 'pages', pages, (p) => writePage(ctx, p))
  }
  if (wanted('articles')) {
    const articles = snap.read({
      resource: 'articles',
      idOf: (a) => a.sourceId ?? `handle:${a.blogHandle}/${a.handle}`,
      full: () => fetchArticles(client),
      delta: (search) => fetchArticles(client, search),
    })
    await forEachBatch(ctx, 'articles', articles, (a) => writeArticle(ctx, a))
  }
  if (wanted('menus'))
    await forEachBatch(ctx, 'menus', fetchMenus(client), (m) => writeMenu(ctx, m))
  if (wanted('redirects'))
    await forEachBatch(ctx, 'redirects', fetchRedirects(client), (r) => writeRedirect(ctx, r))

  // Files before entries and extra fields (they link to files); entries before extra fields
  // (those link to entries); products and collections before discounts; customers before gift cards.
  const resolver = createReferenceResolver(ctx, client)
  if (wanted('files')) {
    const files = snap.read({
      resource: 'files',
      idOf: (f) => f.sourceId,
      full: () => fetchFiles(client),
      delta: (search) => fetchFiles(client, search),
    })
    await optional(ctx, 'files', () =>
      forEachBatch(ctx, 'files', files, (f) => writeFile(ctx, f), 3),
    )
  }
  if (wanted('metaobjects'))
    await optional(ctx, 'metaobjects', () => importMetaobjects(ctx, client, resolver))
  if (wanted('metafields'))
    await optional(ctx, 'metafields', () => importMetafields(ctx, client, resolver, onBulkFallback))
  if (wanted('discounts')) await optional(ctx, 'discounts', () => importDiscounts(ctx, client))
  if (wanted('gift_cards')) await optional(ctx, 'gift_cards', () => importGiftCards(ctx, client))
}

/**
 * The newer resources need scopes an older connection may lack (and Shopify
 * keeps gift cards from some plans). A refused scope ends that resource with a
 * plain reason instead of stopping everything else.
 */
async function optional(ctx: ImportContext, resource: ImportResource, run: () => Promise<void>) {
  try {
    await run()
  } catch (err) {
    if (!(err instanceof ShopifyError) || err.kind !== 'scope') throw err
    ctx.report.begin(resource)
    ctx.report.issue({
      resource,
      message: `Shopify did not allow reading this (${REQUIRED_SCOPES[resource]}). Add the scope to your Shopify app, then run the import again. ${err.message}`,
    })
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
      await runCsv(ctx, deps, resource, run.fileKey)
    } else {
      const client = await deps.inStore((tx) =>
        clientFor(tx, deps.settingsSecret, {
          inStore: deps.inStore,
          ...(deps.fetch ? { fetch: deps.fetch } : {}),
          ...(deps.sleep ? { sleep: deps.sleep } : {}),
        }),
      )
      if (!client) throw new Error('Connect your Shopify store first')
      await runApi(ctx, client, resources, snap)
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
    // The import is done with the preview's copy (used or too old): delete it.
    if (!run.dryRun && run.snapshot) {
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
