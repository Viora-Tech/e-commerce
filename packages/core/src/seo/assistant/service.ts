/** SOURCE OF TRUTH: loading the SEO assistant — WHAT: whether Google Search Console is connected, the assistant's rows (every live product, collection and page Google showed, with its numbers, top searches, current search title and description and SEO report gaps, ranked by opportunity) and the facts "Fix with AI" writes from / WHY: the assistant page, Fix with AI and the weekly email read one result, inside RLS, never calling Google */
import { product, type StoreTx, variant } from '@commerce/db'
import { eq, inArray, sql } from 'drizzle-orm'
import { type SearchRow, statsBy } from '../../search-console/insights'
import { loadSearchConsoleEntry, loadSearchConsoleRows } from '../../search-console/service'
import { type SeoIssueKind, type SeoItem, seoReport } from '../checks'
import { loadSeoCollectionItems, loadSeoPageItems, loadSeoProductItems } from '../service'
import {
  assistantPath,
  assistantRows,
  type SeoAssistantQuery,
  type SeoAssistantResource,
  type SeoAssistantRow,
} from './opportunity'

/**
 * `not_installed`: the Google Search Console app is not installed; `not_connected`: installed
 * but no Google account or property yet; `no_data`: connected, nothing synced yet.
 */
export type SeoAssistantState = 'not_installed' | 'not_connected' | 'no_data' | 'ready'

export type SeoAssistantView = {
  state: SeoAssistantState
  rows: SeoAssistantRow[]
  /** When the numbers were last pulled from Google (ISO), if ever. */
  syncedAt: string | null
}

/** Whether the store has Search Console installed and on a property (raw app settings). */
export async function searchConsoleConnected(
  tx: StoreTx,
  storeId: string,
): Promise<{
  state: Exclude<SeoAssistantState, 'no_data' | 'ready'> | 'connected'
  syncedAt: string | null
}> {
  const entry = await loadSearchConsoleEntry(tx, storeId)
  if (!entry.installed) return { state: 'not_installed', syncedAt: null }
  const s = (entry.settings ?? {}) as {
    refreshToken?: unknown
    property?: unknown
    syncedAt?: unknown
  }
  const syncedAt = typeof s.syncedAt === 'string' && s.syncedAt ? s.syncedAt : null
  const connected =
    typeof s.refreshToken === 'string' &&
    s.refreshToken !== '' &&
    typeof s.property === 'string' &&
    s.property !== ''
  return { state: connected ? 'connected' : 'not_connected', syncedAt }
}

const queriesByPath = (rows: readonly SearchRow[]): Map<string, SeoAssistantQuery[]> => {
  const groups = new Map<string, SearchRow[]>()
  for (const r of rows) {
    if (!r.path || !r.query) continue
    groups.set(r.path, [...(groups.get(r.path) ?? []), r])
  }
  return new Map(
    [...groups].map(([path, list]) => [
      path,
      [...statsBy(list, (r) => r.query)].map(([query, s]) => ({ query, ...s })),
    ]),
  )
}

/** The rows from the stored numbers and the live items (no state checks). */
export async function seoAssistantRows(tx: StoreTx, storeId: string): Promise<SeoAssistantRow[]> {
  const stored = await loadSearchConsoleRows(tx, storeId, ['page', 'page_query'])
  if (stored.length === 0) return []
  const pages = (period: SearchRow['period']) =>
    statsBy(
      stored.filter((r) => r.dimension === 'page' && r.period === period),
      (r) => r.path,
    )
  const current = pages('current')
  const items: SeoItem[] = [
    ...(await loadSeoProductItems(tx)),
    ...(await loadSeoCollectionItems(tx)),
    ...(await loadSeoPageItems(tx)),
  ].map((item) =>
    item.resource === 'menu'
      ? item
      : { ...item, search: current.get(assistantPath(item.resource, item.handle)) },
  )
  const gaps = new Map<string, SeoIssueKind[]>()
  const details = new Map<string, (string | null)[]>()
  for (const issue of seoReport(items).issues) {
    const key = `${issue.resource}:${issue.id}`
    gaps.set(key, [...(gaps.get(key) ?? []), issue.kind])
    details.set(key, [...(details.get(key) ?? []), issue.detail])
  }
  return assistantRows(
    items
      .filter((i): i is SeoItem & { resource: SeoAssistantResource } => i.resource !== 'menu')
      .map((i) => ({
        resource: i.resource,
        id: i.id,
        title: i.title,
        handle: i.handle,
        seoTitle: i.seoTitle,
        seoDescription: i.seoDescription,
        gaps: gaps.get(`${i.resource}:${i.id}`) ?? [],
        gapDetails: details.get(`${i.resource}:${i.id}`) ?? [],
      })),
    {
      current,
      previous: pages('previous'),
      queries: queriesByPath(
        stored.filter((r) => r.dimension === 'page_query' && r.period === 'current'),
      ),
    },
  )
}

/** Online store › SEO › Search opportunities. */
export async function loadSeoAssistant(tx: StoreTx, storeId: string): Promise<SeoAssistantView> {
  const conn = await searchConsoleConnected(tx, storeId)
  if (conn.state !== 'connected') return { state: conn.state, rows: [], syncedAt: conn.syncedAt }
  const rows = await seoAssistantRows(tx, storeId)
  return { state: rows.length ? 'ready' : 'no_data', rows, syncedAt: conn.syncedAt }
}

/** What "Fix with AI" knows about one item: its own words and its real searches. */
export type SeoDraftFacts = {
  resource: SeoAssistantResource
  id: string
  title: string
  seoTitle: string | null
  seoDescription: string | null
  /** The description or page text, plain. */
  bodyText: string
  vendor: string | null
  productType: string | null
  minPricePaise: number | null
  maxPricePaise: number | null
  queries: SeoAssistantQuery[]
}

/** Facts for the items asked for, in the order asked; items not found (or not live) are left out. */
export async function seoDraftFacts(
  tx: StoreTx,
  storeId: string,
  refs: readonly { resource: SeoAssistantResource; id: string }[],
): Promise<SeoDraftFacts[]> {
  const rows = await seoAssistantRows(tx, storeId)
  const byKey = new Map(rows.map((r) => [`${r.resource}:${r.id}`, r]))
  const items = new Map(
    [
      ...(await loadSeoProductItems(tx)),
      ...(await loadSeoCollectionItems(tx)),
      ...(await loadSeoPageItems(tx)),
    ].map((i) => [`${i.resource}:${i.id}`, i]),
  )
  const productIds = refs.filter((r) => r.resource === 'product').map((r) => r.id)
  const extra = productIds.length
    ? await tx
        .select({
          id: product.id,
          productType: product.productType,
          min: sql<number | null>`min(${variant.pricePaise})`,
          max: sql<number | null>`max(${variant.pricePaise})`,
        })
        .from(product)
        .leftJoin(variant, eq(variant.productId, product.id))
        .where(inArray(product.id, productIds))
        .groupBy(product.id)
    : []
  const out: SeoDraftFacts[] = []
  for (const ref of refs) {
    const item = items.get(`${ref.resource}:${ref.id}`)
    if (!item) continue
    const more = extra.find((e) => e.id === ref.id)
    out.push({
      resource: ref.resource,
      id: ref.id,
      title: item.title,
      seoTitle: item.seoTitle,
      seoDescription: item.seoDescription,
      bodyText: item.bodyText,
      vendor: item.vendor ?? null,
      productType: more?.productType ?? null,
      minPricePaise: more?.min ?? null,
      maxPricePaise: more?.max ?? null,
      queries: byKey.get(`${ref.resource}:${ref.id}`)?.queries ?? [],
    })
  }
  return out
}
