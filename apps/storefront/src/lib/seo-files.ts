import 'server-only'
import { blogSitemapEntries } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { collection, page, product, variant } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import { and, asc, eq, isNotNull, isNull, min } from 'drizzle-orm'
import { LLMS_PRODUCT_LIMIT, ROBOTS_DISALLOW, seoContent } from '@/data/seo'

/** One indexable URL on the store's host. */
export type IndexEntry = { path: string; title?: string; updatedAt?: Date | null }

export type StoreIndex = {
  products: (IndexEntry & { title: string; fromPaise: number | null })[]
  collections: (IndexEntry & { title: string })[]
  pages: (IndexEntry & { title: string })[]
  blog: IndexEntry[]
}

/** Everything a shopper can reach and a crawler may index: active and published only. */
export async function loadStoreIndex(tx: StoreTx): Promise<StoreIndex> {
  const [products, collections, pages, blog] = await Promise.all([
    tx
      .select({
        handle: product.handle,
        title: product.title,
        updatedAt: product.updatedAt,
        fromPaise: min(variant.pricePaise),
      })
      .from(product)
      .leftJoin(variant, and(eq(variant.productId, product.id), isNull(variant.archivedAt)))
      .where(eq(product.status, 'active'))
      .groupBy(product.id)
      .orderBy(asc(product.title)),
    tx
      .select({
        handle: collection.handle,
        title: collection.title,
        updatedAt: collection.updatedAt,
      })
      .from(collection)
      .where(eq(collection.status, 'active'))
      .orderBy(asc(collection.title)),
    tx
      .select({ handle: page.handle, title: page.title, updatedAt: page.updatedAt })
      .from(page)
      .where(isNotNull(page.publishedAt))
      .orderBy(asc(page.title)),
    blogSitemapEntries(tx),
  ])
  return {
    products: products.map((p) => ({
      path: `/products/${p.handle}`,
      title: p.title,
      updatedAt: p.updatedAt,
      fromPaise: p.fromPaise,
    })),
    collections: collections.map((c) => ({
      path: `/collections/${c.handle}`,
      title: c.title,
      updatedAt: c.updatedAt,
    })),
    pages: pages.map((p) => ({
      path: `/pages/${p.handle}`,
      title: p.title,
      updatedAt: p.updatedAt,
    })),
    blog,
  }
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

function xml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => XML_ESCAPES[c] ?? c)
}

/** sitemaps.org urlset. Handles are URL-safe already; the whole URL is still escaped. */
export function sitemapXml(origin: string, index: StoreIndex): string {
  const entries: IndexEntry[] = [
    { path: '/' },
    { path: '/collections' },
    ...index.collections,
    ...index.products,
    ...index.pages,
    ...index.blog,
  ]
  const urls = entries.map((e) => {
    const lastmod = e.updatedAt ? `<lastmod>${e.updatedAt.toISOString()}</lastmod>` : ''
    return `<url><loc>${xml(`${origin}${e.path}`)}</loc>${lastmod}</url>`
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
  ].join('\n')
}

/** An empty urlset: what a locked store's sitemap says. */
export function emptySitemapXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '</urlset>',
  ].join('\n')
}

/**
 * robots.txt. Every crawler, search and AI alike, may read the catalogue; carts,
 * checkout, accounts, on-site search and sort permutations stay out. A locked store
 * (password page on) asks everyone to stay away entirely.
 */
export function robotsTxt(origin: string, locked: boolean): string {
  if (locked) return ['User-agent: *', 'Disallow: /', ''].join('\n')
  return [
    'User-agent: *',
    'Allow: /',
    ...ROBOTS_DISALLOW.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')
}

/** Markdown bullet, keeping a title from breaking the list or the link syntax. */
function bullet(origin: string, e: IndexEntry, note?: string): string {
  const title = (e.title ?? e.path).replace(/[[\]\s]+/g, ' ').trim()
  return `- [${title}](${origin}${e.path})${note ? `: ${note}` : ''}`
}

/**
 * llms.txt (llmstxt.org): a plain Markdown map of the store for AI assistants and
 * answer engines. Title, one-line summary, then the store's sections as link lists.
 */
export function llmsTxt(
  origin: string,
  store: { name: string; description: string },
  index: StoreIndex,
): string {
  const copy = seoContent.llms
  const shown = index.products.slice(0, LLMS_PRODUCT_LIMIT)
  const hidden = index.products.length - shown.length
  const section = (heading: string, lines: string[]) =>
    lines.length ? [`## ${heading}`, '', ...lines, ''] : []
  return [
    `# ${store.name}`,
    '',
    ...(store.description ? [`> ${store.description.replace(/\s+/g, ' ')}`, ''] : []),
    ...section(
      copy.collections,
      index.collections.map((c) => bullet(origin, c)),
    ),
    ...section(copy.products, [
      ...shown.map((p) =>
        bullet(origin, p, p.fromPaise === null ? undefined : copy.price(formatMoney(p.fromPaise))),
      ),
      ...(hidden > 0 ? [copy.more(hidden)] : []),
    ]),
    ...section(
      copy.pages,
      index.pages.map((p) => bullet(origin, p)),
    ),
    ...section(
      copy.blog,
      index.blog.map((b) => bullet(origin, b)),
    ),
    `## ${copy.sitemap}`,
    '',
    `- [sitemap.xml](${origin}/sitemap.xml)`,
    '',
  ].join('\n')
}
