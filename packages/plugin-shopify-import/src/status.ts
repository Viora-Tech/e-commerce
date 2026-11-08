/**
 * "What is left to import": per resource, how many Shopify has, how many are
 * here (the import mapping), and how many are missing (not imported yet, or
 * with an open problem from their last import), plus product images on their
 * own row. Feeds the importer's main page and "Import remaining", which writes
 * only those records (`remainingFilter`).
 *
 * Nothing is called done unless Shopify's number is known: Shopify's own count,
 * else the newest preview's (or the copy it kept), else the newest full import's
 * totals. Unknown reads "Not checked yet", never done.
 */
import { media, productMedia, type StoreTx } from '@commerce/db'
import { and, count, desc, eq, inArray } from 'drizzle-orm'
import {
  IMPORT_RESOURCES,
  type ImportResource,
  type ImportStatus,
  type ResourceProgress,
  type ResourceStatus,
  type RunStatus,
  type SnapshotResource,
} from './client'
import { type ClientForOptions, clientFor } from './connection'
import { mediaSourceKey } from './media'
import { importIssue, importMapping, importRun } from './schema'
import { failStaleRuns } from './service'
import type { ShopifyClient } from './shopify-client'
import { freshSnapshot } from './snapshot'
import type { NProduct } from './types'

/** Import resource → the mapping resource its records are keyed under (one row per record). */
const MAPPED: Partial<Record<ImportResource, string>> = {
  products: 'products',
  collections: 'collections',
  customers: 'customers',
  orders: 'orders',
  pages: 'pages',
  articles: 'articles',
  menus: 'menus',
  files: 'files',
  metaobjects: 'metaobjects',
  gift_cards: 'gift_cards',
  discounts: 'discounts',
  store_credit: 'store_credit',
}

/** Shopify's own counts, where the Admin API has one (`limit: null` = no 10,000 cap). */
const COUNT_FIELDS: Partial<Record<ImportResource, string>> = {
  products: 'productsCount',
  collections: 'collectionsCount',
  customers: 'customersCount',
  orders: 'ordersCount',
  pages: 'pagesCount',
  discounts: 'discountNodesCount',
  gift_cards: 'giftCardsCount',
  redirects: 'urlRedirectsCount',
}

/** Counts are asked once per store per few minutes, however often the page loads. */
const COUNT_TTL_MS = 3 * 60 * 1000
const countCache = new Map<string, { at: number; counts: ShopifyCounts }>()
/** Past this, counting stops and what is left reads from the preview (the request holds a connection). */
const COUNT_BUDGET_MS = 8000

export type ShopifyCounts = Partial<Record<ImportResource, number>>

/**
 * Shopify's count of each resource that has one. Each count is its own small
 * query, so one the token cannot read (or this API version lacks) is simply
 * left out, never failing the page.
 */
export async function shopifyCounts(
  storeId: string,
  client: ShopifyClient,
  now = Date.now(),
  opts: { budgetMs?: number; clock?: () => number } = {},
): Promise<ShopifyCounts> {
  const hit = countCache.get(storeId)
  if (hit && now - hit.at < COUNT_TTL_MS) return hit.counts
  const clock = opts.clock ?? Date.now
  const budget = opts.budgetMs ?? COUNT_BUDGET_MS
  const began = clock()
  const counts: ShopifyCounts = {}
  let complete = true
  for (const [resource, field] of Object.entries(COUNT_FIELDS) as [ImportResource, string][]) {
    // A throttled Shopify must not hold the page (and its database connection) for long.
    if (clock() - began >= budget) {
      complete = false
      break
    }
    try {
      const data = await client.query<Record<string, { count: number } | null>>(
        `{ ${field}(limit: null) { count } }`,
        {},
        10,
      )
      const n = data[field]?.count
      if (typeof n === 'number') counts[resource] = n
    } catch {
      // Not readable with this token or API version: the preview's number stands in.
    }
  }
  // Cut short: the next load asks again for the rest.
  if (complete) countCache.set(storeId, { at: now, counts })
  return counts
}

/** Cached Shopify counts only (never asks Shopify): what a page shows while an import runs. */
export function cachedCounts(storeId: string, now = Date.now()): ShopifyCounts {
  const hit = countCache.get(storeId)
  return hit && now - hit.at < COUNT_TTL_MS ? hit.counts : {}
}

type RunLite = {
  id: string
  dryRun: boolean
  status: string
  resources: ImportResource[]
  progress: Partial<Record<ImportResource, ResourceProgress>>
  createdAt: Date
  finishedAt: Date | null
  snapshot: typeof importRun.$inferSelect.snapshot
  onlyMissing: boolean
  retryOf: string | null
}

/** Runs that ended, one way or another: what they did (or left) is what is here now. */
const ENDED: RunStatus[] = ['completed', 'failed', 'cancelled']

async function recentRuns(tx: StoreTx): Promise<RunLite[]> {
  return tx
    .select({
      id: importRun.id,
      dryRun: importRun.dryRun,
      status: importRun.status,
      resources: importRun.resources,
      progress: importRun.progress,
      createdAt: importRun.createdAt,
      finishedAt: importRun.finishedAt,
      snapshot: importRun.snapshot,
      onlyMissing: importRun.onlyMissing,
      retryOf: importRun.retryOf,
    })
    .from(importRun)
    .where(and(eq(importRun.mode, 'api'), inArray(importRun.status, ENDED)))
    .orderBy(desc(importRun.createdAt), desc(importRun.id))
    .limit(200)
}

/** The newest run queued or running: the page shows it in progress (`ImportStatus.running`). */
export async function activeRun(tx: StoreTx): Promise<ImportStatus['running']> {
  const [row] = await tx
    .select({
      id: importRun.id,
      dryRun: importRun.dryRun,
      status: importRun.status,
      startedAt: importRun.startedAt,
      createdAt: importRun.createdAt,
    })
    .from(importRun)
    .where(inArray(importRun.status, ['queued', 'running']))
    .orderBy(desc(importRun.createdAt), desc(importRun.id))
    .limit(1)
  if (!row || (row.status !== 'queued' && row.status !== 'running')) return null
  return {
    runId: row.id,
    preview: row.dryRun,
    status: row.status,
    startedAt: (row.startedAt ?? row.createdAt).toISOString(),
  }
}

/** The latest ended real import (or retry) that touched each resource. */
function latestImports(runs: RunLite[]): Partial<Record<ImportResource, RunLite>> {
  const out: Partial<Record<ImportResource, RunLite>> = {}
  for (const run of runs) {
    if (run.dryRun) continue
    for (const r of run.resources) out[r] ??= run
  }
  return out
}

/**
 * A run that read everything Shopify has (not "Import remaining", not a retry,
 * and it finished): its totals are Shopify's numbers. A preview that is started
 * becomes the import on the same row, so after an import this is often the only
 * count left.
 */
const readEverything = (run: RunLite) =>
  run.status === 'completed' && !run.onlyMissing && !run.retryOf

type Counted = {
  n: number
  from: 'preview' | 'import'
  at: Date
  progress: ResourceProgress | null
}

/**
 * The newest count of `resource` any run left: a preview's, the copy a preview
 * kept (it moves to the import that reads it), or a full import's totals.
 */
function countOf(runs: RunLite[], resource: ImportResource): Counted | null {
  for (const run of runs) {
    const p = run.progress[resource]
    if (run.dryRun && run.status === 'completed' && p) {
      return { n: p.total, from: 'preview', at: run.createdAt, progress: p }
    }
    const kept = run.snapshot?.streams[resource as SnapshotResource]
    if (kept && run.snapshot) {
      return { n: kept.count, from: 'preview', at: new Date(run.snapshot.takenAt), progress: null }
    }
    if (!run.dryRun && readEverything(run) && p && p.total > 0) {
      return { n: p.total, from: 'import', at: run.finishedAt ?? run.createdAt, progress: p }
    }
  }
  return null
}

/** How many product images Shopify's products carry, from the newest run that counted them. */
function imagesCountOf(runs: RunLite[]): Counted | null {
  for (const run of runs) {
    const p = run.progress.products
    if (p?.images === undefined) continue
    if (run.dryRun ? run.status === 'completed' : readEverything(run)) {
      const from = run.dryRun ? 'preview' : 'import'
      return { n: p.images, from, at: run.finishedAt ?? run.createdAt, progress: p }
    }
  }
  return null
}

/**
 * What a run said can never come over (unsupported types and the like). Skips
 * because storage was not writable are not that: those are simply not copied.
 */
function cannotCome(p: ResourceProgress | null | undefined): number {
  if (!p) return 0
  const unwritable = (p.left ?? [])
    .filter((l) => l.reason === 'storage_unwritable')
    .reduce((sum, l) => sum + l.count, 0)
  return Math.max(0, p.skipped - unwritable)
}

/** "Image <url> was not copied: …", as imports before issue keys (migration 0087) wrote it. */
const IMAGE_NOT_COPIED = /^Image \S+ was not copied/

/**
 * Open problems from each resource's latest import. Problems with a record key
 * are what a retry can fix; image problems are counted whether or not they carry
 * one (imports before migration 0087 recorded none).
 */
async function openIssues(
  tx: StoreTx,
  latest: Partial<Record<ImportResource, RunLite>>,
): Promise<{
  records: Map<ImportResource, Set<string>>
  /** The same without image-only problems: the record itself is here. */
  failed: Map<ImportResource, Set<string>>
  /** Product images the latest products import could not copy. */
  images: number
}> {
  const records = new Map<ImportResource, Set<string>>()
  const failed = new Map<ImportResource, Set<string>>()
  let images = 0
  const runIds = [...new Set(Object.values(latest).map((r) => r.id))]
  if (runIds.length === 0) return { records, failed, images }
  const rows = await tx
    .select({
      runId: importIssue.runId,
      resource: importIssue.resource,
      sourceId: importIssue.sourceId,
      kind: importIssue.kind,
      message: importIssue.message,
    })
    .from(importIssue)
    .where(inArray(importIssue.runId, runIds))
  for (const row of rows) {
    const resource = row.resource as ImportResource
    if (latest[resource]?.id !== row.runId) continue
    const image =
      resource === 'products' &&
      (row.kind === 'media' || (!row.kind && IMAGE_NOT_COPIED.test(row.message)))
    if (image) images++
    if (!row.sourceId) continue
    const add = (into: Map<ImportResource, Set<string>>, id: string) => {
      const set = into.get(resource) ?? new Set<string>()
      set.add(id)
      into.set(resource, set)
    }
    add(records, row.sourceId)
    if (row.kind !== 'media') add(failed, row.sourceId)
  }
  return { records, failed, images }
}

async function mappedCounts(tx: StoreTx): Promise<Map<string, number>> {
  const rows = await tx
    .select({ resource: importMapping.resource, n: count() })
    .from(importMapping)
    .groupBy(importMapping.resource)
  return new Map(rows.map((r) => [r.resource, r.n]))
}

const importedProductIds = (tx: StoreTx) =>
  tx
    .select({ id: importMapping.localId })
    .from(importMapping)
    .where(eq(importMapping.resource, 'products'))

/** Images linked to products that came from Shopify: what is really here. */
async function linkedImages(tx: StoreTx): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(productMedia)
    .where(inArray(productMedia.productId, importedProductIds(tx)))
  return row?.n ?? 0
}

/** The page's numbers. `counts` are Shopify's own (`shopifyCounts`), empty when not connected. */
export async function importStatus(
  tx: StoreTx,
  counts: ShopifyCounts,
  now = Date.now(),
): Promise<ImportStatus> {
  const runs = await recentRuns(tx)
  const latest = latestImports(runs)
  const mapped = await mappedCounts(tx)
  const open = await openIssues(tx, latest)

  const resources: ResourceStatus[] = IMPORT_RESOURCES.map((resource) => {
    const counted = countOf(runs, resource)
    const last = latest[resource]
    const live = counts[resource]
    const inShopify = live ?? counted?.n ?? null
    const mappingKey = MAPPED[resource]
    const lastProgress = last?.progress[resource]
    const imported = mappingKey
      ? (mapped.get(mappingKey) ?? 0)
      : (lastProgress?.created ?? 0) + (lastProgress?.updated ?? 0) + (lastProgress?.skipped ?? 0)
    // Things a run already said cannot come over (unsupported types) are not "missing".
    const cannot = cannotCome(counted?.progress)
    // What the latest import could not bring over, keyed or not (older imports kept no keys).
    const issues = Math.max(open.failed.get(resource)?.size ?? 0, lastProgress?.failed ?? 0)
    const never = !last && imported === 0
    const gap = inShopify === null ? 0 : Math.max(0, inShopify - imported - cannot)
    const missing = never ? (inShopify ?? 0) : Math.max(issues, gap)
    // Done only when Shopify's number is known and everything in it is here.
    const state: ResourceStatus['state'] = never
      ? inShopify === null
        ? 'unknown'
        : inShopify === 0
          ? 'done'
          : 'never'
      : missing > 0
        ? resource === 'files'
          ? 'not_copied'
          : 'missing'
        : inShopify === null
          ? 'unknown'
          : 'done'
    return {
      resource,
      inShopify,
      countedFrom: live !== undefined ? 'shopify' : (counted?.from ?? null),
      countedAt:
        live !== undefined ? new Date(now).toISOString() : (counted?.at.toISOString() ?? null),
      imported,
      missing,
      state,
      lastImportAt: last?.finishedAt?.toISOString() ?? null,
    }
  })

  const imageCount = imagesCountOf(runs)
  const imagesHere = await linkedImages(tx)
  // An older import counted no images: what is here plus what it could not copy is a floor.
  const expected = imageCount?.n ?? (open.images > 0 ? imagesHere + open.images : null)
  const imagesMissing =
    expected === null ? open.images : Math.max(open.images, expected - imagesHere)
  const fresh = runs.find((r) => freshSnapshot(r.snapshot, now))
  // Any real import counts here, a CSV upload too (`runs` holds API runs only).
  const [lastImport] = await tx
    .select({ finishedAt: importRun.finishedAt })
    .from(importRun)
    .where(and(eq(importRun.dryRun, false), inArray(importRun.status, ENDED)))
    .orderBy(desc(importRun.createdAt), desc(importRun.id))
    .limit(1)
  const left = new Set(
    resources
      .filter((r) => r.state === 'missing' || r.state === 'not_copied' || r.state === 'never')
      .filter((r) => r.missing > 0)
      .map((r) => r.resource),
  )
  // Copying the missing images is an "Import remaining" of products (see `remainingFilter`).
  if (imagesMissing > 0) left.add('products')
  return {
    resources,
    images: {
      expected,
      here: imagesHere,
      missing: imagesMissing,
      countedFrom: imageCount?.from ?? (expected === null ? null : 'import'),
      countedAt: imageCount?.at.toISOString() ?? null,
      state: imagesMissing > 0 ? 'not_copied' : expected === null ? 'unknown' : 'done',
    },
    remaining: IMPORT_RESOURCES.filter((r) => left.has(r)),
    lastImportAt: lastImport?.finishedAt?.toISOString() ?? null,
    freshPreview: fresh?.snapshot ? { runId: fresh.id, takenAt: fresh.snapshot.takenAt } : null,
    running: await activeRun(tx),
  }
}

/** Is a record kept by a narrowed run? `item` is the record itself, when the test needs it. */
export type KeepTest = (resource: ImportResource, id: string, item?: unknown) => boolean

/**
 * Products whose images are not all here: one of their image sources has no
 * stored copy (the media mapping, keyed by source URL), or fewer images are
 * linked to the product than Shopify has. Matching by source URL means a copy
 * run never downloads an image twice, whichever product or file it came with.
 */
async function imageGaps(tx: StoreTx) {
  const copiedRows = await tx
    .select({ sourceId: importMapping.sourceId })
    .from(importMapping)
    .innerJoin(media, eq(media.id, importMapping.localId))
    .where(eq(importMapping.resource, 'media'))
  const copied = new Set(copiedRows.map((r) => r.sourceId))
  const linkedRows = await tx
    .select({ sourceId: importMapping.sourceId, n: count(productMedia.id) })
    .from(importMapping)
    .leftJoin(productMedia, eq(productMedia.productId, importMapping.localId))
    .where(eq(importMapping.resource, 'products'))
    .groupBy(importMapping.sourceId)
  const linked = new Map(linkedRows.map((r) => [r.sourceId, r.n]))
  return (id: string, p: Pick<NProduct, 'images'>) => {
    const keys = new Set(p.images.map((i) => mediaSourceKey(i.src)))
    if (keys.size === 0) return false
    if ((linked.get(id) ?? 0) < keys.size) return true
    for (const key of keys) if (!copied.has(key)) return true
    return false
  }
}

/**
 * For "Import remaining": keep a record when it is not imported yet (no mapping),
 * its last import left an open problem on it, or (products) its images are not
 * all here. Resources without one mapping row per record (redirects, extra
 * fields) keep everything; their writers update in place.
 */
export async function remainingFilter(
  tx: StoreTx,
  resources: readonly ImportResource[],
): Promise<KeepTest> {
  const runs = await recentRuns(tx)
  const open = await openIssues(tx, latestImports(runs))
  const here = new Map<ImportResource, Set<string>>()
  for (const resource of resources) {
    const key = MAPPED[resource]
    if (!key) continue
    const rows = await tx
      .select({ sourceId: importMapping.sourceId })
      .from(importMapping)
      .where(eq(importMapping.resource, key))
    // Discount mappings are per code (`<id>#CODE`); a discount is here when any code is.
    here.set(resource, new Set(rows.map((r) => r.sourceId.split('#')[0] ?? r.sourceId)))
  }
  const missingImages = resources.includes('products') ? await imageGaps(tx) : null
  return (resource, id, item) => {
    if (open.records.get(resource)?.has(id)) return true
    const set = here.get(resource)
    if (!set?.has(id)) return true
    if (resource === 'products' && missingImages && item) {
      return missingImages(id, item as NProduct)
    }
    return false
  }
}

/**
 * The status page: Shopify's counts when connected (cached), then `importStatus`.
 * While a run is in flight it uses the cached counts only: the run is spending the
 * app's Shopify rate limit, so live counts would be throttled and hold this request
 * (and its database connection) for as long as the run keeps the bucket empty.
 */
export async function remainingStatus(
  tx: StoreTx,
  storeId: string,
  secret: string,
  opts: ClientForOptions = {},
): Promise<ImportStatus> {
  // A run whose worker died reads as ended here too, not "in progress" forever.
  await failStaleRuns(tx)
  if (await activeRun(tx)) return importStatus(tx, cachedCounts(storeId))
  const client = await clientFor(tx, secret, opts).catch(() => null)
  const counts = client ? await shopifyCounts(storeId, client).catch(() => ({})) : {}
  return importStatus(tx, counts)
}
