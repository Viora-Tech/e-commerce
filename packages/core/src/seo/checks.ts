/** SOURCE OF TRUTH: the SEO report's rules — WHAT: the checks run over each live product, collection, page and menu (search title and description length, duplicates, image alt text, thin text, Google Shopping data, handles, empty collections, broken internal links and links to the old Shopify store) and the 0–100 score they add up to / WHY: one place decides what "good SEO" means for the report, the score and the "Fix with AI" list, so they never disagree. Pure: no database */

import { linkTarget, pathExists } from './links'

/** What Google shows before cutting a title or description off (characters, roughly). */
export const SEO_LIMITS = {
  titleMax: 60,
  titleMin: 15,
  descriptionMax: 160,
  descriptionMin: 70,
  /** Below this many words a product page gives search engines (and AI search) little to go on. */
  thinWords: 50,
  /** A page is thin under this many words. */
  thinPageWords: 80,
  handleMax: 70,
} as const

export type SeoResource = 'product' | 'collection' | 'page' | 'menu'
export type SeoSeverity = 'high' | 'medium' | 'low'

export type SeoIssueKind =
  | 'title_missing'
  | 'title_long'
  | 'title_short'
  | 'title_duplicate'
  | 'description_missing'
  | 'description_long'
  | 'description_short'
  | 'description_duplicate'
  | 'image_missing'
  | 'alt_missing'
  | 'content_thin'
  | 'shopping_brand_missing'
  | 'shopping_gtin_missing'
  | 'handle_bad'
  | 'link_broken'
  | 'link_old_store'
  | 'collection_empty'
  | 'collection_image_missing'
  | 'category_missing'
  | 'page_thin'

/** Each kind's weight: how much one occurrence costs the score, and which AI field fixes it. */
export const SEO_RULES: Record<
  SeoIssueKind,
  { severity: SeoSeverity; fixWithAi: 'seo' | 'altText' | 'description' | null }
> = {
  title_missing: { severity: 'high', fixWithAi: 'seo' },
  description_missing: { severity: 'high', fixWithAi: 'seo' },
  image_missing: { severity: 'high', fixWithAi: null },
  title_duplicate: { severity: 'medium', fixWithAi: 'seo' },
  title_long: { severity: 'medium', fixWithAi: 'seo' },
  alt_missing: { severity: 'medium', fixWithAi: 'altText' },
  content_thin: { severity: 'medium', fixWithAi: 'description' },
  title_short: { severity: 'low', fixWithAi: 'seo' },
  description_long: { severity: 'low', fixWithAi: 'seo' },
  description_short: { severity: 'low', fixWithAi: 'seo' },
  description_duplicate: { severity: 'low', fixWithAi: 'seo' },
  shopping_brand_missing: { severity: 'low', fixWithAi: null },
  shopping_gtin_missing: { severity: 'low', fixWithAi: null },
  handle_bad: { severity: 'low', fixWithAi: null },
  link_broken: { severity: 'medium', fixWithAi: null },
  link_old_store: { severity: 'medium', fixWithAi: null },
  collection_empty: { severity: 'medium', fixWithAi: null },
  collection_image_missing: { severity: 'low', fixWithAi: null },
  category_missing: { severity: 'low', fixWithAi: null },
  page_thin: { severity: 'low', fixWithAi: null },
}

const SEVERITY_POINTS: Record<SeoSeverity, number> = { high: 10, medium: 4, low: 1 }

/** One live item as the checks see it. */
export type SeoItem = {
  resource: SeoResource
  id: string
  title: string
  handle: string
  seoTitle: string | null
  seoDescription: string | null
  /** The item's own text (description or page body), plain. */
  bodyText: string
  /** Products only. */
  imageCount?: number | undefined
  imagesWithoutAlt?: number | undefined
  vendor?: string | null | undefined
  hasBarcode?: boolean | undefined
  hasCategory?: boolean | undefined
  /** Collections only. */
  productCount?: number | undefined
  hasImage?: boolean | undefined
  /** Link URLs inside the item's text, as stored. */
  links?: readonly string[] | undefined
}

/** One menu entry that points at a path inside the store. */
export type SeoMenuLink = { menuId: string; menuTitle: string; itemTitle: string; url: string }

/** What the link checks compare against: paths that exist (or redirect) and the store's hosts. */
export type SeoLinkContext = {
  knownPaths: ReadonlySet<string>
  storeHosts: ReadonlySet<string>
  menus: readonly SeoMenuLink[]
}

const NO_LINKS: SeoLinkContext = { knownPaths: new Set(), storeHosts: new Set(), menus: [] }

export type SeoIssue = {
  kind: SeoIssueKind
  severity: SeoSeverity
  resource: SeoResource
  id: string
  title: string
  /** e.g. the length, the count of photos without alt text, or the other item's title. */
  detail: string | null
}

export type SeoReport = {
  score: number
  checked: Record<SeoResource, number>
  issues: SeoIssue[]
  /** Products whose issues "Fix with AI" can write, by field. */
  fixable: { seo: string[]; altText: string[]; description: string[] }
}

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** What a search engine shows as the title: the SEO title, else the item's own title. */
export function effectiveTitle(item: Pick<SeoItem, 'seoTitle' | 'title'>): string {
  return (item.seoTitle?.trim() || item.title.trim()).replace(/\s+/g, ' ')
}

/** What it shows as the description: the SEO description, else the start of the body text. */
export function effectiveDescription(item: Pick<SeoItem, 'seoDescription' | 'bodyText'>): string {
  return (item.seoDescription?.trim() || item.bodyText.trim()).replace(/\s+/g, ' ')
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

/** The issues of one item on its own (duplicates need the whole set: see `seoReport`). */
export function itemIssues(item: SeoItem): SeoIssue[] {
  const out: SeoIssue[] = []
  const add = (kind: SeoIssueKind, detail: string | null = null) =>
    out.push({
      kind,
      severity: SEO_RULES[kind].severity,
      resource: item.resource,
      id: item.id,
      title: item.title,
      detail,
    })

  const title = effectiveTitle(item)
  if (!title) add('title_missing')
  else if (title.length > SEO_LIMITS.titleMax) add('title_long', String(title.length))
  else if (title.length < SEO_LIMITS.titleMin) add('title_short', String(title.length))

  const description = effectiveDescription(item)
  if (!description) add('description_missing')
  else if (item.seoDescription?.trim()) {
    // Only a description the merchant wrote is judged on length: a body excerpt is cut by Google.
    const n = description.length
    if (n > SEO_LIMITS.descriptionMax) add('description_long', String(n))
    else if (n < SEO_LIMITS.descriptionMin) add('description_short', String(n))
  }

  if (!HANDLE.test(item.handle) || item.handle.length > SEO_LIMITS.handleMax) {
    add('handle_bad', item.handle)
  }

  if (item.resource === 'product') {
    if (!item.imageCount) add('image_missing')
    else if (item.imagesWithoutAlt) add('alt_missing', String(item.imagesWithoutAlt))
    const words = wordCount(item.bodyText)
    if (words < SEO_LIMITS.thinWords) add('content_thin', String(words))
    if (!item.vendor?.trim()) add('shopping_brand_missing')
    if (!item.hasBarcode) add('shopping_gtin_missing')
    if (item.hasCategory === false) add('category_missing')
  }
  if (item.resource === 'collection') {
    if (item.productCount === 0) add('collection_empty')
    if (item.hasImage === false) add('collection_image_missing')
  }
  if (item.resource === 'page') {
    const words = wordCount(item.bodyText)
    if (words < SEO_LIMITS.thinPageWords) add('page_thin', String(words))
  }
  return out
}

/** Broken internal links and links to the old Shopify store, in item text and in menus. */
function linkIssues(items: readonly SeoItem[], ctx: SeoLinkContext): SeoIssue[] {
  const out: SeoIssue[] = []
  const check = (
    url: string,
    at: Pick<SeoIssue, 'resource' | 'id' | 'title'>,
    label: (detail: string) => string,
  ) => {
    const target = linkTarget(url, ctx.storeHosts)
    if (target.kind === 'old_store') {
      out.push({ kind: 'link_old_store', severity: 'medium', ...at, detail: label(target.url) })
    } else if (target.kind === 'internal' && !pathExists(target.path, ctx.knownPaths)) {
      out.push({ kind: 'link_broken', severity: 'medium', ...at, detail: label(target.path) })
    }
  }
  for (const item of items) {
    const seen = new Set<string>()
    for (const url of item.links ?? []) {
      if (seen.has(url)) continue
      seen.add(url)
      check(url, { resource: item.resource, id: item.id, title: item.title }, (d) => d)
    }
  }
  for (const m of ctx.menus) {
    check(
      m.url,
      { resource: 'menu', id: m.menuId, title: m.menuTitle },
      (d) => `${m.itemTitle} → ${d}`,
    )
  }
  return out
}

/** Items of one kind sharing the same text, each told which other item it clashes with. */
function duplicates(
  items: readonly SeoItem[],
  text: (item: SeoItem) => string,
  kind: SeoIssueKind,
): SeoIssue[] {
  const byText = new Map<string, SeoItem[]>()
  for (const item of items) {
    const key = text(item).toLowerCase()
    if (!key) continue
    byText.set(key, [...(byText.get(key) ?? []), item])
  }
  return [...byText.values()]
    .filter((group) => group.length > 1)
    .flatMap((group) =>
      group.map((item) => ({
        kind,
        severity: SEO_RULES[kind].severity,
        resource: item.resource,
        id: item.id,
        title: item.title,
        detail: group.find((other) => other.id !== item.id)?.title ?? null,
      })),
    )
}

const SEVERITY_ORDER: Record<SeoSeverity, number> = { high: 0, medium: 1, low: 2 }

/**
 * The whole report. The score starts at 100 and loses points per issue, scaled by how many
 * items were checked, so a big catalogue with a few gaps still scores well and a small one with
 * the same gaps does not.
 */
export function seoReport(items: readonly SeoItem[], links: SeoLinkContext = NO_LINKS): SeoReport {
  const issues = [...items.flatMap(itemIssues), ...linkIssues(items, links)]
  for (const resource of ['product', 'collection', 'page'] as const) {
    const ofKind = items.filter((i) => i.resource === resource)
    issues.push(...duplicates(ofKind, effectiveTitle, 'title_duplicate'))
    issues.push(
      ...duplicates(ofKind, (i) => i.seoDescription?.trim() ?? '', 'description_duplicate'),
    )
  }
  issues.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.title.localeCompare(b.title),
  )

  const lost = issues.reduce((sum, issue) => sum + SEVERITY_POINTS[issue.severity], 0)
  const worst = Math.max(1, items.length) * SEVERITY_POINTS.high
  const score = items.length === 0 ? 100 : Math.max(0, Math.round(100 - (lost / worst) * 100))

  const fixable = {
    seo: new Set<string>(),
    altText: new Set<string>(),
    description: new Set<string>(),
  }
  for (const issue of issues) {
    const field = SEO_RULES[issue.kind].fixWithAi
    if (field && issue.resource === 'product') fixable[field].add(issue.id)
  }
  return {
    score,
    checked: {
      product: items.filter((i) => i.resource === 'product').length,
      collection: items.filter((i) => i.resource === 'collection').length,
      page: items.filter((i) => i.resource === 'page').length,
      menu: new Set(links.menus.map((m) => m.menuId)).size,
    },
    issues,
    fixable: {
      seo: [...fixable.seo],
      altText: [...fixable.altText],
      description: [...fixable.description],
    },
  }
}

/** Plain words out of stored rich text (Lexical JSON) or a legacy plain string. */
export function seoBodyText(value: unknown): string {
  if (typeof value === 'string') return value
  const out: string[] = []
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { text?: unknown; children?: unknown; root?: unknown }
    if (typeof n.text === 'string') out.push(n.text)
    if (n.root) visit(n.root)
    if (Array.isArray(n.children)) for (const child of n.children) visit(child)
    out.push(' ')
  }
  visit(value)
  return out.join('').replace(/\s+/g, ' ').trim()
}
