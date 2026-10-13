/** SOURCE OF TRUTH: Google Search Console data in the database — WHAT: the app's settings entry in `store.apps`, the stored Search Analytics rows (replace, clear, read), matching Google's pages to our products, collections and pages, `searchStatsForProduct`, the searches per page for "Suggest keywords" (registered on `seo/search-queries.ts`), and the stores due a daily sync / WHY: the app (admin API and worker job), the product page and the SEO report read and write one place, inside RLS; the Google calls themselves live in the app's package */
import {
  collection,
  type Db,
  page,
  product,
  type StoreTx,
  searchConsoleRow,
  store,
  storeDomain,
  storesWithSearchConsoleDue,
} from '@commerce/db'
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { appSettingsOf, parseAppsSettings, withAppSettings } from '../apps/settings'
import { type PageSearchQuery, setSearchQueriesSource } from '../seo/search-queries'
import {
  productSearchPath,
  SEARCH_CONSOLE_APP_ID,
  type SearchDimension,
  type SearchRow,
  type SearchStats,
  searchPathKind,
  statsBy,
  sumStats,
} from './insights'

/** Rows per insert; a sync writes a few thousand. */
const INSERT_CHUNK = 500

/** Most searches listed for one product. */
const PRODUCT_TOP_QUERIES = 5

async function appInstalled(tx: StoreTx, storeId: string): Promise<boolean> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  return parseAppsSettings(s?.apps).installed.includes(SEARCH_CONSOLE_APP_ID)
}

/** The app's raw settings entry (the app parses it), whether it is installed, and the store's live hosts. */
export async function loadSearchConsoleEntry(
  tx: StoreTx,
  storeId: string,
): Promise<{ installed: boolean; settings: unknown; hostnames: string[] }> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const apps = parseAppsSettings(s?.apps)
  const domains = await tx
    .select({ hostname: storeDomain.hostname })
    .from(storeDomain)
    .where(and(eq(storeDomain.storeId, storeId), eq(storeDomain.status, 'active')))
    .orderBy(desc(storeDomain.isPrimary), storeDomain.hostname)
  return {
    installed: apps.installed.includes(SEARCH_CONSOLE_APP_ID),
    settings: appSettingsOf(apps, SEARCH_CONSOLE_APP_ID),
    hostnames: domains.map((d) => d.hostname.toLowerCase()),
  }
}

/** Replaces the app's settings entry, leaving the install list and other apps alone. */
export async function saveSearchConsoleEntry(
  tx: StoreTx,
  storeId: string,
  value: unknown,
): Promise<void> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  await tx
    .update(store)
    .set({ apps: withAppSettings(parseAppsSettings(s?.apps), SEARCH_CONSOLE_APP_ID, value) })
    .where(eq(store.id, storeId))
}

/** Swaps the store's stored numbers for a fresh pull, in one transaction. */
export async function replaceSearchConsoleRows(
  tx: StoreTx,
  storeId: string,
  rows: readonly SearchRow[],
): Promise<void> {
  await tx.delete(searchConsoleRow).where(eq(searchConsoleRow.storeId, storeId))
  const fetchedAt = new Date()
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    await tx.insert(searchConsoleRow).values(
      rows.slice(i, i + INSERT_CHUNK).map((r) => ({
        storeId,
        period: r.period,
        dimension: r.dimension,
        page: r.page,
        path: r.path,
        query: r.query,
        segment: r.segment,
        clicks: Math.round(r.clicks),
        impressions: Math.round(r.impressions),
        position: r.position,
        fetchedAt,
      })),
    )
  }
}

/** Forgets every stored number (disconnect, or a different property chosen). */
export async function clearSearchConsoleRows(tx: StoreTx, storeId: string): Promise<void> {
  await tx.delete(searchConsoleRow).where(eq(searchConsoleRow.storeId, storeId))
}

/** The stored rows of some dimensions, both periods. */
export async function loadSearchConsoleRows(
  tx: StoreTx,
  storeId: string,
  dimensions: readonly SearchDimension[],
): Promise<SearchRow[]> {
  const rows = await tx
    .select({
      period: searchConsoleRow.period,
      dimension: searchConsoleRow.dimension,
      page: searchConsoleRow.page,
      path: searchConsoleRow.path,
      query: searchConsoleRow.query,
      segment: searchConsoleRow.segment,
      clicks: searchConsoleRow.clicks,
      impressions: searchConsoleRow.impressions,
      position: searchConsoleRow.position,
    })
    .from(searchConsoleRow)
    .where(
      and(
        eq(searchConsoleRow.storeId, storeId),
        inArray(searchConsoleRow.dimension, [...dimensions]),
      ),
    )
  return rows as SearchRow[]
}

/** A store item a Google page is, for links and titles on the app's pages. */
export type SearchItem = { resource: 'product' | 'collection' | 'page'; id: string; title: string }

/** Our products, collections and pages behind some paths (`/products/<handle>` …), by path. */
export async function searchItemsByPath(
  tx: StoreTx,
  paths: readonly string[],
): Promise<Map<string, SearchItem>> {
  const handles = {
    product: new Set<string>(),
    collection: new Set<string>(),
    page: new Set<string>(),
  }
  for (const path of paths) {
    const { kind, handle } = searchPathKind(path)
    if (handle && (kind === 'product' || kind === 'collection' || kind === 'page')) {
      handles[kind].add(handle)
    }
  }
  const out = new Map<string, SearchItem>()
  if (handles.product.size > 0) {
    const rows = await tx
      .select({ id: product.id, title: product.title, handle: product.handle })
      .from(product)
      .where(inArray(product.handle, [...handles.product]))
    for (const r of rows) {
      out.set(`/products/${r.handle.toLowerCase()}`, {
        resource: 'product',
        id: r.id,
        title: r.title,
      })
    }
  }
  if (handles.collection.size > 0) {
    const rows = await tx
      .select({ id: collection.id, title: collection.title, handle: collection.handle })
      .from(collection)
      .where(inArray(collection.handle, [...handles.collection]))
    for (const r of rows) {
      out.set(`/collections/${r.handle.toLowerCase()}`, {
        resource: 'collection',
        id: r.id,
        title: r.title,
      })
    }
  }
  if (handles.page.size > 0) {
    const rows = await tx
      .select({ id: page.id, title: page.title, handle: page.handle })
      .from(page)
      .where(and(inArray(page.handle, [...handles.page]), isNotNull(page.publishedAt)))
    for (const r of rows) {
      out.set(`/pages/${r.handle.toLowerCase()}`, { resource: 'page', id: r.id, title: r.title })
    }
  }
  return out
}

/** One search that brought shoppers to a product. */
export type ProductSearchQuery = { query: string } & SearchStats

/** A product's Google numbers over the last 28 days, the 28 before, and its top searches. */
export type ProductSearchStats = {
  current: SearchStats
  previous: SearchStats
  queries: ProductSearchQuery[]
}

/**
 * The product page's "Google search" card: the product's own page (`/products/<handle>`, also
 * when Google showed it inside a collection) added up over every URL Google reported for it.
 * Null when the store has no Search Console numbers at all (app not installed or not
 * connected yet); zeros when Google has numbers but never showed this product.
 */
export async function searchStatsForProduct(
  tx: StoreTx,
  storeId: string,
  productId: string,
): Promise<ProductSearchStats | null> {
  if (!(await appInstalled(tx, storeId))) return null
  const [any] = await tx
    .select({ id: searchConsoleRow.id })
    .from(searchConsoleRow)
    .where(eq(searchConsoleRow.storeId, storeId))
    .limit(1)
  if (!any) return null
  const [p] = await tx
    .select({ handle: product.handle })
    .from(product)
    .where(eq(product.id, productId))
  if (!p) return null
  const rows = (await tx
    .select({
      period: searchConsoleRow.period,
      dimension: searchConsoleRow.dimension,
      query: searchConsoleRow.query,
      clicks: searchConsoleRow.clicks,
      impressions: searchConsoleRow.impressions,
      position: searchConsoleRow.position,
    })
    .from(searchConsoleRow)
    .where(
      and(
        eq(searchConsoleRow.storeId, storeId),
        eq(searchConsoleRow.path, productSearchPath(p.handle)),
      ),
    )) as Pick<
    SearchRow,
    'period' | 'dimension' | 'query' | 'clicks' | 'impressions' | 'position'
  >[]
  const pages = (period: SearchRow['period']) =>
    rows.filter((r) => r.dimension === 'page' && r.period === period)
  const byQuery = statsBy(
    rows.filter((r) => r.dimension === 'page_query' && r.period === 'current') as SearchRow[],
    (r) => r.query,
  )
  const queries = [...byQuery]
    .map(([query, s]) => ({ query, ...s }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, PRODUCT_TOP_QUERIES)
  return { current: sumStats(pages('current')), previous: sumStats(pages('previous')), queries }
}

/**
 * The SEO report's search signals: each path's last-28-day numbers. Null when the app is not
 * installed or has no numbers yet, so the report adds no search issues.
 */
export async function searchStatsByPath(
  tx: StoreTx,
  storeId: string,
): Promise<Map<string, SearchStats> | null> {
  if (!(await appInstalled(tx, storeId))) return null
  const rows = (await loadSearchConsoleRows(tx, storeId, ['page'])).filter(
    (r) => r.period === 'current',
  )
  if (rows.length === 0) return null
  return statsBy(rows, (r) => r.path)
}

/** Stores whose daily Search Console sync is due, for the worker. */
export function storesDueSearchConsoleSync(db: Db): Promise<string[]> {
  return storesWithSearchConsoleDue(db)
}

/**
 * The searches that showed one storefront path on Google over the last 28 days, most clicks
 * first: what "Suggest keywords" grounds its keywords in. Empty without the app or its numbers.
 */
async function storedSearchQueries(input: {
  tx: StoreTx
  storeId: string
  path: string
}): Promise<PageSearchQuery[]> {
  if (!(await appInstalled(input.tx, input.storeId))) return []
  const rows = (await input.tx
    .select({
      query: searchConsoleRow.query,
      clicks: searchConsoleRow.clicks,
      impressions: searchConsoleRow.impressions,
      position: searchConsoleRow.position,
    })
    .from(searchConsoleRow)
    .where(
      and(
        eq(searchConsoleRow.storeId, input.storeId),
        eq(searchConsoleRow.dimension, 'page_query'),
        eq(searchConsoleRow.period, 'current'),
        eq(searchConsoleRow.path, input.path.toLowerCase()),
      ),
    )) as Pick<SearchRow, 'query' | 'clicks' | 'impressions' | 'position'>[]
  return [...statsBy(rows as SearchRow[], (r) => r.query)]
    .map(([query, s]) => ({ query, clicks: s.clicks, impressions: s.impressions }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
}

// The keyword code reads Search Console through its hook, so it works with or without the app;
// the stored rows live here in core, so this is where the reader plugs in.
setSearchQueriesSource(storedSearchQueries)
