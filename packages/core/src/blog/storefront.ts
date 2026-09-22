import { article, blog, media, type StoreTx } from '@commerce/db'
import { and, asc, count, desc, eq, gt, lt, sql } from 'drizzle-orm'
import { visibleNow } from './service'

/** Storefront reads: only what a shopper may see right now. */

export async function getBlogByHandle(tx: StoreTx, handle: string) {
  const [row] = await tx.select().from(blog).where(eq(blog.handle, handle))
  return row ?? null
}

const cardColumns = {
  id: article.id,
  title: article.title,
  handle: article.handle,
  author: article.author,
  excerpt: article.excerpt,
  body: article.body,
  tags: article.tags,
  publishedAt: article.publishedAt,
  imageUrl: media.url,
  imageAlt: article.imageAlt,
  blogHandle: blog.handle,
  blogTitle: blog.title,
}

export async function listVisibleArticles(
  tx: StoreTx,
  blogId: string,
  opts: { tag?: string | undefined; page: number; perPage: number },
  now: Date = new Date(),
) {
  const where = and(
    eq(article.blogId, blogId),
    visibleNow(now),
    opts.tag ? sql`${opts.tag} = any(${article.tags})` : undefined,
  )
  const [rows, [total], tags] = await Promise.all([
    tx
      .select(cardColumns)
      .from(article)
      .innerJoin(blog, eq(blog.id, article.blogId))
      .leftJoin(media, eq(media.id, article.imageMediaId))
      .where(where)
      .orderBy(desc(article.publishedAt), desc(article.id))
      .limit(opts.perPage)
      .offset((opts.page - 1) * opts.perPage),
    tx.select({ n: count() }).from(article).where(where),
    tx.execute<{ tag: string }>(
      sql`select distinct unnest(${article.tags}) as tag from ${article}
          where ${article.blogId} = ${blogId} and ${visibleNow(now)} order by 1`,
    ),
  ])
  return { rows, total: total?.n ?? 0, tags: tags.map((t) => t.tag) }
}

/** One visible article with its neighbours by publish date (older is "previous"). */
export async function getVisibleArticle(
  tx: StoreTx,
  blogId: string,
  handle: string,
  now: Date = new Date(),
) {
  const [row] = await tx
    .select({
      ...cardColumns,
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      updatedAt: article.updatedAt,
    })
    .from(article)
    .innerJoin(blog, eq(blog.id, article.blogId))
    .leftJoin(media, eq(media.id, article.imageMediaId))
    .where(and(eq(article.blogId, blogId), eq(article.handle, handle), visibleNow(now)))
  if (!row?.publishedAt) return null
  const neighbour = { title: article.title, handle: article.handle }
  const [[previous], [next]] = await Promise.all([
    tx
      .select(neighbour)
      .from(article)
      .where(
        and(eq(article.blogId, blogId), visibleNow(now), lt(article.publishedAt, row.publishedAt)),
      )
      .orderBy(desc(article.publishedAt))
      .limit(1),
    tx
      .select(neighbour)
      .from(article)
      .where(
        and(eq(article.blogId, blogId), visibleNow(now), gt(article.publishedAt, row.publishedAt)),
      )
      .orderBy(asc(article.publishedAt))
      .limit(1),
  ])
  return { ...row, previous: previous ?? null, next: next ?? null }
}

/** Newest visible posts, optionally from one blog: feeds the home page block. */
export async function recentVisibleArticles(
  tx: StoreTx,
  opts: { blogHandle?: string | undefined; limit: number },
  now: Date = new Date(),
) {
  return tx
    .select(cardColumns)
    .from(article)
    .innerJoin(blog, eq(blog.id, article.blogId))
    .leftJoin(media, eq(media.id, article.imageMediaId))
    .where(and(visibleNow(now), opts.blogHandle ? eq(blog.handle, opts.blogHandle) : undefined))
    .orderBy(desc(article.publishedAt), desc(article.id))
    .limit(opts.limit)
}

/** Visible blog and article URLs for a sitemap. */
export async function blogSitemapEntries(tx: StoreTx, now: Date = new Date()) {
  const [blogs, articles] = await Promise.all([
    tx.select({ handle: blog.handle, updatedAt: blog.updatedAt }).from(blog),
    tx
      .select({ blogHandle: blog.handle, handle: article.handle, updatedAt: article.updatedAt })
      .from(article)
      .innerJoin(blog, eq(blog.id, article.blogId))
      .where(visibleNow(now)),
  ])
  return [
    ...blogs.map((b) => ({ path: `/blogs/${b.handle}`, updatedAt: b.updatedAt })),
    ...articles.map((a) => ({ path: `/blogs/${a.blogHandle}/${a.handle}`, updatedAt: a.updatedAt })),
  ]
}
