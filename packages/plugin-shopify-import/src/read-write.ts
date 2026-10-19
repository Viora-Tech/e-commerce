/**
 * Read each resource (the uploaded CSV, or the Admin API through the preview's
 * snapshot) and hand it to its writer in the right order. On a retry only the
 * records the previous import missed are read and written.
 */
import type { StorageProvider } from '@commerce/storage'
import { fetchFiles } from './api-files'
import { stockRefresher } from './api-stock'
import { REQUIRED_SCOPES } from './client'
import { mapLimit } from './concurrency'
import { parseCustomersCsv } from './csv-customers'
import { parseOrdersCsv } from './csv-orders'
import { parseProductsCsv } from './csv-products'
import { FilesTally } from './file-usage'
import { createReferenceResolver } from './references'
import { errorMessage, type ImportContext, WRITE_BATCH_SIZE } from './runtime'
import type { ImportResource } from './schema'
import {
  fetchArticles,
  fetchCollections,
  fetchCustomers,
  fetchMenus,
  fetchOrders,
  fetchPages,
  fetchPreorderProductIds,
  fetchProducts,
  fetchRedirects,
} from './shopify-api'
import { type ShopifyClient, ShopifyError } from './shopify-client'
import type { ReadSpec, SnapshotSession } from './snapshot'
import type { KeepTest } from './status'
import type {
  Issue,
  NArticle,
  NCollection,
  NCustomer,
  NFile,
  NMenu,
  NOrder,
  NPage,
  NProduct,
  NRedirect,
} from './types'
import {
  redirectSourceId,
  writeArticle,
  writeCollection,
  writeMenu,
  writePage,
  writeRedirect,
} from './write-content'
import { customerSourceId, writeCustomers } from './write-customers'
import { importDiscounts } from './write-discounts'
import { type FilesPlan, writeFile } from './write-files'
import { importGiftCards } from './write-gift-cards'
import { importMetafields } from './write-metafields'
import { importMetaobjects } from './write-metaobjects'
import { orderSourceId, writeOrders } from './write-orders'
import { applyPreorders, productSourceId, writeProducts } from './write-products'

/** Records per write batch: products are heavy (images, variants), customers light. */
const PRODUCT_BATCH = 25
const ORDER_BATCH = 100
/** Files copied at once; the media host's shared cap (MEDIA_IN_FLIGHT) bounds memory across steps. */
const FILE_CONCURRENCY = 12

/** Resources whose records say which Files are used. */
const USAGE_RESOURCES: ImportResource[] = ['products', 'collections', 'pages', 'articles']

/** Passes a reader's pages on unchanged, noting each record on the way. */
async function* noting<T>(
  source: AsyncGenerator<T[]>,
  note: (item: T) => void,
): AsyncGenerator<T[]> {
  for await (const page of source) {
    for (const item of page) note(item)
    yield page
  }
}

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
    ctx.signal?.throwIfAborted()
    ctx.report.addTotal(resource, batch.length)
    await ctx.report.flush()
    if (concurrency > 1) {
      await mapLimit(batch, concurrency, async (item) => {
        ctx.signal?.throwIfAborted()
        await write(item)
        await ctx.report.flush()
      })
    } else {
      for (const item of batch) {
        ctx.signal?.throwIfAborted()
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
    // Stop import: nothing more is written once it was asked for.
    ctx.signal?.throwIfAborted()
    ctx.report.addTotal(resource, chunk.length)
    // Show the step and its total before the batch's copies start, not only after it is written.
    await ctx.report.flush()
    await write(chunk)
    await ctx.report.flush()
  }
}

async function* chunksOf<T>(items: T[]): AsyncGenerator<T[]> {
  yield items
}

/**
 * Which records a narrowed run writes; null writes everything.
 * - A retry knows the keys of what the previous import missed (`ids`), so it reads just those.
 * - "Import remaining" tests each record (`keep`): not imported yet, or with an open problem.
 */
export type Only = {
  ids?: Map<ImportResource, Set<string>> | undefined
  keep?: KeepTest | undefined
} | null

/** The test for one resource's import keys (and the record, when it has one), or null to keep everything. */
function wants(
  only: Only,
  resource: ImportResource,
): ((id: string, item?: unknown) => boolean) | null {
  const ids = only?.ids
  if (ids) {
    const set = ids.get(resource)
    return set ? (id) => set.has(id) : () => false
  }
  const test = only?.keep
  return test ? (id, item) => test(resource, id, item) : null
}

/** Keep only the records a narrowed run writes (all of them otherwise). */
function keep<T>(only: Only, resource: ImportResource, idOf: (item: T) => string) {
  const test = wants(only, resource)
  return (items: T[]) => (test ? items.filter((item) => test(idOf(item), item)) : items)
}

async function* filtered<T>(
  source: AsyncGenerator<T[]>,
  pick: (items: T[]) => T[],
): AsyncGenerator<T[]> {
  for await (const batch of source) {
    const kept = pick(batch)
    if (kept.length) yield kept
  }
}

export async function runCsv(
  ctx: ImportContext,
  storage: () => Promise<StorageProvider>,
  resource: ImportResource,
  key: string,
  only: Only,
) {
  const provider = await storage()
  const bytes = await provider.get(key)
  if (!bytes) throw new Error('The uploaded file is no longer available. Upload it again.')
  const text = new TextDecoder().decode(bytes)
  const cache = new Map<string, string>()
  // A retry re-reads the file and takes only the rows it missed; parse problems are not repeated.
  const report = (issues: Issue[]) => {
    if (!only) for (const i of issues) ctx.report.issue(i)
  }
  if (resource === 'products') {
    const { products, issues } = parseProductsCsv(text)
    ctx.report.begin(resource)
    report(issues)
    const rows = keep<NProduct>(only, 'products', productSourceId)(products)
    await forEachChunk(ctx, 'products', chunksOf(rows), PRODUCT_BATCH, (b) => writeProducts(ctx, b))
  } else if (resource === 'customers') {
    const { customers, issues } = parseCustomersCsv(text)
    ctx.report.begin(resource)
    report(issues)
    const rows = keep<NCustomer>(only, 'customers', customerSourceId)(customers)
    await forEachChunk(ctx, 'customers', chunksOf(rows), WRITE_BATCH_SIZE, (b) =>
      writeCustomers(ctx, b),
    )
  } else if (resource === 'orders') {
    const { orders, issues } = parseOrdersCsv(text)
    ctx.report.begin(resource)
    report(issues)
    const rows = keep<NOrder>(only, 'orders', orderSourceId)(orders)
    await forEachChunk(ctx, 'orders', chunksOf(rows), ORDER_BATCH, (b) =>
      writeOrders(ctx, b, cache),
    )
  } else {
    throw new Error(`Shopify has no ${resource} CSV export`)
  }
}

export async function runApi(
  ctx: ImportContext,
  client: ShopifyClient,
  resources: ImportResource[],
  snap: SnapshotSession,
  only: Only,
) {
  // Asked before every step, so a stopped run never starts the next one.
  const wanted = (r: ImportResource) => {
    ctx.signal?.throwIfAborted()
    return resources.includes(r)
  }
  const cache = new Map<string, string>()
  const onBulkFallback = (reason: unknown) =>
    ctx.log(`Shopify bulk read fell back to paged fetching: ${errorMessage(reason)}`)
  const byHandle = (item: { sourceId: string | null; handle: string }) =>
    item.sourceId ?? `handle:${item.handle}`
  /**
   * Everything (with the preview's copy when there is one); on a retry only what was missed;
   * for "Import remaining" everything read, but only what is not here yet written.
   */
  const read = <T>(spec: ReadSpec<T>): AsyncGenerator<T[]> => {
    const ids = only?.ids?.get(spec.resource)
    if (ids) return snap.readSome(spec, ids)
    const pick = keep(only, spec.resource, spec.idOf)
    return only ? filtered(snap.read(spec), pick) : snap.read(spec)
  }
  // Products before collections (membership) and orders (line matching); customers before orders.
  if (wanted('products')) {
    ctx.log('Asking Shopify to prepare your products…')
    const products = read<NProduct>({
      resource: 'products',
      idOf: productSourceId,
      full: () => fetchProducts(client, onBulkFallback),
      delta: (search) => fetchProducts(client, onBulkFallback, search),
      // Stock changes do not move a product's update time; read it fresh.
      refresher: () => stockRefresher(client),
    })
    await forEachChunk(
      ctx,
      'products',
      noting(products, (p) => ctx.fileUsage.product(p)),
      PRODUCT_BATCH,
      (b) => writeProducts(ctx, b),
    )
    await importPreorders(ctx, client)
  }
  if (wanted('collections')) {
    const collections = read<NCollection>({
      resource: 'collections',
      idOf: byHandle,
      full: () => fetchCollections(client),
      delta: (search) => fetchCollections(client, search),
    })
    await forEachBatch(
      ctx,
      'collections',
      noting(collections, (c) => ctx.fileUsage.collection(c)),
      (c) => writeCollection(ctx, c),
    )
  }
  if (wanted('customers')) {
    ctx.log('Asking Shopify to prepare your customers…')
    const customers = read<NCustomer>({
      resource: 'customers',
      idOf: customerSourceId,
      full: () => fetchCustomers(client, onBulkFallback),
      delta: (search) => fetchCustomers(client, onBulkFallback, search),
    })
    await forEachChunk(ctx, 'customers', customers, WRITE_BATCH_SIZE, (b) => writeCustomers(ctx, b))
  }
  if (wanted('orders')) {
    ctx.log('Asking Shopify to prepare your orders…')
    const orders = read<NOrder>({
      resource: 'orders',
      idOf: orderSourceId,
      full: () => fetchOrders(client, onBulkFallback),
      delta: (search) => fetchOrders(client, onBulkFallback, search),
    })
    await forEachChunk(ctx, 'orders', orders, ORDER_BATCH, (b) => writeOrders(ctx, b, cache))
  }
  if (wanted('pages')) {
    const pages = read<NPage>({
      resource: 'pages',
      idOf: byHandle,
      full: () => fetchPages(client),
      delta: (search) => fetchPages(client, search),
    })
    await forEachBatch(
      ctx,
      'pages',
      noting(pages, (p) => ctx.fileUsage.page(p)),
      (p) => writePage(ctx, p),
    )
  }
  if (wanted('articles')) {
    const articles = read<NArticle>({
      resource: 'articles',
      idOf: (a) => a.sourceId ?? `handle:${a.blogHandle}/${a.handle}`,
      full: () => fetchArticles(client),
      delta: (search) => fetchArticles(client, search),
    })
    await forEachBatch(
      ctx,
      'articles',
      noting(articles, (a) => ctx.fileUsage.article(a)),
      (a) => writeArticle(ctx, a),
    )
  }
  // No update or id filter for these: read them all, keep what a retry asks for.
  if (wanted('menus')) {
    const menus = filtered(fetchMenus(client), keep<NMenu>(only, 'menus', byHandle))
    await forEachBatch(ctx, 'menus', menus, (m) => writeMenu(ctx, m))
  }
  if (wanted('redirects')) {
    const redirects = filtered(
      fetchRedirects(client),
      keep<NRedirect>(only, 'redirects', redirectSourceId),
    )
    await forEachBatch(ctx, 'redirects', redirects, (r) => writeRedirect(ctx, r))
  }

  // Files before entries and extra fields (they link to files); entries before extra fields
  // (those link to entries); products and collections before discounts; customers before gift cards.
  const resolver = createReferenceResolver(ctx, client)
  if (wanted('files')) {
    const files = read<NFile>({
      resource: 'files',
      idOf: (f) => f.sourceId,
      full: () => fetchFiles(client),
      delta: (search) => fetchFiles(client, search),
    })
    // Unused files are skipped unless asked for. A run that did not read products,
    // collections, pages or articles cannot tell what is used, so it copies what it is given.
    const plan: FilesPlan = {
      tally: new FilesTally(),
      skipUnused: !ctx.includeUnusedFiles && USAGE_RESOURCES.some((r) => wanted(r)),
    }
    await optional(ctx, 'files', () =>
      forEachBatch(ctx, 'files', files, (f) => writeFile(ctx, f, plan), FILE_CONCURRENCY),
    )
    ctx.report.setFilesEstimate(plan.tally.estimate(!plan.skipUnused))
  }
  // Content types and extra fields link to each other: a retry runs them in full (safe, idempotent).
  if (wanted('metaobjects'))
    await optional(ctx, 'metaobjects', () => importMetaobjects(ctx, client, resolver))
  if (wanted('metafields'))
    await optional(ctx, 'metafields', () => importMetafields(ctx, client, resolver, onBulkFallback))
  if (wanted('discounts'))
    await optional(ctx, 'discounts', () => importDiscounts(ctx, client, wants(only, 'discounts')))
  if (wanted('gift_cards'))
    await optional(ctx, 'gift_cards', () => importGiftCards(ctx, client, wants(only, 'gift_cards')))
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
 * Shopify's pre-order purchase options, read after the products. A connection without
 * `read_purchase_options` (or any failure here) loses only this step: the products stay
 * imported and one issue says why pre-orders were left out.
 */
async function importPreorders(ctx: ImportContext, client: ShopifyClient) {
  try {
    const changed = await applyPreorders(ctx, await fetchPreorderProductIds(client))
    if (changed)
      ctx.log(`Switched pre-order on for ${changed} products sold as pre-orders on Shopify`)
  } catch (err) {
    // Never the run's end: the products are in; only their pre-order switch is missing.
    if (ctx.signal?.aborted) throw err
    const scope = err instanceof ShopifyError && err.kind === 'scope'
    ctx.report.issue({
      resource: 'products',
      message: scope
        ? `Pre-orders were not brought over: Shopify did not allow reading purchase options (read_purchase_options). Add the scope to your Shopify app, then run the products import again. ${err.message}`
        : `Pre-orders were not brought over: ${errorMessage(err)}`,
    })
  }
}
