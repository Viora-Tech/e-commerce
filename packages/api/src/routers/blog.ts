import {
  ArticleListSchema,
  ArticleWriteSchema,
  articleCounts,
  articleTags,
  BlogWriteSchema,
  createArticle,
  createBlog,
  deleteArticles,
  deleteBlog,
  getArticle,
  InvalidArticle,
  listArticles,
  listBlogs,
  permissions,
  setArticlesPublished,
  updateArticle,
  updateBlog,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

async function invalidToBadRequest<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof InvalidArticle) {
      throw new ORPCError('BAD_REQUEST', { message: err.errors.join('. ') })
    }
    throw err
  }
}

const read = () => can(permissions.CONTENT_READ)
const write = () => can(permissions.CONTENT_WRITE)
const ids = z.object({ ids: z.array(z.uuid()).min(1).max(200) })

export const blogRouter = {
  /** Blogs with post counts; creates "News" the first time a store has none. */
  blogs: read().handler(({ context }) => listBlogs(context.tx, context.scope.storeId)),

  createBlog: write()
    .input(BlogWriteSchema)
    .handler(async ({ context, input }) => ({
      id: await createBlog(context.tx, context.scope.storeId, input),
    })),

  updateBlog: write()
    .input(z.object({ id: z.uuid(), write: BlogWriteSchema }))
    .handler(async ({ context, input }) => {
      await updateBlog(context.tx, input.id, input.write)
      return { ok: true as const }
    }),

  deleteBlog: write()
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      invalidToBadRequest(async () => {
        await deleteBlog(context.tx, input.id)
        return { ok: true as const }
      }),
    ),

  list: read()
    .input(ArticleListSchema)
    .handler(({ context, input }) => listArticles(context.tx, input)),

  counts: read().handler(({ context }) => articleCounts(context.tx)),

  tags: read().handler(({ context }) => articleTags(context.tx)),

  get: read()
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const row = await getArticle(context.tx, input.id)
      if (!row) throw new ORPCError('NOT_FOUND', { message: 'This post no longer exists' })
      return row
    }),

  /** Prefills for a new post: the signed-in staff member as author. */
  defaults: read().handler(({ context }) => ({
    author: context.session?.user?.name ?? '',
  })),

  create: write()
    .input(ArticleWriteSchema)
    .handler(({ context, input }) =>
      invalidToBadRequest(async () => ({
        id: await createArticle(context.tx, context.scope.storeId, input),
      })),
    ),

  update: write()
    .input(z.object({ id: z.uuid(), write: ArticleWriteSchema }))
    .handler(({ context, input }) =>
      invalidToBadRequest(async () => {
        await updateArticle(context.tx, input.id, input.write)
        return { ok: true as const }
      }),
    ),

  publish: write()
    .input(ids)
    .handler(async ({ context, input }) => {
      await setArticlesPublished(context.tx, input.ids, true)
      return { ok: true as const }
    }),

  unpublish: write()
    .input(ids)
    .handler(async ({ context, input }) => {
      await setArticlesPublished(context.tx, input.ids, false)
      return { ok: true as const }
    }),

  delete: write()
    .input(ids)
    .handler(async ({ context, input }) => {
      await deleteArticles(context.tx, input.ids)
      return { ok: true as const }
    }),
}
