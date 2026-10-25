import { createMerchantAuth } from '@commerce/auth'
import { createDb, navigationMenu, product, store, urlRedirect } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

/* CMS PR5: auto-redirects on handle changes, the menu link check and redirects CSV. */

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

const redirectsOf = (storeId: string) =>
  owner
    .select({ path: urlRedirect.path, target: urlRedirect.target, source: urlRedirect.source })
    .from(urlRedirect)
    .where(eq(urlRedirect.storeId, storeId))
    .orderBy(asc(urlRedirect.path))

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('handle changes', () => {
  it('a product renamed from the list and a page renamed in its editor leave redirects', async () => {
    const m = await merchant('a@example.com', 'links-a')
    const [p] = await owner
      .insert(product)
      .values({ storeId: m.storeId, title: 'Pad', handle: 'pad', status: 'active' })
      .returning()
    await call(
      appRouter.products.update,
      { id: p?.id as string, handle: 'pad-pro' },
      { context: m.ctx },
    )
    const pg = await call(
      appRouter.pages.create,
      { handle: 'about', title: 'About' },
      { context: m.ctx },
    )
    await owner.insert(navigationMenu).values({
      storeId: m.storeId,
      title: 'Footer',
      handle: 'footer',
      items: [{ id: 'x', title: 'About us', type: 'page', value: 'about' }],
    })
    await call(
      appRouter.pages.update,
      { id: pg?.id as string, handle: 'about-us' },
      { context: m.ctx },
    )
    // Saving without touching the handle changes nothing.
    await call(appRouter.pages.update, { id: pg?.id as string, title: 'About' }, { context: m.ctx })
    expect(await redirectsOf(m.storeId)).toEqual([
      { path: '/pages/about', target: '/pages/about-us', source: 'auto' },
      { path: '/products/pad', target: '/products/pad-pro', source: 'auto' },
    ])
    const [menu] = await owner.select().from(navigationMenu)
    expect(menu?.items[0]?.value).toBe('about-us')
  })
})

describe('menu link check', () => {
  it('reports a deleted product and accepts the new link types', async () => {
    const m = await merchant('b@example.com', 'links-b')
    await owner
      .insert(product)
      .values({ storeId: m.storeId, title: 'Pad', handle: 'pad', status: 'active' })
    const problems = await call(
      appRouter.navigation.checkLinks,
      {
        items: [
          { id: '1', title: 'Pad', type: 'product', value: 'pad' },
          { id: '2', title: 'Gone', type: 'product', value: 'gone' },
          { id: '3', title: 'Search', type: 'search' },
          { id: '4', title: 'All', type: 'collections' },
          { id: '5', title: 'Refunds', type: 'policy', value: 'refund-policy' },
        ],
      },
      { context: m.ctx },
    )
    expect(problems.map((p) => [p.itemId, p.problem])).toEqual([
      ['2', 'missing'],
      ['5', 'missing'],
    ])
    // The new types save, and a bad policy value is refused with plain words.
    await call(
      appRouter.navigation.save,
      {
        title: 'Main',
        handle: 'main',
        items: [
          { id: 'a', title: 'Blog', type: 'blog', value: 'news' },
          { id: 'b', title: 'Post', type: 'article', value: 'news/hello' },
          { id: 'c', title: 'Search', type: 'search' },
        ],
      },
      { context: m.ctx },
    )
    await expect(
      call(
        appRouter.navigation.save,
        {
          title: 'Bad',
          handle: 'bad',
          items: [{ id: 'a', title: 'x', type: 'policy', value: 'cookies' }],
        },
        { context: m.ctx },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

describe('redirects CSV', () => {
  it('previews, imports and exports, per store', async () => {
    const m = await merchant('c@example.com', 'links-c')
    const other = await merchant('d@example.com', 'links-d')
    const csv = 'Redirect from,Redirect to\n/old,/new\n/,/nope\n/sale,/collections/sale\n'
    const preview = await call(
      appRouter.redirects.importCsv,
      { csv, dryRun: true },
      { context: m.ctx },
    )
    expect(preview).toMatchObject({ rows: 2, created: 0, updated: 0 })
    expect(preview.problems.map((p) => p.line)).toEqual([3])
    expect(await redirectsOf(m.storeId)).toEqual([])

    const done = await call(appRouter.redirects.importCsv, { csv }, { context: m.ctx })
    expect(done).toMatchObject({ rows: 2, created: 2, updated: 0, unchanged: 0 })

    const file = await call(appRouter.redirects.exportCsv, undefined, { context: m.ctx })
    expect(file.name).toBe('redirects.csv')
    const text = await file.text()
    expect(text.replace(/^\uFEFF/, '')).toBe(
      'Redirect from,Redirect to\r\n/old,/new\r\n/sale,/collections/sale',
    )
    const empty = await call(appRouter.redirects.exportCsv, undefined, { context: other.ctx })
    expect((await empty.text()).replace(/^\uFEFF/, '')).toBe('Redirect from,Redirect to')
  })
})
