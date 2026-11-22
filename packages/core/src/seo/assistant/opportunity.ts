/** SOURCE OF TRUTH: SEO assistant opportunity rules — WHAT: how much a product, collection or page stands to win on Google (impressions weighted by how close its position is to the top, best between 4 and 15), and the assistant's rows: each item's Google numbers, its top searches, its current search title and description, and its gaps from the SEO report / WHY: the assistant page, "Fix with AI" and the weekly SEO email rank the same way. Pure and client-safe: no database */
import { EMPTY_STATS, type SearchStats } from '../../search-console/insights'
import type { SeoIssueKind, SeoResource } from '../checks'

/** Positions where a better title and description move a page most: page one, not the top. */
export const OPPORTUNITY_BAND = { minPosition: 4, maxPosition: 15 } as const

/** Fewer impressions than this and a page is not worth ranking yet. */
export const OPPORTUNITY_MIN_IMPRESSIONS = 10

/** Most rows the assistant page lists. */
export const SEO_ASSISTANT_MAX_ROWS = 200

/** Top searches shown per row and handed to the AI writer. */
export const SEO_ASSISTANT_TOP_QUERIES = 5

/** Gaps that make the opportunity bigger: Google is showing a title or description that is weak. */
const SNIPPET_GAPS: ReadonlySet<SeoIssueKind> = new Set([
  'title_missing',
  'title_long',
  'title_short',
  'title_duplicate',
  'description_missing',
  'description_long',
  'description_short',
  'description_duplicate',
  'low_ctr',
])

/**
 * How much a position is worth working on, 0 to 1. Inside the band (4–15) it is 1 at the edge
 * of the top three and slides to 0.6 at 15: closer to the top moves further for the same work.
 * Already in the top three: little left to win. Past 15 it drops fast; past 30, almost nothing.
 */
export function positionWeight(position: number): number {
  if (!Number.isFinite(position) || position <= 0) return 0
  if (position < OPPORTUNITY_BAND.minPosition) return 0.25
  if (position <= OPPORTUNITY_BAND.maxPosition) {
    const span = OPPORTUNITY_BAND.maxPosition - OPPORTUNITY_BAND.minPosition
    return 1 - (0.4 * (position - OPPORTUNITY_BAND.minPosition)) / span
  }
  if (position <= 30) return 0.2
  return 0.05
}

export const inOpportunityBand = (position: number): boolean =>
  position >= OPPORTUNITY_BAND.minPosition && position <= OPPORTUNITY_BAND.maxPosition

/**
 * One item's opportunity: impressions times `positionWeight`, a quarter more when its search
 * title or description has a gap (that is what "Fix with AI" rewrites). Whole numbers; 0 below
 * `OPPORTUNITY_MIN_IMPRESSIONS`.
 */
export function opportunityScore(stats: SearchStats, gaps: readonly SeoIssueKind[] = []): number {
  if (stats.impressions < OPPORTUNITY_MIN_IMPRESSIONS) return 0
  const boost = gaps.some((g) => SNIPPET_GAPS.has(g)) ? 1.25 : 1
  return Math.round(stats.impressions * positionWeight(stats.position) * boost)
}

/** A resource the assistant can rewrite: menus have no search listing. */
export type SeoAssistantResource = Exclude<SeoResource, 'menu'>

/** One search behind a page, with its numbers. */
export type SeoAssistantQuery = { query: string } & SearchStats

/** One row on the assistant page. */
export type SeoAssistantRow = {
  resource: SeoAssistantResource
  id: string
  title: string
  handle: string
  /** `/products/<handle>` and so on, as Google's pages are matched. */
  path: string
  seoTitle: string | null
  seoDescription: string | null
  /** Last 28 days, and the 28 before. */
  current: SearchStats
  previous: SearchStats
  queries: SeoAssistantQuery[]
  /** The SEO report's issue kinds for this item, most important first. */
  gaps: SeoIssueKind[]
  /** Each gap's detail (a length, a count, the other item's title), in the same order. */
  gapDetails: (string | null)[]
  opportunity: number
  inBand: boolean
}

/** What the rows are built from: a live item, its gaps, and its Google numbers. */
export type SeoAssistantSource = {
  resource: SeoAssistantResource
  id: string
  title: string
  handle: string
  seoTitle: string | null
  seoDescription: string | null
  gaps: SeoIssueKind[]
  gapDetails?: (string | null)[] | undefined
}

export const assistantPath = (resource: SeoAssistantResource, handle: string): string =>
  `/${resource === 'product' ? 'products' : resource === 'collection' ? 'collections' : 'pages'}/${handle.toLowerCase()}`

/**
 * The assistant's rows: every item Google showed, biggest opportunity first (then impressions),
 * capped at `SEO_ASSISTANT_MAX_ROWS`. Items Google never showed are left out: with no searches
 * there is nothing to ground a rewrite in.
 */
export function assistantRows(
  items: readonly SeoAssistantSource[],
  search: {
    current: ReadonlyMap<string, SearchStats>
    previous: ReadonlyMap<string, SearchStats>
    queries: ReadonlyMap<string, readonly SeoAssistantQuery[]>
  },
): SeoAssistantRow[] {
  const rows: SeoAssistantRow[] = []
  for (const item of items) {
    const path = assistantPath(item.resource, item.handle)
    const current = search.current.get(path)
    if (!current || current.impressions === 0) continue
    rows.push({
      ...item,
      gapDetails: item.gapDetails ?? item.gaps.map(() => null),
      path,
      current,
      previous: search.previous.get(path) ?? EMPTY_STATS,
      queries: [...(search.queries.get(path) ?? [])]
        .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)
        .slice(0, SEO_ASSISTANT_TOP_QUERIES),
      opportunity: opportunityScore(current, item.gaps),
      inBand: inOpportunityBand(current.position),
    })
  }
  return rows
    .sort((a, b) => b.opportunity - a.opportunity || b.current.impressions - a.current.impressions)
    .slice(0, SEO_ASSISTANT_MAX_ROWS)
}
