/** SOURCE OF TRUTH: Settings → Store health › SEO — WHAT: counts, over the store's live products, active collections and published pages, the gaps that hurt search listings most (no search description, very short or duplicate titles, product photos without alt text, product handles left as "-copy" from duplicating) with the first few items of each / WHY: Store health shows one short SEO summary without the merchant opening the full SEO report; it reads the report's own rules (`seo/checks.ts`) so the two never disagree. Pure and client-safe: no database */
import { type SeoIssueKind, type SeoItem, seoReport } from '../seo/checks'

export const SEO_HEALTH_CHECK_IDS = [
  'description_missing',
  'title_short',
  'title_duplicate',
  'alt_missing',
  'handle_copy',
] as const
export type SeoHealthCheckId = (typeof SEO_HEALTH_CHECK_IDS)[number]

/** How many items of each check the card names; the rest are on the SEO report. */
export const SEO_HEALTH_SAMPLE = 5

export type SeoHealthResource = 'product' | 'collection' | 'page'

export type SeoHealthItem = { resource: SeoHealthResource; id: string; title: string }

export type SeoHealthCheck = {
  id: SeoHealthCheckId
  /** Items with the gap. */
  count: number
  /** `alt_missing` only: photos without alt text across those products. */
  images?: number | undefined
  /** The first `SEO_HEALTH_SAMPLE` of them, by title. */
  items: SeoHealthItem[]
}

export type SeoHealthReport = {
  checked: Record<SeoHealthResource, number>
  checks: SeoHealthCheck[]
  /** Checks with nothing to fix. */
  passed: number
  checkedAt: string
}

/** Which report issues feed each check ("very short" counts a missing title too). */
const FROM_REPORT: Record<Exclude<SeoHealthCheckId, 'handle_copy'>, readonly SeoIssueKind[]> = {
  description_missing: ['description_missing'],
  title_short: ['title_missing', 'title_short'],
  title_duplicate: ['title_duplicate'],
  alt_missing: ['alt_missing'],
}

/** A handle left by "Duplicate": `mouse-copy`, `mouse-copy-2`. */
const COPY_HANDLE = /-copy(?:-\d+)?$/

const byTitle = (a: SeoHealthItem, b: SeoHealthItem) => a.title.localeCompare(b.title)

const isHealthResource = (r: string): r is SeoHealthResource =>
  r === 'product' || r === 'collection' || r === 'page'

/** The SEO summary for Store health over the store's live items. */
export function seoHealth(items: readonly SeoItem[], now: Date = new Date()): SeoHealthReport {
  const { issues } = seoReport(items)
  const checks: SeoHealthCheck[] = SEO_HEALTH_CHECK_IDS.map((id) => {
    if (id === 'handle_copy') {
      const hits = items
        .filter((i) => i.resource === 'product' && COPY_HANDLE.test(i.handle.toLowerCase()))
        .map((i) => ({ resource: 'product' as const, id: i.id, title: i.title }))
        .sort(byTitle)
      return { id, count: hits.length, items: hits.slice(0, SEO_HEALTH_SAMPLE) }
    }
    const kinds = FROM_REPORT[id]
    const seen = new Map<string, SeoHealthItem>()
    let images = 0
    for (const issue of issues) {
      if (!kinds.includes(issue.kind) || !isHealthResource(issue.resource)) continue
      const key = `${issue.resource}:${issue.id}`
      if (seen.has(key)) continue
      seen.set(key, { resource: issue.resource, id: issue.id, title: issue.title })
      if (id === 'alt_missing') images += Number(issue.detail) || 0
    }
    const hits = [...seen.values()].sort(byTitle)
    return {
      id,
      count: hits.length,
      ...(id === 'alt_missing' ? { images } : {}),
      items: hits.slice(0, SEO_HEALTH_SAMPLE),
    }
  })
  const count = (r: SeoHealthResource) => items.filter((i) => i.resource === r).length
  return {
    checked: { product: count('product'), collection: count('collection'), page: count('page') },
    checks,
    passed: checks.filter((c) => c.count === 0).length,
    checkedAt: now.toISOString(),
  }
}
