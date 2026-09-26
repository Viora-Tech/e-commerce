import { api } from '@/lib/api-client'
import {
  articleHref,
  collectionHref,
  type LinkKind,
  type LinkTarget,
  pageHref,
  productHref,
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

async function pages(query: string): Promise<LinkTarget[]> {
  const all = await once('page', async () =>
    (await api.pages.list()).map((p) => ({
      kind: 'page' as const,
      id: p.id,
      title: p.title,
      href: pageHref(p.handle),
    })),
  )
  return all.filter((t) => matches(t.title, query))
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
  return found.find((t) => t.href === href) ?? null
}
