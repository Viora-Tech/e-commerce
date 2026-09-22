import { article, blog, media, newId, type StoreTx } from '@commerce/db'
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm'
import { slugify } from '../catalog/slug'
import {
  type ArticleList,
  type ArticleStatus,
  type ArticleWrite,
  type BlogWrite,
  InvalidArticle,
} from './schemas'
import { normaliseTags } from './text'

const DEFAULT_BLOG = { title: 'News', handle: 'news' } as const

/** First free handle among `taken`: `slug`, then `slug-2`, `slug-3`… */
function firstFree(slug: string, taken: Set<string>): string {
  if (!taken.has(slug)) return slug
  for (let n = 2; ; n++) {
    const candidate = `${slug}-${n}`
    if (!taken.has(candidate)) return candidate
  }
}

export async function uniqueBlogHandle(
  tx: StoreTx,
  base: string,
  exceptId?: string,
): Promise<string> {
  const slug = slugify(base) || 'blog'
  const rows = await tx
    .select({ id: blog.id, handle: blog.handle })
    .from(blog)
    .where(or(eq(blog.handle, slug), ilike(blog.handle, `${slug}-%`)))
  return firstFree(slug, new Set(rows.filter((r) => r.id !== exceptId).map((r) => r.handle)))
}

/** Article handles are unique within their blog, as on Shopify (`/blogs/news/launch`). */
export async function uniqueArticleHandle(
  tx: StoreTx,
  blogId: string,
  base: string,
  exceptId?: string,
): Promise<string> {
  const slug = slugify(base) || 'post'
  const rows = await tx
    .select({ id: article.id, handle: article.handle })
    .from(article)
    .where(
      and(
        eq(article.blogId, blogId),
        or(eq(article.handle, slug), ilike(article.handle, `${slug}-%`)),
      ),
    )
  return firstFree(slug, new Set(rows.filter((r) => r.id !== exceptId).map((r) => r.handle)))
}

/** Every store has at least one blog; create "News" the first time it is needed. */
export async function ensureDefaultBlog(tx: StoreTx, storeId: string): Promise<void> {
  const [row] = await tx.select({ n: count() }).from(blog)
  if ((row?.n ?? 0) > 0) return
  await tx
    .insert(blog)
    .values({ id: newId(), storeId, ...DEFAULT_BLOG })
    .onConflictDoNothing()
}

export async function listBlogs(tx: StoreTx, storeId: string) {
  await ensureDefaultBlog(tx, storeId)
  return tx
    .select({
      id: blog.id,
      title: blog.title,
      handle: blog.handle,
      commentPolicy: blog.commentPolicy,
      seoTitle: blog.seoTitle,
      seoDescription: blog.seoDescription,
      updatedAt: blog.updatedAt,
      articles: sql<number>`(select count(*)::int from ${article} a where a.blog_id = ${blog.id})`,
    })
    .from(blog)
    .orderBy(asc(blog.createdAt))
}

export async function createBlog(tx: StoreTx, storeId: string, write: BlogWrite): Promise<string> {
  const id = newId()
  const handle = await uniqueBlogHandle(tx, write.handle ?? write.title)
  await tx.insert(blog).values({
    id,
    storeId,
    handle,
    title: write.title,
    commentPolicy: write.commentPolicy ?? 'disabled',
    seoTitle: write.seoTitle || null,
    seoDescription: write.seoDescription || null,
  })
  return id
}

export async function updateBlog(tx: StoreTx, id: string, write: BlogWrite): Promise<void> {
  const handle = write.handle ? await uniqueBlogHandle(tx, write.handle, id) : undefined
  await tx
    .update(blog)
    .set({
      title: write.title,
      ...(handle ? { handle } : {}),
      ...(write.commentPolicy ? { commentPolicy: write.commentPolicy } : {}),
      seoTitle: write.seoTitle || null,
      seoDescription: write.seoDescription || null,
      updatedAt: new Date(),
    })
    .where(eq(blog.id, id))
}

/** A blog with posts cannot be deleted; move or delete the posts first. */
export async function deleteBlog(tx: StoreTx, id: string): Promise<void> {
  const [row] = await tx.select({ n: count() }).from(article).where(eq(article.blogId, id))
  if ((row?.n ?? 0) > 0) {
    throw new InvalidArticle(['This blog still has posts. Move or delete them first'])
  }
  await tx.delete(blog).where(eq(blog.id, id))
}

/**
 * The stored status and date for what the merchant chose. Publishing keeps an
 * explicit date (backdating an imported post) or stamps now; scheduling needs a
 * date; a draft has none.
 */
export function resolvePublication(
  write: Pick<ArticleWrite, 'status' | 'publishedAt'>,
  now: Date = new Date(),
): { status: ArticleStatus; publishedAt: Date | null } {
  if (write.status === 'draft') return { status: 'draft', publishedAt: null }
  if (write.status === 'scheduled') {
    if (!write.publishedAt) throw new InvalidArticle(['Pick a date and time to schedule the post'])
    return { status: 'scheduled', publishedAt: write.publishedAt }
  }
  return { status: 'published', publishedAt: write.publishedAt ?? now }
}

function articleRow(write: ArticleWrite, now: Date) {
  return {
    blogId: write.blogId,
    title: write.title,
    author: write.author?.trim() ?? '',
    body: write.body ?? null,
    excerpt: write.excerpt?.trim() || null,
    imageMediaId: write.imageMediaId ?? null,
    imageAlt: write.imageAlt?.trim() || null,
    tags: normaliseTags(write.tags ?? []),
    seoTitle: write.seoTitle || null,
    seoDescription: write.seoDescription || null,
    ...resolvePublication(write, now),
  }
}

async function assertBlog(tx: StoreTx, blogId: string): Promise<void> {
  const [row] = await tx.select({ id: blog.id }).from(blog).where(eq(blog.id, blogId))
  if (!row) throw new InvalidArticle(['Choose a blog for this post'])
}

export async function createArticle(
  tx: StoreTx,
  storeId: string,
  write: ArticleWrite,
  now: Date = new Date(),
): Promise<string> {
  await assertBlog(tx, write.blogId)
  const id = newId()
  const handle = await uniqueArticleHandle(tx, write.blogId, write.handle ?? write.title)
  await tx.insert(article).values({ id, storeId, handle, ...articleRow(write, now) })
  return id
}

export async function updateArticle(
  tx: StoreTx,
  id: string,
  write: ArticleWrite,
  now: Date = new Date(),
): Promise<void> {
  await assertBlog(tx, write.blogId)
  const [current] = await tx
    .select({ handle: article.handle, blogId: article.blogId })
    .from(article)
    .where(eq(article.id, id))
  if (!current) throw new InvalidArticle(['This post no longer exists'])
  // Moving blogs or editing the handle re-checks uniqueness in the target blog.
  const handle =
    write.handle || current.blogId !== write.blogId
      ? await uniqueArticleHandle(tx, write.blogId, write.handle ?? current.handle, id)
      : current.handle
  await tx
    .update(article)
    .set({ ...articleRow(write, now), handle, updatedAt: now })
    .where(eq(article.id, id))
}

export async function deleteArticles(tx: StoreTx, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await tx.delete(article).where(inArray(article.id, ids))
}

/** Bulk publish (stamping now where there is no date) or unpublish back to draft. */
export async function setArticlesPublished(
  tx: StoreTx,
  ids: string[],
  published: boolean,
  now: Date = new Date(),
): Promise<void> {
  if (ids.length === 0) return
  if (!published) {
    await tx
      .update(article)
      .set({ status: 'draft', publishedAt: null, updatedAt: now })
      .where(inArray(article.id, ids))
    return
  }
  await tx
    .update(article)
    .set({
      status: 'published',
      // Raw sql cannot bind a Date with the postgres driver; pass ISO text and cast.
      publishedAt: sql`least(coalesce(${article.publishedAt}, ${now.toISOString()}::timestamptz), ${now.toISOString()}::timestamptz)`,
      updatedAt: now,
    })
    .where(inArray(article.id, ids))
}

/** SQL for "a shopper can see it now": published, or scheduled and due. */
export function visibleNow(now: Date) {
  return and(
    ne(article.status, 'draft'),
    isNotNull(article.publishedAt),
    lte(article.publishedAt, now),
  )
}

function statusFilter(status: ArticleList['status'], now: Date) {
  switch (status) {
    case 'published':
      return visibleNow(now)
    case 'scheduled':
      return and(eq(article.status, 'scheduled'), gt(article.publishedAt, now))
    case 'draft':
      return eq(article.status, 'draft')
    default:
      return undefined
  }
}

const listColumns = {
  id: article.id,
  blogId: article.blogId,
  blogTitle: blog.title,
  blogHandle: blog.handle,
  title: article.title,
  handle: article.handle,
  author: article.author,
  status: article.status,
  publishedAt: article.publishedAt,
  tags: article.tags,
  imageUrl: media.url,
  updatedAt: article.updatedAt,
}

export async function listArticles(tx: StoreTx, input: ArticleList, now: Date = new Date()) {
  const where = and(
    statusFilter(input.status, now),
    input.blogId ? eq(article.blogId, input.blogId) : undefined,
    input.tag ? sql`${input.tag} = any(${article.tags})` : undefined,
    input.query
      ? or(ilike(article.title, `%${input.query}%`), ilike(article.author, `%${input.query}%`))
      : undefined,
  )
  const [rows, [total]] = await Promise.all([
    tx
      .select(listColumns)
      .from(article)
      .innerJoin(blog, eq(blog.id, article.blogId))
      .leftJoin(media, eq(media.id, article.imageMediaId))
      .where(where)
      .orderBy(desc(sql`coalesce(${article.publishedAt}, ${article.updatedAt})`), desc(article.id))
      .limit(input.perPage)
      .offset((input.page - 1) * input.perPage),
    tx.select({ n: count() }).from(article).where(where),
  ])
  return { rows, total: total?.n ?? 0 }
}

/** Counts per tab, so the tabs can show them. */
export async function articleCounts(tx: StoreTx, now: Date = new Date()) {
  const [row] = await tx
    .select({
      all: count(),
      published: sql<number>`count(*) filter (where ${visibleNow(now)})::int`,
      scheduled: sql<number>`count(*) filter (where ${article.status} = 'scheduled' and ${article.publishedAt} > ${now.toISOString()}::timestamptz)::int`,
      draft: sql<number>`count(*) filter (where ${article.status} = 'draft')::int`,
    })
    .from(article)
  return {
    all: row?.all ?? 0,
    published: Number(row?.published ?? 0),
    scheduled: Number(row?.scheduled ?? 0),
    draft: Number(row?.draft ?? 0),
  }
}

export async function getArticle(tx: StoreTx, id: string) {
  const [row] = await tx
    .select({
      id: article.id,
      blogId: article.blogId,
      title: article.title,
      handle: article.handle,
      author: article.author,
      body: article.body,
      excerpt: article.excerpt,
      imageMediaId: article.imageMediaId,
      imageUrl: media.url,
      imageAlt: article.imageAlt,
      tags: article.tags,
      status: article.status,
      publishedAt: article.publishedAt,
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      blogHandle: blog.handle,
      updatedAt: article.updatedAt,
    })
    .from(article)
    .innerJoin(blog, eq(blog.id, article.blogId))
    .leftJoin(media, eq(media.id, article.imageMediaId))
    .where(eq(article.id, id))
  return row ?? null
}

/** Every tag in use, for the tag picker and the filter. */
export async function articleTags(tx: StoreTx): Promise<string[]> {
  const rows = await tx.execute<{ tag: string }>(
    sql`select distinct unnest(${article.tags}) as tag from ${article} order by 1`,
  )
  return rows.map((r) => r.tag)
}
