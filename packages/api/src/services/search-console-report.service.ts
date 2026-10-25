import {
  almostPageOne,
  compareStats,
  EMPTY_STATS,
  loadSearchConsoleEntry,
  loadSearchConsoleRows,
  losingTraffic,
  percentChange,
  type SearchCompare,
  type SearchItem,
  type SearchRow,
  type SearchStats,
  searchItemsByPath,
  searchStatsForProduct,
  statsBy,
  sumStats,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  parseSearchConsoleSettings,
  type SearchConsoleView,
  searchConsoleView,
} from '@commerce/plugin-search-console/settings'
import type { SearchConsoleEnv } from './search-console.service'

/**
 * The Google Search Console app's report pages and the product page card, read from the stored
 * rows (`search_console_row`): never a call to Google, and a drawable state for every setup.
 */

/** Longest lists the app's pages show. */
const LIST_MAX = 100
const OPPORTUNITY_MAX = 50

/** One search, or one page, with this period's numbers, the period before and the change. */
export type SearchEntry = {
  key: string
  current: SearchStats
  previous: SearchStats
  clickDelta: number
  /** Percent change in clicks; null when there were none before. */
  clickChange: number | null
}

/** A page: its path, the URL Google showed most, the store item behind it and its top search. */
export type SearchPageEntry = SearchEntry & {
  url: string
  item: SearchItem | null
  topQuery: string | null
}

/** One device or country. */
export type SearchSegment = { key: string; stats: SearchStats }

/** What the app's pages draw. A state for every case, never an error for a missing setup. */
export type SearchConsoleReport =
  | { state: 'not-installed' }
  | { state: 'not-connected'; available: boolean }
  | { state: 'no-property'; reconnect: boolean }
  /** Connected with a property, no numbers stored yet (first sync running or failed). */
  | { state: 'pending'; lastError: string; reconnect: boolean }
  | {
      state: 'ready'
      view: SearchConsoleView
      totals: { current: SearchStats; previous: SearchStats }
      queries: SearchEntry[]
      pages: SearchPageEntry[]
      almostPageOne: SearchPageEntry[]
      losingPages: SearchPageEntry[]
      losingQueries: SearchEntry[]
      devices: SearchSegment[]
      countries: SearchSegment[]
    }

const entry = (c: SearchCompare): SearchEntry => ({
  ...c,
  clickChange: percentChange(c.current.clicks, c.previous.clicks),
})

const of = (
  rows: readonly SearchRow[],
  dimension: SearchRow['dimension'],
  period: SearchRow['period'],
) => rows.filter((r) => r.dimension === dimension && r.period === period)

/** The most-shown URL per path and the search that showed each path most. */
function pageDetails(rows: readonly SearchRow[]) {
  const url = new Map<string, { page: string; impressions: number }>()
  for (const r of of(rows, 'page', 'current')) {
    if (!r.path || !r.page) continue
    const seen = url.get(r.path)
    if (!seen || r.impressions > seen.impressions) {
      url.set(r.path, { page: r.page, impressions: r.impressions })
    }
  }
  const topQuery = new Map<string, { query: string; impressions: number }>()
  for (const r of of(rows, 'page_query', 'current')) {
    if (!r.path || !r.query) continue
    const seen = topQuery.get(r.path)
    if (!seen || r.impressions > seen.impressions) {
      topQuery.set(r.path, { query: r.query, impressions: r.impressions })
    }
  }
  return { url, topQuery }
}

const segments = (rows: readonly SearchRow[], dimension: 'device' | 'country'): SearchSegment[] =>
  [...statsBy(of(rows, dimension, 'current'), (r) => r.segment)]
    .map(([key, stats]) => ({ key, stats }))
    .sort((a, b) => b.stats.clicks - a.stats.clicks || b.stats.impressions - a.stats.impressions)

/** The report from the stored rows: totals, ranked searches and pages, the two opportunity lists. */
export async function searchConsoleReport(
  tx: StoreTx,
  storeId: string,
  env: SearchConsoleEnv,
): Promise<SearchConsoleReport> {
  const entryRow = await loadSearchConsoleEntry(tx, storeId)
  if (!entryRow.installed) return { state: 'not-installed' }
  const settings = parseSearchConsoleSettings(entryRow.settings)
  if (!settings.refreshToken) return { state: 'not-connected', available: env.app !== null }
  if (!settings.property) return { state: 'no-property', reconnect: settings.reconnect }
  const rows = await loadSearchConsoleRows(tx, storeId, [
    'total',
    'page',
    'query',
    'page_query',
    'device',
    'country',
  ])
  if (rows.length === 0) {
    return { state: 'pending', lastError: settings.lastError, reconnect: settings.reconnect }
  }

  const byPath = (period: SearchRow['period']) => statsBy(of(rows, 'page', period), (r) => r.path)
  const byQuery = (period: SearchRow['period']) =>
    statsBy(of(rows, 'query', period), (r) => r.query)
  const pagesNow = byPath('current')
  const pagesBefore = byPath('previous')
  const details = pageDetails(rows)
  const items = await searchItemsByPath(tx, [
    ...new Set([...pagesNow.keys(), ...pagesBefore.keys()]),
  ])
  const page = (c: SearchCompare): SearchPageEntry => ({
    ...entry(c),
    url: details.url.get(c.key)?.page ?? c.key,
    item: items.get(c.key) ?? null,
    topQuery: details.topQuery.get(c.key)?.query ?? null,
  })

  return {
    state: 'ready',
    view: searchConsoleView(settings, env.app !== null),
    totals: {
      current: sumStats(of(rows, 'total', 'current')),
      previous: sumStats(of(rows, 'total', 'previous')),
    },
    queries: compareStats(byQuery('current'), byQuery('previous')).slice(0, LIST_MAX).map(entry),
    pages: compareStats(pagesNow, pagesBefore).slice(0, LIST_MAX).map(page),
    almostPageOne: almostPageOne(pagesNow)
      .slice(0, OPPORTUNITY_MAX)
      .map(([key, current]) =>
        page({
          key,
          current,
          previous: pagesBefore.get(key) ?? EMPTY_STATS,
          clickDelta: current.clicks - (pagesBefore.get(key)?.clicks ?? 0),
        }),
      ),
    losingPages: losingTraffic(pagesNow, pagesBefore).slice(0, OPPORTUNITY_MAX).map(page),
    losingQueries: losingTraffic(byQuery('current'), byQuery('previous'))
      .slice(0, OPPORTUNITY_MAX)
      .map(entry),
    devices: segments(rows, 'device'),
    countries: segments(rows, 'country'),
  }
}

/** The product page's "Google search" card. */
export type ProductSearchCard =
  | { state: 'hidden' }
  | { state: 'not-connected' }
  | {
      state: 'ready'
      stats: NonNullable<Awaited<ReturnType<typeof searchStatsForProduct>>>
      clickChange: number | null
      syncedAt: string | null
    }

export async function productSearchCard(
  tx: StoreTx,
  storeId: string,
  productId: string,
): Promise<ProductSearchCard> {
  const entryRow = await loadSearchConsoleEntry(tx, storeId)
  if (!entryRow.installed) return { state: 'hidden' }
  const settings = parseSearchConsoleSettings(entryRow.settings)
  const stats = await searchStatsForProduct(tx, storeId, productId)
  if (!stats) return settings.refreshToken ? { state: 'hidden' } : { state: 'not-connected' }
  return {
    state: 'ready',
    stats,
    clickChange: percentChange(stats.current.clicks, stats.previous.clicks),
    syncedAt: settings.syncedAt || null,
  }
}
