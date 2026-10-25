/** SOURCE OF TRUTH: menu broken-link check
 * WHAT:  `menuLinkProblems` walks a menu (every level) and reports the items whose destination
 *        is gone (`missing`) or exists but shoppers cannot open it (`hidden`: a draft product,
 *        an unpublished page or post). Custom URLs that point inside the store
 *        (`/products/…`, `/collections/…`, `/pages/…`, `/blogs/…`, `/policies/…`) are checked
 *        the same way; outside links are not fetched. A missing destination that a redirect
 *        still catches says where it goes (`redirectTo`), so the merchant can fix the item.
 * WHY:   Menus store handles, not ids, so a deleted product or a renamed blog post silently
 *        leaves a dead link in the header.
 * WHERE: API `navigation.checkLinks`; admin menu editor (warning banner and per-row badge).
 */
import {
  article,
  blog,
  collection,
  type NavigationItem,
  type NavigationItemType,
  page,
  product,
  type StoreTx,
  urlRedirect,
} from '@commerce/db'
import { and, inArray, sql } from 'drizzle-orm'
import { isPolicyType } from '../policies/client'
import { normaliseRedirectPath } from '../redirects/paths'
import { itemPath } from './resolve'

export type MenuLinkProblem = {
  itemId: string
  title: string
  /** The public path the item points at. */
  path: string
  problem: 'missing' | 'hidden'
  /** For a missing destination that a redirect still sends somewhere. */
  redirectTo?: string | undefined
}

type Checkable = Extract<
  NavigationItemType,
  'product' | 'collection' | 'page' | 'blog' | 'article' | 'policy'
>

type Target = { itemId: string; title: string; path: string; kind: Checkable; value: string }

/** Path prefixes a custom URL may use to point inside the store. */
const INTERNAL: [RegExp, Checkable][] = [
  [/^\/products\/([^/?#]+)$/, 'product'],
  [/^\/collections\/([^/?#]+)$/, 'collection'],
  [/^\/pages\/([^/?#]+)$/, 'page'],
  [/^\/blogs\/([^/?#]+\/[^/?#]+)$/, 'article'],
  [/^\/blogs\/([^/?#]+)$/, 'blog'],
  [/^\/policies\/([^/?#]+)$/, 'policy'],
]

const CHECKABLE = new Set<NavigationItemType>([
  'product',
  'collection',
  'page',
  'blog',
  'article',
  'policy',
])

/** What one item points at inside the store, or null (home, search, outside links...). */
export function linkTarget(item: NavigationItem): Omit<Target, 'itemId' | 'title'> | null {
  const path = itemPath(item.type, item.value)
  if (!path) return null
  if (CHECKABLE.has(item.type) && item.value) {
    return { path, kind: item.type as Checkable, value: item.value.trim() }
  }
  if (item.type !== 'url' || !path.startsWith('/')) return null
  const clean = normaliseRedirectPath(path)
  for (const [re, kind] of INTERNAL) {
    const m = clean.match(re)
    // `/collections/all` is the all-products page, not a collection handle.
    if (m?.[1] && !(kind === 'collection' && m[1] === 'all')) {
      return { path, kind, value: m[1] }
    }
  }
  return null
}

function collect(items: readonly NavigationItem[], out: Target[]): Target[] {
  for (const item of items) {
    const t = linkTarget(item)
    if (t) out.push({ ...t, itemId: item.id, title: item.title })
    collect(item.children ?? [], out)
  }
  return out
}

const values = (targets: Target[], kind: Checkable) => [
  ...new Set(targets.filter((t) => t.kind === kind).map((t) => t.value)),
]

/** Handle → live, for one kind; absent handles are missing. */
async function states(tx: StoreTx, targets: Target[]): Promise<Map<string, boolean>> {
  const live = new Map<string, boolean>()
  const key = (kind: Checkable, value: string) => `${kind}:${value.toLowerCase()}`
  const products = values(targets, 'product')
  if (products.length) {
    const rows = await tx
      .select({ handle: product.handle, status: product.status })
      .from(product)
      .where(inArray(product.handle, products))
    for (const r of rows) live.set(key('product', r.handle), r.status === 'active')
  }
  const collections = values(targets, 'collection')
  if (collections.length) {
    const rows = await tx
      .select({ handle: collection.handle, status: collection.status })
      .from(collection)
      .where(inArray(collection.handle, collections))
    for (const r of rows) live.set(key('collection', r.handle), r.status === 'active')
  }
  // A policy is a page with a fixed handle.
  const pages = [
    ...values(targets, 'page'),
    ...values(targets, 'policy').filter((v) => isPolicyType(v)),
  ]
  if (pages.length) {
    const rows = await tx
      .select({ handle: page.handle, publishedAt: page.publishedAt })
      .from(page)
      .where(inArray(page.handle, pages))
    for (const r of rows) {
      live.set(key('page', r.handle), r.publishedAt !== null)
      live.set(key('policy', r.handle), r.publishedAt !== null)
    }
  }
  const blogs = [
    ...values(targets, 'blog'),
    ...values(targets, 'article').map((v) => v.split('/')[0] ?? ''),
  ].filter(Boolean)
  if (blogs.length) {
    const rows = await tx
      .select({ id: blog.id, handle: blog.handle })
      .from(blog)
      .where(inArray(blog.handle, [...new Set(blogs)]))
    for (const r of rows) live.set(key('blog', r.handle), true)
    const articles = values(targets, 'article')
    if (articles.length && rows.length) {
      const posts = await tx
        .select({
          blogHandle: blog.handle,
          handle: article.handle,
          live: sql<boolean>`(${article.status} = 'published' or (${article.status} = 'scheduled' and ${article.publishedAt} <= now()))`,
        })
        .from(article)
        .innerJoin(blog, sql`${blog.id} = ${article.blogId}`)
        .where(
          and(
            inArray(
              article.blogId,
              rows.map((r) => r.id),
            ),
            inArray(
              article.handle,
              articles.map((v) => v.split('/')[1] ?? ''),
            ),
          ),
        )
      for (const p of posts) live.set(key('article', `${p.blogHandle}/${p.handle}`), p.live)
    }
  }
  return live
}

/**
 * Problems in one menu's items, in menu order. Nothing is reported for home, search, all
 * collections or outside links.
 */
export async function menuLinkProblems(
  tx: StoreTx,
  items: readonly NavigationItem[],
): Promise<MenuLinkProblem[]> {
  const targets = collect(items, [])
  if (targets.length === 0) return []
  const live = await states(tx, targets)
  const problems: MenuLinkProblem[] = []
  for (const t of targets) {
    const known =
      t.kind === 'policy' && !isPolicyType(t.value)
        ? undefined
        : live.get(`${t.kind}:${t.value.toLowerCase()}`)
    if (known === true) continue
    problems.push({
      itemId: t.itemId,
      title: t.title,
      path: t.path,
      problem: known === false ? 'hidden' : 'missing',
    })
  }
  const missing = problems.filter((p) => p.problem === 'missing')
  if (missing.length) {
    const paths = [...new Set(missing.map((p) => normaliseRedirectPath(p.path)))]
    const redirects = await tx
      .select({ path: urlRedirect.path, target: urlRedirect.target })
      .from(urlRedirect)
      .where(inArray(urlRedirect.path, paths))
    const to = new Map(redirects.map((r) => [r.path, r.target]))
    for (const p of missing) p.redirectTo = to.get(normaliseRedirectPath(p.path))
  }
  return problems
}
