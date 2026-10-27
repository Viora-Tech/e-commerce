import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createMerchantAuth } from '@commerce/auth'
import { createProduct, localStoragePath } from '@commerce/core'
import { createDb, media, store, withStore } from '@commerce/db'
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

describe('media', () => {
  it('presigns against the local folder by default, confirms, lists and deletes within the store', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const b = await merchant('b@example.com', 'store-b')

    const ticket = await call(
      appRouter.media.presign,
      { filename: 'Front.png', contentType: 'image/png', size: 1234, width: 10, height: 10 },
      { context: a.ctx },
    )
    expect(ticket.upload.method).toBe('PUT')
    expect(ticket.upload.url).toContain('/api/uploads?key=')
    expect(ticket.url).toMatch(new RegExp(`/uploads/stores/${a.storeId}/media/`))

    // Simulate the browser's PUT: write the object where confirm's HEAD check looks for it.
    const key = ticket.url.split('/uploads/')[1] as string
    const path = localStoragePath(key)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, Buffer.alloc(1234))

    // Pending rows are invisible to the library.
    expect((await call(appRouter.media.list, {}, { context: a.ctx })).total).toBe(0)
    const confirmed = await call(
      appRouter.media.confirm,
      { id: ticket.mediaId },
      { context: a.ctx },
    )
    // An image is queued for the upload-time pipeline, not made ready immediately.
    expect(confirmed.status).toBe('processing')
    // ...and listed straight away, marked as still optimising (#811).
    const listed = await call(appRouter.media.list, {}, { context: a.ctx })
    expect(listed.total).toBe(1)
    expect(listed.items[0]).toMatchObject({ id: ticket.mediaId, status: 'processing' })

    // Another store sees nothing and cannot touch it.
    expect((await call(appRouter.media.list, {}, { context: b.ctx })).total).toBe(0)
    await expect(
      call(appRouter.media.update, { id: ticket.mediaId, alt: 'x' }, { context: b.ctx }),
    ).rejects.toThrow()

    // Its page: the list columns plus status for its own store, 404 for another or a missing id.
    const file = await call(appRouter.media.get, { id: ticket.mediaId }, { context: a.ctx })
    expect(file).toMatchObject({ id: ticket.mediaId, status: 'processing', size: 1234 })
    await expect(
      call(appRouter.media.get, { id: ticket.mediaId }, { context: b.ctx }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      call(appRouter.media.get, { id: '01a16498-0000-7000-8000-000000000000' }, { context: a.ctx }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    // Used in: the products whose gallery holds it, only for its own store.
    const productId = await withStore(app, a.storeId, (tx) =>
      createProduct(tx, a.storeId, {
        title: 'Pad',
        status: 'active',
        tags: [],
        options: [],
        variants: [{ optionValues: [], pricePaise: 100 }],
        mediaIds: [ticket.mediaId],
      }),
    )
    expect(await call(appRouter.media.usedIn, { id: ticket.mediaId }, { context: a.ctx })).toEqual([
      { productId, title: 'Pad' },
    ])
    expect(await call(appRouter.media.usedIn, { id: ticket.mediaId }, { context: b.ctx })).toEqual(
      [],
    )

    await call(
      appRouter.media.update,
      { id: ticket.mediaId, alt: 'Front view' },
      { context: a.ctx },
    )
    await call(appRouter.media.delete, { id: ticket.mediaId }, { context: a.ctx })
    expect(await owner.select().from(media)).toHaveLength(0)
  })

  it('rejects files that are not images or mp4 with a 400', async () => {
    const a = await merchant('a@example.com', 'store-a')
    await expect(
      call(
        appRouter.media.presign,
        { filename: 'x.pdf', contentType: 'application/pdf', size: 10 },
        { context: a.ctx },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('storage settings expose the local floor plus installed apps and round-trip', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const before = await call(appRouter.store.getStorage, undefined, { context: a.ctx })
    expect(before.available.map((p) => p.id)).toEqual(['local'])
    await call(appRouter.apps.install, { id: 'r2' }, { context: a.ctx })
    const after = await call(appRouter.store.getStorage, undefined, { context: a.ctx })
    expect(after.available.map((p) => p.id)).toEqual(['local', 'r2'])
    const saved = await call(
      appRouter.store.updateStorage,
      {
        enabled: ['r2'],
        providers: {
          r2: {
            accountId: '0123456789abcdef0123456789abcdef',
            accessKeyId: 'ak',
            secretAccessKey: 'super-secret',
            bucket: 'b',
            publicBaseUrl: 'https://pub.r2.dev',
          },
        },
      },
      { context: a.ctx },
    )
    expect(saved?.providers.r2?.secretAccessKey).toBe('••••cret')
    const ticket = await call(
      appRouter.media.presign,
      { filename: 'a.png', contentType: 'image/png', size: 1 },
      { context: a.ctx },
    )
    expect(ticket.url.startsWith('https://pub.r2.dev/stores/')).toBe(true)
    expect(ticket.upload.url).toContain('r2.cloudflarestorage.com')
  })
})
