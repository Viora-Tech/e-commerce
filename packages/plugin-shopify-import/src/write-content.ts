/** Collections, pages, blog articles, menus and redirects from the Admin API. */
import {
  type ArticleWrite,
  type CollectionWrite,
  createArticle,
  createBlog,
  createCollection,
  MenuItemsSchema,
  slugify,
  updateArticle,
  updateCollection,
  upsertImportedRedirect,
} from '@commerce/core'
import {
  article,
  blog,
  collection,
  type NavigationItem,
  navigationMenu,
  newId,
  page,
  product,
  type StoreTx,
} from '@commerce/db'
import { and, eq, inArray } from 'drizzle-orm'
import { htmlToRichText, htmlToText, type RichText, replaceImageSources } from './html'
import { errorMessage, findMapping, type ImportContext, saveMapping } from './runtime'
import type { ImportResource } from './schema'
import type { NArticle, NCollection, NMenu, NMenuItem, NPage, NRedirect } from './types'

const clip = (value: string | null, max: number) => (value ? value.slice(0, max) : null)
const handleOf = (h: string, fallback: string) => slugify(h) || fallback

/** Rich text with its inline images re-hosted. */
async function richText(ctx: ImportContext, html: string | null): Promise<RichText | null> {
  const { doc, images } = htmlToRichText(html)
  if (!doc) return null
  const urls = new Map<string, string>()
  for (const image of images) {
    try {
      const id = await ctx.media.host(image.src, image.alt || null)
      const url = id ? await ctx.media.urlOf(id) : null
      if (url) urls.set(image.src, url)
    } catch {
      // Leave the source URL in place.
    }
  }
  replaceImageSources(doc, urls)
  return doc
}

async function hostOne(
  ctx: ImportContext,
  resource: ImportResource,
  ref: string,
  image: { src: string; alt: string | null } | null,
): Promise<string | null> {
  if (!image) return null
  try {
    return await ctx.media.host(image.src, image.alt)
  } catch (err) {
    ctx.report.issue({ resource, ref, message: `Image was not copied: ${errorMessage(err)}` })
    return null
  }
}

/** Run one record through dry-run or write with the shared bookkeeping. */
async function upsert(
  ctx: ImportContext,
  resource: ImportResource,
  ref: string,
  title: string,
  find: (tx: StoreTx) => Promise<string | null>,
  write: (existing: string | null) => Promise<string>,
  detail?: string,
): Promise<string | null> {
  try {
    const existing = await ctx.inStore(find)
    if (ctx.dryRun) {
      ctx.report.count(resource, existing ? 'updated' : 'created')
      ctx.report.sample({
        resource,
        key: ref,
        title,
        action: existing ? 'update' : 'create',
        detail,
      })
      return existing
    }
    const id = await write(existing)
    ctx.report.count(resource, existing ? 'updated' : 'created')
    return id
  } catch (err) {
    ctx.report.count(resource, 'failed')
    ctx.report.issue({ resource, ref, message: errorMessage(err) })
    return null
  }
}

async function mappedOr(
  tx: StoreTx,
  resource: string,
  sourceId: string | null,
  table: typeof collection | typeof page | typeof navigationMenu,
  handle: string,
): Promise<string | null> {
  const mapped = await findMapping(tx, resource, sourceId)
  if (mapped) {
    const [row] = await tx.select({ id: table.id }).from(table).where(eq(table.id, mapped))
    if (row) return row.id
  }
  const [row] = await tx.select({ id: table.id }).from(table).where(eq(table.handle, handle))
  return row?.id ?? null
}

const SORTS: Record<string, CollectionWrite['sortOrder']> = {
  MANUAL: 'manual',
  ALPHA_ASC: 'title_asc',
  ALPHA_DESC: 'title_desc',
  PRICE_ASC: 'price_asc',
  PRICE_DESC: 'price_desc',
  CREATED_DESC: 'created_desc',
  BEST_SELLING: 'manual',
  CREATED: 'created_desc',
}

export async function writeCollection(ctx: ImportContext, c: NCollection) {
  const handle = handleOf(c.handle, 'collection')
  const automatic = c.rules !== null && c.unmappedRules.length === 0
  if (c.rules && c.unmappedRules.length) {
    ctx.report.issue({
      resource: 'collections',
      ref: c.handle,
      message: `Smart rules we cannot express (${c.unmappedRules.join(', ')}); imported as a manual collection with its current products`,
    })
  }
  return upsert(
    ctx,
    'collections',
    c.handle,
    c.title,
    (tx) => mappedOr(tx, 'collections', c.sourceId, collection, handle),
    async (existing) => {
      const imageMediaId = await hostOne(ctx, 'collections', c.handle, c.image)
      const description = await richText(ctx, c.bodyHtml)
      return ctx.inStore(async (tx) => {
        const productIds: string[] = []
        if (!automatic && c.productHandles.length) {
          const handles = [...new Set(c.productHandles.map((h) => handleOf(h, 'product')))]
          const rows = await tx
            .select({ id: product.id, handle: product.handle })
            .from(product)
            .where(inArray(product.handle, handles))
          const byHandle = new Map(rows.map((r) => [r.handle, r.id]))
          for (const h of handles) {
            const id = byHandle.get(h)
            if (id) productIds.push(id)
          }
        }
        const write: CollectionWrite = {
          title: c.title.slice(0, 200),
          handle,
          description: description as CollectionWrite['description'],
          imageMediaId,
          kind: automatic ? 'automatic' : 'manual',
          ...(automatic && c.rules ? { rules: c.rules } : {}),
          sortOrder: SORTS[c.sortOrder ?? ''] ?? 'manual',
          seoTitle: clip(c.seoTitle, 200),
          seoDescription: clip(c.seoDescription, 400),
          status: c.published ? 'active' : 'draft',
          ...(automatic ? {} : { productIds: productIds.slice(0, 500) }),
        }
        const id = existing ?? (await createCollection(tx, ctx.storeId, write))
        if (existing) await updateCollection(tx, ctx.storeId, existing, write)
        await saveMapping(tx, ctx.storeId, 'collections', c.sourceId ?? `handle:${c.handle}`, id)
        const [row] = await tx
          .select({ handle: collection.handle })
          .from(collection)
          .where(eq(collection.id, id))
        if (row && row.handle !== c.handle.toLowerCase()) {
          await upsertImportedRedirect(
            tx,
            ctx.storeId,
            `/collections/${c.handle}`,
            `/collections/${row.handle}`,
          )
        }
        return id
      })
    },
    automatic ? 'Automatic' : `${c.productHandles.length} products`,
  )
}

export async function writePage(ctx: ImportContext, p: NPage) {
  const handle = handleOf(p.handle, 'page')
  return upsert(
    ctx,
    'pages',
    p.handle,
    p.title,
    (tx) => mappedOr(tx, 'pages', p.sourceId, page, handle),
    async (existing) => {
      const body = await richText(ctx, p.bodyHtml)
      return ctx.inStore(async (tx) => {
        const fields = {
          title: p.title.slice(0, 200),
          body,
          seoTitle: clip(p.seoTitle, 200),
          seoDescription: clip(p.seoDescription, 400),
          publishedAt: p.published ? (p.publishedAt ? new Date(p.publishedAt) : new Date()) : null,
          updatedAt: new Date(),
        }
        let id = existing
        if (id) await tx.update(page).set(fields).where(eq(page.id, id))
        else {
          // A page from another source already holding the handle gets a suffix.
          const [clash] = await tx.select({ id: page.id }).from(page).where(eq(page.handle, handle))
          const free = clash ? `${handle}-${newId().slice(-6)}` : handle
          id = newId()
          await tx.insert(page).values({
            id,
            storeId: ctx.storeId,
            handle: free,
            data: { root: { props: {} }, content: [], zones: {} },
            ...fields,
          })
          if (free !== p.handle.toLowerCase()) {
            await upsertImportedRedirect(tx, ctx.storeId, `/pages/${p.handle}`, `/pages/${free}`)
          }
        }
        await saveMapping(tx, ctx.storeId, 'pages', p.sourceId ?? `handle:${p.handle}`, id)
        return id
      })
    },
  )
}

async function blogFor(tx: StoreTx, storeId: string, a: NArticle): Promise<string> {
  const handle = handleOf(a.blogHandle, 'news')
  const [row] = await tx.select({ id: blog.id }).from(blog).where(eq(blog.handle, handle))
  if (row) return row.id
  return createBlog(tx, storeId, { title: a.blogTitle.slice(0, 120) || 'News', handle })
}

export async function writeArticle(ctx: ImportContext, a: NArticle) {
  const handle = handleOf(a.handle, 'post')
  const ref = `${a.blogHandle}/${a.handle}`
  return upsert(
    ctx,
    'articles',
    ref,
    a.title,
    async (tx) => {
      const mapped = await findMapping(tx, 'articles', a.sourceId)
      if (mapped) {
        const [row] = await tx
          .select({ id: article.id })
          .from(article)
          .where(eq(article.id, mapped))
        if (row) return row.id
      }
      const [row] = await tx
        .select({ id: article.id })
        .from(article)
        .innerJoin(blog, eq(blog.id, article.blogId))
        .where(and(eq(blog.handle, handleOf(a.blogHandle, 'news')), eq(article.handle, handle)))
      return row?.id ?? null
    },
    async (existing) => {
      const imageMediaId = await hostOne(ctx, 'articles', ref, a.image)
      const body = await richText(ctx, a.bodyHtml)
      return ctx.inStore(async (tx) => {
        const blogId = await blogFor(tx, ctx.storeId, a)
        const write: ArticleWrite = {
          blogId,
          title: a.title.slice(0, 200),
          handle,
          author: a.author?.slice(0, 120) ?? '',
          body: body as ArticleWrite['body'],
          excerpt: clip(htmlToText(a.summaryHtml) || null, 500),
          imageMediaId,
          imageAlt: clip(a.image?.alt ?? null, 200),
          tags: a.tags.slice(0, 40).map((t) => t.slice(0, 40)),
          status: a.published ? 'published' : 'draft',
          publishedAt: a.published && a.publishedAt ? new Date(a.publishedAt) : null,
          seoTitle: clip(a.seoTitle, 200),
          seoDescription: clip(a.seoDescription, 400),
        }
        const id = existing ?? (await createArticle(tx, ctx.storeId, write))
        if (existing) await updateArticle(tx, existing, write)
        await saveMapping(tx, ctx.storeId, 'articles', a.sourceId ?? `handle:${ref}`, id)
        const [row] = await tx
          .select({ handle: article.handle, blog: blog.handle })
          .from(article)
          .innerJoin(blog, eq(blog.id, article.blogId))
          .where(eq(article.id, id))
        const from = `/blogs/${a.blogHandle}/${a.handle}`
        const to = row ? `/blogs/${row.blog}/${row.handle}` : null
        if (to && to !== from.toLowerCase()) {
          await upsertImportedRedirect(tx, ctx.storeId, from, to)
        }
        return id
      })
    },
  )
}

/** A Shopify menu link → our destination type, from the item type and its URL path. */
export function navigationItem(item: NMenuItem, id: () => string, depth = 1): NavigationItem {
  let path = item.url ?? ''
  try {
    if (/^https?:\/\//i.test(path)) {
      const u = new URL(path)
      // Links to the store's own domain become paths; other sites stay URLs.
      if (/myshopify\.com$/i.test(u.hostname) || item.type !== 'HTTP') path = u.pathname
    }
  } catch {
    // Keep the raw value.
  }
  const segment = (prefix: string) =>
    new RegExp(`^/${prefix}/([^/?#]+)/?$`, 'i').exec(path)?.[1] ?? null
  const base = { id: id(), title: item.title.slice(0, 120) || 'Link' }
  const children =
    depth < 3 && item.items.length
      ? item.items.map((child) => navigationItem(child, id, depth + 1))
      : undefined
  const withChildren = (n: NavigationItem): NavigationItem => (children ? { ...n, children } : n)
  if (item.type === 'FRONTPAGE' || path === '/') return withChildren({ ...base, type: 'home' })
  const productHandle = segment('products')
  if (productHandle)
    return withChildren({ ...base, type: 'product', value: slugify(productHandle) })
  const collectionHandle = segment('collections')
  if (collectionHandle && collectionHandle !== 'all')
    return withChildren({ ...base, type: 'collection', value: slugify(collectionHandle) })
  const pageHandle = segment('pages')
  if (pageHandle) return withChildren({ ...base, type: 'page', value: slugify(pageHandle) })
  return withChildren({ ...base, type: 'url', value: (path || '/').slice(0, 500) })
}

export async function writeMenu(ctx: ImportContext, m: NMenu) {
  const handle = handleOf(m.handle, 'menu')
  return upsert(
    ctx,
    'menus',
    m.handle,
    m.title,
    (tx) => mappedOr(tx, 'menus', m.sourceId, navigationMenu, handle),
    async (existing) => {
      let n = 0
      const items = m.items.map((i) => navigationItem(i, () => `i${++n}`))
      const parsed = MenuItemsSchema.safeParse(items)
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Menu is not valid')
      return ctx.inStore(async (tx) => {
        let id = existing
        if (id) {
          await tx
            .update(navigationMenu)
            .set({ title: m.title.slice(0, 120), items: parsed.data, updatedAt: new Date() })
            .where(eq(navigationMenu.id, id))
        } else {
          id = newId()
          await tx.insert(navigationMenu).values({
            id,
            storeId: ctx.storeId,
            title: m.title.slice(0, 120),
            handle,
            items: parsed.data,
          })
        }
        await saveMapping(tx, ctx.storeId, 'menus', m.sourceId ?? `handle:${m.handle}`, id)
        return id
      })
    },
  )
}

export async function writeRedirect(ctx: ImportContext, r: NRedirect) {
  try {
    if (ctx.dryRun) {
      ctx.report.count('redirects', 'created')
      ctx.report.sample({
        resource: 'redirects',
        key: r.path,
        title: `${r.path} to ${r.target}`,
        action: 'create',
      })
      return
    }
    const outcome = await ctx.inStore((tx) =>
      upsertImportedRedirect(tx, ctx.storeId, r.path, r.target),
    )
    ctx.report.count('redirects', outcome)
  } catch (err) {
    ctx.report.count('redirects', 'failed')
    ctx.report.issue({ resource: 'redirects', ref: r.path, message: errorMessage(err) })
  }
}
