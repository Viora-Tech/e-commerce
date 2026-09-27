/**
 * Execute one import run inside the worker: read the source (the uploaded CSV
 * or the Admin API), then write, or only count and sample on a dry run.
 */
import type { StorageProvider } from '@commerce/storage'
import { eq } from 'drizzle-orm'
import { mapLimit } from './concurrency'
import { clientFor } from './connection'
import { parseCustomersCsv } from './csv-customers'
import { parseOrdersCsv } from './csv-orders'
import { parseProductsCsv } from './csv-products'
import { createMediaHost } from './media'
import { errorMessage, type ImportContext, type InStore, Reporter } from './runtime'
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
import type { ShopifyClient } from './shopify-client'
import { writeArticle, writeCollection, writeMenu, writePage, writeRedirect } from './write-content'
import { writeCustomer } from './write-customers'
import { writeOrder } from './write-orders'
import { writeProduct } from './write-products'

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
  sleep?: (ms: number) => Promise<void>
}

/**
 * `concurrency` > 1 runs a batch's writes with `mapLimit` instead of one at a
 * time. Safe for any resource whose writes are independent: `Reporter.count`/
 * `issue`/`sample` are plain synchronous methods (no `await` inside), so
 * however these calls interleave across concurrent writers, each one runs to
 * completion before the next gets a turn on the event loop — no locking
 * needed. Orders stay sequential (`concurrency` left at 1): they resolve or
 * create customers through a shared cache that a race could double-insert.
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

async function runCsv(ctx: ImportContext, deps: RunDeps, resource: ImportResource, key: string) {
  const provider = await deps.storage()
  const bytes = await provider.get(key)
  if (!bytes) throw new Error('The uploaded file is no longer available. Upload it again.')
  const text = new TextDecoder().decode(bytes)
  const cache = new Map<string, string>()
  ctx.report.begin(resource)
  if (resource === 'products') {
    const { products, issues } = parseProductsCsv(text)
    for (const i of issues) ctx.report.issue(i)
    ctx.report.setTotal('products', products.length)
    for (const p of products) {
      await writeProduct(ctx, p)
      await ctx.report.flush()
    }
  } else if (resource === 'customers') {
    const { customers, issues } = parseCustomersCsv(text)
    for (const i of issues) ctx.report.issue(i)
    ctx.report.setTotal('customers', customers.length)
    for (const c of customers) {
      await writeCustomer(ctx, c)
      await ctx.report.flush()
    }
  } else if (resource === 'orders') {
    const { orders, issues } = parseOrdersCsv(text)
    for (const i of issues) ctx.report.issue(i)
    ctx.report.setTotal('orders', orders.length)
    for (const o of orders) {
      await writeOrder(ctx, o, cache)
      await ctx.report.flush()
    }
  } else {
    throw new Error(`Shopify has no ${resource} CSV export`)
  }
}

async function runApi(ctx: ImportContext, client: ShopifyClient, resources: ImportResource[]) {
  const wanted = (r: ImportResource) => resources.includes(r)
  const cache = new Map<string, string>()
  const onBulkFallback = (reason: unknown) =>
    ctx.log(`Shopify bulk read fell back to paged fetching: ${errorMessage(reason)}`)
  // Products before collections (membership) and orders (line matching); customers before orders.
  // Products and customers write 3/4 at a time (independent rows); orders stay sequential.
  if (wanted('products')) {
    ctx.log('Asking Shopify to prepare your products…')
    await forEachBatch(
      ctx,
      'products',
      fetchProducts(client, onBulkFallback),
      (p) => writeProduct(ctx, p),
      3,
    )
  }
  if (wanted('collections'))
    await forEachBatch(ctx, 'collections', fetchCollections(client), (c) => writeCollection(ctx, c))
  if (wanted('customers')) {
    ctx.log('Asking Shopify to prepare your customers…')
    await forEachBatch(
      ctx,
      'customers',
      fetchCustomers(client, onBulkFallback),
      (c) => writeCustomer(ctx, c),
      4,
    )
  }
  if (wanted('orders')) {
    ctx.log('Asking Shopify to prepare your orders…')
    await forEachBatch(ctx, 'orders', fetchOrders(client, onBulkFallback), (o) =>
      writeOrder(ctx, o, cache),
    )
  }
  if (wanted('pages'))
    await forEachBatch(ctx, 'pages', fetchPages(client), (p) => writePage(ctx, p))
  if (wanted('articles'))
    await forEachBatch(ctx, 'articles', fetchArticles(client), (a) => writeArticle(ctx, a))
  if (wanted('menus'))
    await forEachBatch(ctx, 'menus', fetchMenus(client), (m) => writeMenu(ctx, m))
  if (wanted('redirects'))
    await forEachBatch(ctx, 'redirects', fetchRedirects(client), (r) => writeRedirect(ctx, r))
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
  const [run] = await deps.inStore((tx) =>
    tx.select().from(importRun).where(eq(importRun.id, runId)),
  )
  if (!run) return
  await deps.inStore(async (tx) => {
    await tx.delete(importIssue).where(eq(importIssue.runId, runId))
    await tx
      .update(importRun)
      .set({
        status: 'running',
        progress: {},
        preview: [],
        error: null,
        startedAt: new Date(),
        finishedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(importRun.id, runId))
  })
  const report = new Reporter(deps.inStore, deps.storeId, runId)
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
      await runApi(ctx, client, resources)
    }
    await report.flush(true)
    await deps.inStore((tx) =>
      tx
        .update(importRun)
        .set({ status: 'completed', finishedAt: new Date(), updatedAt: new Date() })
        .where(eq(importRun.id, runId)),
    )
    deps.log(`${run.dryRun ? 'previewed' : 'imported'} ${resources.join(', ')}`)
  } catch (err) {
    await report.flush(true).catch(() => {})
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
  }
}
