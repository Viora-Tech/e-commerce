/**
 * "What is left to import": per resource, how many Shopify has, how many are
 * here (the import mapping), and how many are missing (not imported yet, or
 * with an open problem from their last import), plus product images on their
 * own row. Feeds the importer's main page and "Import remaining", which writes
 * only those records (`remainingFilter`).
 */
import type { StoreTx } from '@commerce/db'
import { and, count, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import {
  IMPORT_RESOURCES,
  type ImportResource,
  type ImportStatus,
  type ResourceProgress,
  type ResourceStatus,
} from './client'
import { type ClientForOptions, clientFor } from './connection'
import { importIssue, importMapping, importRun } from './schema'
import type { ShopifyClient } from './shopify-client'
import { freshSnapshot } from './snapshot'

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
): Promise<ShopifyCounts> {
  const hit = countCache.get(storeId)
  if (hit && now - hit.at < COUNT_TTL_MS) return hit.counts
  const counts: ShopifyCounts = {}
  for (const [resource, field] of Object.entries(COUNT_FIELDS) as [ImportResource, string][]) {
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
  countCache.set(storeId, { at: now, counts })
  return counts
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
}

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
    })
    .from(importRun)
    .where(and(eq(importRun.mode, 'api'), inArray(importRun.status, ['completed', 'failed'])))
    .orderBy(desc(importRun.createdAt), desc(importRun.id))
    .limit(200)
}

/** The latest finished real import (or retry) that touched each resource. */
function latestImports(runs: RunLite[]): Partial<Record<ImportResource, RunLite>> {
  const out: Partial<Record<ImportResource, RunLite>> = {}
  for (const run of runs) {
    if (run.dryRun) continue
    for (const r of run.resources) out[r] ??= run
  }
  return out
}

/** Open problems a retry could fix: per resource, from that resource's latest import. */
async function openIssues(
  tx: StoreTx,
  latest: Partial<Record<ImportResource, RunLite>>,
): Promise<{
  records: Map<ImportResource, Set<string>>
  /** The same without image-only problems: the record itself is here. */
  failed: Map<ImportResource, Set<string>>
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
    })
    .from(importIssue)
    .where(and(inArray(importIssue.runId, runIds), isNotNull(importIssue.sourceId)))
  for (const row of rows) {
    const resource = row.resource as ImportResource
    if (latest[resource]?.id !== row.runId || !row.sourceId) continue
    if (resource === 'products' && row.kind === 'media') images++
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

/** The page's numbers. `counts` are Shopify's own (`shopifyCounts`), empty when not connected. */
export async function importStatus(
  tx: StoreTx,
  counts: ShopifyCounts,
  now = Date.now(),
): Promise<ImportStatus> {
  const runs = await recentRuns(tx)
  const latest = latestImports(runs)
  const previews = runs.filter((r) => r.dryRun && r.status === 'completed')
  const previewOf = (r: ImportResource) => previews.find((p) => p.progress[r])
  const mapped = await mappedCounts(tx)
  const open = await openIssues(tx, latest)

  const resources: ResourceStatus[] = IMPORT_RESOURCES.map((resource) => {
    const preview = previewOf(resource)
    const last = latest[resource]
    const live = counts[resource]
    const inShopify = live ?? preview?.progress[resource]?.total ?? null
    const mappingKey = MAPPED[resource]
    const lastProgress = last?.progress[resource]
    const imported = mappingKey
      ? (mapped.get(mappingKey) ?? 0)
      : (lastProgress?.created ?? 0) + (lastProgress?.updated ?? 0) + (lastProgress?.skipped ?? 0)
    // Things a preview already said cannot come over (unsupported types) are not "missing".
    const cannot = preview?.progress[resource]?.skipped ?? 0
    const issues = open.failed.get(resource)?.size ?? 0
    const never = !last && imported === 0
    const gap = inShopify === null ? 0 : Math.max(0, inShopify - imported - cannot)
    const missing = never ? (inShopify ?? 0) : Math.max(issues, gap)
    const state: ResourceStatus['state'] =
      never && inShopify === null
        ? 'unknown'
        : never
          ? inShopify === 0
            ? 'done'
            : 'never'
          : missing === 0
            ? 'done'
            : resource === 'files'
              ? 'not_copied'
              : 'missing'
    return {
      resource,
      inShopify,
      countedFrom: live !== undefined ? 'shopify' : preview ? 'preview' : null,
      countedAt:
        live !== undefined
          ? new Date(now).toISOString()
          : (preview?.createdAt.toISOString() ?? null),
      imported,
      missing,
      state,
      lastImportAt: last?.finishedAt?.toISOString() ?? null,
    }
  })

  const productsPreview = previewOf('products')
  const expectedImages = productsPreview?.progress.products?.images ?? null
  const fresh = runs.find((r) => freshSnapshot(r.snapshot, now))
  const lastImport = runs.find((r) => !r.dryRun)
  return {
    resources,
    images: {
      expected: expectedImages,
      missing: open.images,
      countedAt: productsPreview?.createdAt.toISOString() ?? null,
      state: open.images > 0 ? 'not_copied' : expectedImages === null ? 'unknown' : 'done',
    },
    remaining: resources
      .filter((r) => r.state === 'missing' || r.state === 'not_copied' || r.state === 'never')
      .filter((r) => r.missing > 0)
      .map((r) => r.resource),
    lastImportAt: lastImport?.finishedAt?.toISOString() ?? null,
    freshPreview: fresh?.snapshot ? { runId: fresh.id, takenAt: fresh.snapshot.takenAt } : null,
  }
}

/**
 * For "Import remaining": keep a record when it is not imported yet (no mapping)
 * or its last import left an open problem on it. Resources without one mapping
 * row per record (redirects, extra fields) keep everything; their writers update
 * in place.
 */
export async function remainingFilter(
  tx: StoreTx,
  resources: readonly ImportResource[],
): Promise<(resource: ImportResource, id: string) => boolean> {
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
  return (resource, id) => {
    if (open.records.get(resource)?.has(id)) return true
    const set = here.get(resource)
    return set ? !set.has(id) : true
  }
}

/** The status page: Shopify's counts when connected (cached), then `importStatus`. */
export async function remainingStatus(
  tx: StoreTx,
  storeId: string,
  secret: string,
  opts: ClientForOptions = {},
): Promise<ImportStatus> {
  const client = await clientFor(tx, secret, opts).catch(() => null)
  const counts = client ? await shopifyCounts(storeId, client).catch(() => ({})) : {}
  return importStatus(tx, counts)
}
