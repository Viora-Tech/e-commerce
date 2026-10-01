import { createMerchantAuth } from '@commerce/auth'
import {
  authSchema,
  createDb,
  platformAuditEvent,
  product,
  role,
  store,
  storeExport,
  storeMember,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { strFromU8, unzipSync } from 'fflate'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const sent: { email: string; otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

async function signIn(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  return new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
}

async function merchant(email: string, slug: string, name: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name, organizationId: org?.id as string })
    .returning()
  if (!s) throw new Error('seed')
  return { headers, storeId: s.id, organizationId: org?.id as string }
}

const queued: { name: string; data: unknown }[] = []
function ctx(headers: Headers, opts: { queue?: boolean } = {}): ApiContext {
  return {
    db: app,
    auth,
    headers,
    notifications: { add: async () => undefined },
    ...(opts.queue
      ? {
          storeExport: {
            add: async (name: string, data: unknown) => {
              queued.push({ name, data })
            },
          },
        }
      : {}),
  }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
  queued.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('store data: export', () => {
  it('builds a zip of the store in the request when no worker queue is wired, and downloads it', async () => {
    const a = await merchant('a@example.com', 'data-a', 'Data A')
    const b = await merchant('b@example.com', 'data-b', 'Data B')
    await owner.insert(product).values({ storeId: a.storeId, handle: 'mine', title: 'Mine' })
    const [other] = await owner
      .insert(product)
      .values({ storeId: b.storeId, handle: 'theirs', title: 'Theirs' })
      .returning()

    const { exportId } = await call(appRouter.storeData.requestExport, undefined, {
      context: ctx(a.headers),
    })
    const overview = await call(appRouter.storeData.overview, undefined, {
      context: ctx(a.headers),
    })
    expect(overview).toMatchObject({ storeName: 'Data A', canExport: true, canDelete: true })
    expect(overview.exports[0]).toMatchObject({ id: exportId, status: 'ready', downloadable: true })

    const file = await call(
      appRouter.storeData.downloadExport,
      { id: exportId },
      { context: ctx(a.headers) },
    )
    expect(file.name).toMatch(/^data-a-data-/)
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()))
    const products = strFromU8(files['tables/product.ndjson'] as Uint8Array)
    expect(products).toContain('"handle":"mine"')
    expect(products).not.toContain(other?.id as string)

    // Store B cannot download store A's export by id.
    await expect(
      call(appRouter.storeData.downloadExport, { id: exportId }, { context: ctx(b.headers) }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('queues the export for the worker when the queue is wired', async () => {
    const a = await merchant('c@example.com', 'data-c', 'Data C')
    const { exportId } = await call(appRouter.storeData.requestExport, undefined, {
      context: ctx(a.headers, { queue: true }),
    })
    expect(queued).toEqual([{ name: 'export', data: { storeId: a.storeId, exportId } }])
    const [row] = await owner.select().from(storeExport).where(eq(storeExport.id, exportId))
    expect(row?.status).toBe('queued')
  })
})

describe('store data: delete', () => {
  it('needs the store name typed exactly, then removes the store and its organization', async () => {
    const a = await merchant('d@example.com', 'data-d', 'Data D')
    const b = await merchant('e@example.com', 'data-e', 'Data E')
    await owner.insert(product).values({ storeId: a.storeId, handle: 'gone', title: 'Gone' })
    await owner.insert(product).values({ storeId: b.storeId, handle: 'kept', title: 'Kept' })

    await expect(
      call(appRouter.storeData.deleteStore, { confirm: 'Data' }, { context: ctx(a.headers) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    // Typing another store's name does not delete anything either.
    await expect(
      call(appRouter.storeData.deleteStore, { confirm: 'Data E' }, { context: ctx(a.headers) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    const result = await call(
      appRouter.storeData.deleteStore,
      { confirm: ' data d ' },
      { context: ctx(a.headers) },
    )
    expect(result.deleted).toBe(true)

    expect(await owner.select().from(store).where(eq(store.id, a.storeId))).toEqual([])
    expect(await owner.select().from(product).where(eq(product.storeId, a.storeId))).toEqual([])
    expect(
      await owner
        .select()
        .from(authSchema.organization)
        .where(eq(authSchema.organization.id, a.organizationId)),
    ).toEqual([])
    expect(await owner.select().from(product).where(eq(product.storeId, b.storeId))).toHaveLength(1)
    const audit = await owner.select().from(platformAuditEvent)
    expect(audit.map((e) => e.action)).toEqual(['store.deleted'])

    // The deleted store's admin no longer opens.
    await expect(
      call(appRouter.products.list, { page: 1, perPage: 10 }, { context: ctx(a.headers) }),
    ).rejects.toBeDefined()
  })

  it('refuses anyone but the owner, even an admin with settings.manage', async () => {
    const boss = await merchant('f@example.com', 'data-f', 'Data F')
    await call(appRouter.staff.me, {}, { context: ctx(boss.headers) })
    const helperHeaders = await signIn('helper@example.com')
    const helperId = (await auth.api.getSession({ headers: helperHeaders }))?.user.id as string
    await auth.api.addMember({
      body: { userId: helperId, role: 'member', organizationId: boss.organizationId },
    })
    await auth.api.setActiveOrganization({
      headers: helperHeaders,
      body: { organizationId: boss.organizationId },
    })
    const [adminRole] = await owner
      .select()
      .from(role)
      .where(and(eq(role.storeId, boss.storeId), eq(role.slug, 'admin')))
    await owner
      .insert(storeMember)
      .values({ storeId: boss.storeId, userId: helperId, roleId: adminRole?.id as string })

    const overview = await call(appRouter.storeData.overview, undefined, {
      context: ctx(helperHeaders),
    })
    expect(overview).toMatchObject({ canExport: true, canDelete: false })
    await expect(
      call(appRouter.storeData.deleteStore, { confirm: 'Data F' }, { context: ctx(helperHeaders) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await owner.select().from(store).where(eq(store.id, boss.storeId))).toHaveLength(1)
  })
})
