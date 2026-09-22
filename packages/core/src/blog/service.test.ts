import { blog, createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { InvalidArticle } from './schemas'
import {
  articleCounts,
  articleTags,
  createArticle,
  createBlog,
  deleteBlog,
  listArticles,
  listBlogs,
  resolvePublication,
  setArticlesPublished,
  updateArticle,
} from './service'
import { getVisibleArticle, listVisibleArticles, recentVisibleArticles } from './storefront'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedStore(slug = 'w') {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

const now = new Date('2026-09-23T10:00:00Z')
const past = new Date('2026-09-01T10:00:00Z')
const future = new Date('2026-10-01T10:00:00Z')

async function newsBlog(storeId: string) {
  const blogs = await withStore(app, storeId, (tx) => listBlogs(tx, storeId))
  const news = blogs[0]
  if (!news) throw new Error('no default blog')
  return news
}

describe('blogs', () => {
  it('creates a News blog the first time a store lists its blogs', async () => {
    const storeId = await seedStore()
    const blogs = await withStore(app, storeId, (tx) => listBlogs(tx, storeId))
    expect(blogs.map((b) => [b.title, b.handle, b.articles])).toEqual([['News', 'news', 0]])
    const again = await withStore(app, storeId, (tx) => listBlogs(tx, storeId))
    expect(again).toHaveLength(1)
  })

  it('gives each blog a unique handle per store, but lets two stores share one', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    await withStore(app, a, (tx) => listBlogs(tx, a))
    const id = await withStore(app, a, (tx) => createBlog(tx, a, { title: 'News' }))
    const [row] = await withStore(app, a, (tx) => tx.select().from(blog).where(eq(blog.id, id)))
    expect(row?.handle).toBe('news-2')
    await withStore(app, b, (tx) => createBlog(tx, b, { title: 'News' }))
    const other = await withStore(app, b, (tx) => listBlogs(tx, b))
    expect(other.map((x) => x.handle)).toEqual(['news'])
  })

  it('refuses to delete a blog that still has posts', async () => {
    const storeId = await seedStore()
    const news = await newsBlog(storeId)
    await withStore(app, storeId, (tx) =>
      createArticle(tx, storeId, { blogId: news.id, title: 'Hello', status: 'draft' }, now),
    )
    await expect(withStore(app, storeId, (tx) => deleteBlog(tx, news.id))).rejects.toThrow(
      InvalidArticle,
    )
  })
})

describe('articles', () => {
  it('slugs handles uniquely within a blog', async () => {
    const storeId = await seedStore()
    const news = await newsBlog(storeId)
    const write = { blogId: news.id, title: 'Glasspad launch!', status: 'draft' as const }
    const first = await withStore(app, storeId, (tx) => createArticle(tx, storeId, write, now))
    await withStore(app, storeId, (tx) => createArticle(tx, storeId, write, now))
    const { rows } = await withStore(app, storeId, (tx) =>
      listArticles(tx, { page: 1, perPage: 10, status: 'all' }, now),
    )
    expect(rows.map((r) => r.handle).sort()).toEqual(['glasspad-launch', 'glasspad-launch-2'])
    // Editing keeps the handle unless asked to change it.
    await withStore(app, storeId, (tx) =>
      updateArticle(tx, first, { ...write, title: 'Renamed' }, now),
    )
    const after = await withStore(app, storeId, (tx) =>
      listArticles(tx, { page: 1, perPage: 10, status: 'all', query: 'Renamed' }, now),
    )
    expect(after.rows[0]?.handle).toBe('glasspad-launch')
  })

  it('needs a date to schedule, stamps now when publishing, clears it for drafts', () => {
    expect(() => resolvePublication({ status: 'scheduled' }, now)).toThrow(InvalidArticle)
    expect(resolvePublication({ status: 'published' }, now)).toEqual({
      status: 'published',
      publishedAt: now,
    })
    expect(resolvePublication({ status: 'draft', publishedAt: past }, now)).toEqual({
      status: 'draft',
      publishedAt: null,
    })
  })

  it('keeps scheduled posts off the storefront until they are due', async () => {
    const storeId = await seedStore()
    const news = await newsBlog(storeId)
    await withStore(app, storeId, async (tx) => {
      await createArticle(
        tx,
        storeId,
        { blogId: news.id, title: 'Out now', status: 'published', publishedAt: past, tags: ['Launch'] },
        now,
      )
      await createArticle(
        tx,
        storeId,
        { blogId: news.id, title: 'Coming soon', status: 'scheduled', publishedAt: future },
        now,
      )
      await createArticle(tx, storeId, { blogId: news.id, title: 'Draft', status: 'draft' }, now)
    })

    const visible = await withStore(app, storeId, (tx) =>
      listVisibleArticles(tx, news.id, { page: 1, perPage: 10 }, now),
    )
    expect(visible.rows.map((r) => r.title)).toEqual(['Out now'])
    const later = await withStore(app, storeId, (tx) =>
      listVisibleArticles(tx, news.id, { page: 1, perPage: 10 }, new Date('2026-10-02T00:00:00Z')),
    )
    expect(later.rows.map((r) => r.title)).toEqual(['Coming soon', 'Out now'])

    const hidden = await withStore(app, storeId, (tx) =>
      getVisibleArticle(tx, news.id, 'coming-soon', now),
    )
    expect(hidden).toBeNull()

    const counts = await withStore(app, storeId, (tx) => articleCounts(tx, now))
    expect(counts).toEqual({ all: 3, published: 1, scheduled: 1, draft: 1 })
  })

  it('filters by tag, lists tags, and links neighbours by publish date', async () => {
    const storeId = await seedStore()
    const news = await newsBlog(storeId)
    await withStore(app, storeId, async (tx) => {
      for (const [i, title] of ['One', 'Two', 'Three'].entries()) {
        await createArticle(
          tx,
          storeId,
          {
            blogId: news.id,
            title,
            status: 'published',
            publishedAt: new Date(past.getTime() + i * 86_400_000),
            tags: i === 1 ? ['Guides'] : ['News'],
          },
          now,
        )
      }
    })
    const guides = await withStore(app, storeId, (tx) =>
      listVisibleArticles(tx, news.id, { tag: 'Guides', page: 1, perPage: 10 }, now),
    )
    expect(guides.rows.map((r) => r.title)).toEqual(['Two'])
    expect(guides.tags).toEqual(['Guides', 'News'])
    expect(await withStore(app, storeId, (tx) => articleTags(tx))).toEqual(['Guides', 'News'])

    const two = await withStore(app, storeId, (tx) => getVisibleArticle(tx, news.id, 'two', now))
    expect(two?.previous?.title).toBe('One')
    expect(two?.next?.title).toBe('Three')

    const recent = await withStore(app, storeId, (tx) =>
      recentVisibleArticles(tx, { limit: 2 }, now),
    )
    expect(recent.map((r) => r.title)).toEqual(['Three', 'Two'])
  })

  it('bulk publishes and unpublishes', async () => {
    const storeId = await seedStore()
    const news = await newsBlog(storeId)
    const id = await withStore(app, storeId, (tx) =>
      createArticle(tx, storeId, { blogId: news.id, title: 'Draft', status: 'draft' }, now),
    )
    await withStore(app, storeId, (tx) => setArticlesPublished(tx, [id], true, now))
    expect((await withStore(app, storeId, (tx) => articleCounts(tx, now))).published).toBe(1)
    await withStore(app, storeId, (tx) => setArticlesPublished(tx, [id], false, now))
    expect((await withStore(app, storeId, (tx) => articleCounts(tx, now))).draft).toBe(1)
  })

  it('keeps one store out of another store posts', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    const news = await newsBlog(a)
    await withStore(app, a, (tx) =>
      createArticle(tx, a, { blogId: news.id, title: 'Private', status: 'published' }, now),
    )
    const seen = await withStore(app, b, (tx) =>
      listArticles(tx, { page: 1, perPage: 10, status: 'all' }, now),
    )
    expect(seen.total).toBe(0)
  })
})
