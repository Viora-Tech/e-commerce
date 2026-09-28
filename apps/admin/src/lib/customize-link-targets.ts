import { api } from '@/lib/api-client'
import {
  articleHref,
  collectionHref,
  isPolicyHandle,
  LINK_KINDS,
  type LinkKind,
  type LinkTarget,
  pageHref,
  parseRecentLinks,
  productHref,
  pushRecentLink,
  type RecentLink,
} from './customize-links'

/**
 * What the link picker lists for each tab, through the admin's own list
 * endpoints. Collections and pages are small and fetched whole once per
 * editor session (then filtered locally); products and blog posts search on
 * the server so a big catalogue never has to load in full.
 */
const cache = new Map<string, Promise<LinkTarget[]>>()

const once = (key: string, load: () => Promise<LinkTarget[]>): Promise<LinkTarget[]> => {
  const hit = cache.get(key)
  if (hit) return hit
  const next = load().catch((err) => {
    cache.delete(key)
    throw err
  })
  cache.set(key, next)
  return next
}

const matches = (title: string, query: string) =>
  title.toLowerCase().includes(query.trim().toLowerCase())

async function products(query: string): Promise<LinkTarget[]> {
  const q = query.trim()
  return once(`product:${q}`, async () => {
    const r = await api.products.list({ page: 1, perPage: 30, ...(q ? { search: q } : {}) })
    return r.items.map((p) => ({
      kind: 'product' as const,
      id: p.id,
      title: p.title,
      href: productHref(p.handle),
      imageUrl: p.imageUrl,
    }))
  })
}

async function collections(query: string): Promise<LinkTarget[]> {
  const all = await once('collection', async () =>
    (await api.collections.list()).map((c) => ({
      kind: 'collection' as const,
      id: c.id,
      title: c.title,
      href: collectionHref(c.handle),
      imageUrl: c.imageUrl,
    })),
  )
  return all.filter((t) => matches(t.title, query))
}

/** Every store page once per session; split into Pages and Policies by handle. */
const allPages = () =>
  once('page', async () =>
    (await api.pages.list()).map((p) => ({
      kind: isPolicyHandle(p.handle) ? ('policy' as const) : ('page' as const),
      id: p.id,
      title: p.title,
      href: pageHref(p.handle),
    })),
  )

async function pages(query: string): Promise<LinkTarget[]> {
  return (await allPages()).filter((t) => t.kind === 'page' && matches(t.title, query))
}

async function policies(query: string): Promise<LinkTarget[]> {
  return (await allPages()).filter((t) => t.kind === 'policy' && matches(t.title, query))
}

async function articles(query: string): Promise<LinkTarget[]> {
  const q = query.trim()
  return once(`article:${q}`, async () => {
    const r = await api.blog.list({
      page: 1,
      perPage: 30,
      status: 'all',
      ...(q ? { query: q } : {}),
    })
    return r.rows.map((a) => ({
      kind: 'article' as const,
      id: a.id,
      title: a.title,
      href: articleHref(a.blogHandle, a.handle),
      imageUrl: a.imageUrl,
    }))
  })
}

const LOADERS: Record<LinkKind, (query: string) => Promise<LinkTarget[]>> = {
  product: products,
  collection: collections,
  page: pages,
  article: articles,
  policy: policies,
}

/** Targets of one kind matching `query` (blank lists the first page). */
export function searchLinkTargets(kind: LinkKind, query: string): Promise<LinkTarget[]> {
  return LOADERS[kind](query)
}

/** The listed target a stored href points at, for showing its title in the field. */
export async function findLinkTarget(
  kind: LinkKind,
  handle: string,
  href: string,
): Promise<LinkTarget | null> {
  const found = await LOADERS[kind](kind === 'product' || kind === 'article' ? handle : '')
  // A policy saved before it had its own route is stored as /pages/<handle>.
  return (
    found.find((t) => t.href === href || (kind === 'policy' && t.href === pageHref(handle))) ?? null
  )
}

/** How many rows each kind shows in the combined (top-level) search. */
const PER_KIND = 4

export type GroupedTargets = { kind: LinkKind; items: LinkTarget[] }[]

/**
 * The top-level search: every kind at once, a few rows each, in the picker's
 * order. A kind that fails to load is left out rather than failing the rest.
 */
export async function searchAllLinkTargets(query: string): Promise<GroupedTargets> {
  const settled = await Promise.allSettled(LINK_KINDS.map((kind) => LOADERS[kind](query)))
  return LINK_KINDS.map((kind, i) => {
    const result = settled[i]
    const items = result?.status === 'fulfilled' ? result.value.slice(0, PER_KIND) : []
    return { kind, items }
  }).filter((g) => g.items.length > 0)
}

const RECENT_KEY = 'customize.link.recent'

/** The merchant's recent link picks in this browser (a convenience; empty when storage is blocked). */
export function readRecentLinks(): RecentLink[] {
  try {
    return parseRecentLinks(window.localStorage.getItem(RECENT_KEY))
  } catch {
    return []
  }
}

/** Remembers a pick at the top of the recent list. */
export function rememberLink(pick: RecentLink): void {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(pushRecentLink(readRecentLinks(), pick)))
  } catch {
    // Private mode or blocked storage: recents are optional.
  }
}
