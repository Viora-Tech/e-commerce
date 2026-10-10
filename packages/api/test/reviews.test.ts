import { createMerchantAuth } from '@commerce/auth'
import { createDb, newId, product, store, variant } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
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
  const jobs: unknown[] = []
  return {
    ctx: {
      db: app,
      auth,
      headers,
      notifications: { add: async () => undefined },
      appJobs: {
        add: async (_name: string, data: unknown) => {
          jobs.push(data)
        },
      },
    } as unknown as ApiContext,
    storeId: s?.id as string,
    jobs,
  }
}

async function install(storeId: string) {
  await owner
    .update(store)
    .set({ apps: { installed: ['reviews'] } })
    .where(eq(store.id, storeId))
}

async function addProduct(storeId: string, handle: string, sku: string) {
  const id = newId()
  await owner.insert(product).values({ id, storeId, title: handle, handle, status: 'active' })
  await owner
    .insert(variant)
    .values({ storeId, productId: id, title: 'Default', pricePaise: 100000, sku })
  return id
}

const CSV = [
  'title,body,rating,review_date,reviewer_name,reviewer_email,product_handle,product_sku,picture_urls',
  'Smooth,Great glide,5,2025-03-01,Aarav M.,a@x.co,veil,VEIL-1,https://cdn.example/a.jpg',
  'Okay,Fine,3,2025-03-02,Priya S.,p@x.co,veil,,',
  'Lost,Who knows,4,2025-03-03,Meera D.,m@x.co,gone,,',
].join('\n')

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('reviews router', () => {
  it('refuses until the Reviews app is installed', async () => {
    const m = await merchant('a@example.com', 'store-a')
    await expect(
      call(appRouter.reviews.list, { page: 1, perPage: 20 }, { context: m.ctx }),
    ).rejects.toThrow(/Install the Reviews app/)
  })

  it('imports Judge.me, lists, moderates and keeps settings', async () => {
    const m = await merchant('b@example.com', 'store-b')
    await install(m.storeId)
    await addProduct(m.storeId, 'veil', 'VEIL-1')
    const preview = await call(appRouter.reviews.judgeme.preview, { csv: CSV }, { context: m.ctx })
    expect(preview).toMatchObject({ ok: true, ready: 2, noMatch: 1, photos: 1 })
    const done = await call(
      appRouter.reviews.judgeme.import,
      { csv: CSV, copyPhotos: true, publish: false },
      { context: m.ctx },
    )
    expect(done).toMatchObject({ ok: true, imported: 2, photosToCopy: 1 })
    expect(m.jobs).toEqual([
      { storeId: m.storeId, pluginId: 'reviews', name: 'copy-photos', data: {} },
    ])

    const list = await call(
      appRouter.reviews.list,
      { page: 1, perPage: 20, status: 'pending' },
      { context: m.ctx },
    )
    expect(list.total).toBe(2)
    expect(list.stats).toMatchObject({ all: 2, pending: 2, published: 0, withPhotos: 1 })
    const ids = list.rows.map((r) => r.id)
    await call(appRouter.reviews.setStatus, { ids, status: 'published' }, { context: m.ctx })
    const after = await call(appRouter.reviews.list, { page: 1, perPage: 20 }, { context: m.ctx })
    expect(after.stats).toMatchObject({ published: 2, average: 4 })
    const detail = await call(appRouter.reviews.get, { id: ids[0] as string }, { context: m.ctx })
    expect(detail.review.source).toBe('judgeme')

    const settings = await call(appRouter.reviews.settings.get, undefined, { context: m.ctx })
    const saved = await call(
      appRouter.reviews.settings.save,
      { ...settings, publishing: 'all', maxPerDay: 5 },
      { context: m.ctx },
    )
    expect(saved).toMatchObject({ publishing: 'all', maxPerDay: 5 })
    expect(await call(appRouter.reviews.products, undefined, { context: m.ctx })).toEqual([
      expect.objectContaining({ title: 'veil' }),
    ])
  })

  it("cannot see or change another store's reviews", async () => {
    const a = await merchant('c@example.com', 'store-c')
    const b = await merchant('d@example.com', 'store-d')
    await install(a.storeId)
    await install(b.storeId)
    await addProduct(a.storeId, 'veil', 'VEIL-1')
    await call(
      appRouter.reviews.judgeme.import,
      { csv: CSV, copyPhotos: false, publish: true },
      { context: a.ctx },
    )
    const mine = await call(appRouter.reviews.list, { page: 1, perPage: 20 }, { context: a.ctx })
    const id = mine.rows[0]?.id as string
    expect(
      (await call(appRouter.reviews.list, { page: 1, perPage: 20 }, { context: b.ctx })).total,
    ).toBe(0)
    await expect(call(appRouter.reviews.get, { id }, { context: b.ctx })).rejects.toThrow()
    expect(
      await call(appRouter.reviews.setStatus, { ids: [id], status: 'hidden' }, { context: b.ctx }),
    ).toEqual({ updated: 0 })
    await expect(
      call(appRouter.reviews.reply, { id, text: 'hi' }, { context: b.ctx }),
    ).rejects.toThrow()
  })
})
