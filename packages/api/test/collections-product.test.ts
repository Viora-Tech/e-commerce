import { createMerchantAuth } from '@commerce/auth'
import { createDb, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call, ORPCError } from '@orpc/server'
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
  await owner.insert(store).values({ slug, name: slug, organizationId: org?.id as string })
  return { db: app, auth, headers, notifications: { add: async () => undefined } } as ApiContext
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** #804's product: a fresh draft, no options, nothing in stock, no vendor, type or category. */
async function draftProduct(ctx: ApiContext): Promise<string> {
  const saved = await call(
    appRouter.products.save,
    {
      title: 'HITSCAN Hyperlight X',
      status: 'draft',
      variants: [{ optionValues: [], pricePaise: 999_900 }],
    },
    { context: ctx },
  )
  return (saved as { id: string }).id
}

async function manualCollection(ctx: ApiContext, title: string): Promise<string> {
  const { id } = await call(
    appRouter.collections.create,
    { title, kind: 'manual' },
    { context: ctx },
  )
  return id
}

describe('collections.setForProduct (#804)', () => {
  it('adds a fresh draft product to manual collections and lists them back', async () => {
    const ctx = await merchant('coll-a@example.com', 'coll-a')
    const productId = await draftProduct(ctx)
    const hitscan = await manualCollection(ctx, 'Hitscan')
    const mice = await manualCollection(ctx, 'Mice')

    await call(
      appRouter.collections.setForProduct,
      { productId, collectionIds: [hitscan, mice] },
      { context: ctx },
    )
    const memberOf = await call(appRouter.collections.forProduct, { productId }, { context: ctx })
    expect([...memberOf].sort()).toEqual([hitscan, mice].sort())

    await call(
      appRouter.collections.setForProduct,
      { productId, collectionIds: [mice] },
      { context: ctx },
    )
    expect(await call(appRouter.collections.forProduct, { productId }, { context: ctx })).toEqual([
      mice,
    ])
  })

  // What the organisation card sent: the picker's Select reported `null` when its item list
  // changed and the card added String(null) next to the real collection.
  it('turns down a non-id collection with an issue that names the field and position', async () => {
    const ctx = await merchant('coll-b@example.com', 'coll-b')
    const productId = await draftProduct(ctx)
    const hitscan = await manualCollection(ctx, 'Hitscan')

    const err = await call(
      appRouter.collections.setForProduct,
      { productId, collectionIds: [hitscan, 'null'] },
      { context: ctx },
    ).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(ORPCError)
    const e = err as ORPCError<string, { issues: { path: unknown[]; code: string }[] }>
    expect(e.code).toBe('BAD_REQUEST')
    expect(e.message).toBe('Input validation failed')
    expect(e.data.issues).toEqual([
      expect.objectContaining({ code: 'invalid_format', path: ['collectionIds', 1] }),
    ])
    expect(await call(appRouter.collections.forProduct, { productId }, { context: ctx })).toEqual(
      [],
    )
  })
})
