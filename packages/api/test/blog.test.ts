import { createMerchantAuth } from '@commerce/auth'
import { createDb, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const sent: { otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

async function merchant(email: string, slug: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  return {
    ctx: { db: app, auth, headers, notifications: { add: async () => undefined } } as ApiContext,
    storeId: s?.id as string,
  }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('blog', () => {
  it('creates, lists, publishes and deletes posts in the default blog', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const ctx = { context: a.ctx }
    const blogs = await call(appRouter.blog.blogs, undefined, ctx)
    const news = blogs[0]
    expect(news?.handle).toBe('news')

    const { id } = await call(
      appRouter.blog.create,
      {
        blogId: news?.id as string,
        title: 'New glasspads',
        status: 'draft',
        tags: ['Launch', 'launch'],
        body: {
          root: { type: 'root', children: [{ type: 'paragraph', children: [{ text: 'Hi' }] }] },
        },
      },
      ctx,
    )
    const post = await call(appRouter.blog.get, { id }, ctx)
    expect(post).toMatchObject({ handle: 'new-glasspads', status: 'draft', tags: ['Launch'] })

    await call(appRouter.blog.publish, { ids: [id] }, ctx)
    expect(await call(appRouter.blog.counts, undefined, ctx)).toMatchObject({
      all: 1,
      published: 1,
    })
    const listed = await call(appRouter.blog.list, { status: 'published' }, ctx)
    expect(listed.rows.map((r) => r.title)).toEqual(['New glasspads'])

    await call(appRouter.blog.delete, { ids: [id] }, ctx)
    expect((await call(appRouter.blog.counts, undefined, ctx)).all).toBe(0)
  })

  it('answers 400 for a schedule without a date and for deleting a blog with posts', async () => {
    const a = await merchant('b@example.com', 'store-b')
    const ctx = { context: a.ctx }
    const [news] = await call(appRouter.blog.blogs, undefined, ctx)
    await expect(
      call(
        appRouter.blog.create,
        { blogId: news?.id as string, title: 'Later', status: 'scheduled' },
        ctx,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    await call(
      appRouter.blog.create,
      { blogId: news?.id as string, title: 'Kept', status: 'draft' },
      ctx,
    )
    await expect(
      call(appRouter.blog.deleteBlog, { id: news?.id as string }, ctx),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('keeps one store out of another store blog', async () => {
    const a = await merchant('c@example.com', 'store-c')
    const b = await merchant('d@example.com', 'store-d')
    const [news] = await call(appRouter.blog.blogs, undefined, { context: a.ctx })
    await call(
      appRouter.blog.create,
      { blogId: news?.id as string, title: 'Private', status: 'published' },
      { context: a.ctx },
    )
    const seen = await call(appRouter.blog.list, {}, { context: b.ctx })
    expect(seen.total).toBe(0)
    // Store B cannot attach a post to store A's blog: RLS hides it, so it is "not a blog".
    await expect(
      call(
        appRouter.blog.create,
        { blogId: news?.id as string, title: 'Sneaky', status: 'draft' },
        { context: b.ctx },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})
