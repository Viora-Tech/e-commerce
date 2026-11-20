import { createMerchantAuth } from '@commerce/auth'
import { cart, cartLine, createDb, inventoryLevel, product, store, variant } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

/*
 * "Where a sale came from" on drafts and abandoned checkouts (18 Nov 2026): a staff draft names
 * who made it (from the activity log), an abandoned checkout carries its cart's attribution,
 * and the abandoned list filters by channel as Orders does.
 */

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

const DAY = 86_400_000

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

async function seedVariant(storeId: string) {
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: 'pad', title: 'Glasspad', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'Black', pricePaise: 100_000 })
    .returning()
  const variantId = v?.id as string
  await owner.insert(inventoryLevel).values({ storeId, variantId, onHand: 10 })
  return variantId
}

const draftOf = (variantId: string) => ({
  customerId: null,
  email: 'aarav@example.in',
  phone: null,
  customerName: 'Aarav',
  shipping: {
    name: 'Aarav',
    line1: '12 MG Road',
    city: 'Gurugram',
    stateCode: 'HR',
    pincode: '122001',
    phone: '9876543210',
  },
  lines: [{ variantId, quantity: 1, unitPricePaise: 100_000 }],
  discountPaise: 0,
  discountLabel: null,
  shippingPaise: 0,
  paymentMethod: 'manual',
  note: null,
})

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('sale source on drafts', () => {
  it('names the member who made a staff draft, not one who edited it later', async () => {
    const m = await merchant('maker@example.com', 'source-drafts')
    const variantId = await seedVariant(m.storeId)
    const made = await call(
      appRouter.orders.saveDraft,
      { draft: draftOf(variantId) },
      { context: m.ctx },
    )
    const id = made?.id as string
    const first = await call(appRouter.orders.getDraft, { id }, { context: m.ctx })
    expect(first?.attribution).toBeNull()
    expect(first?.createdBy).toMatchObject({ source: 'admin' })
    expect(first?.createdBy?.name).toBeTruthy()

    await call(
      appRouter.orders.saveDraft,
      { id, draft: { ...draftOf(variantId), note: 'Gift wrap' } },
      { context: m.ctx },
    )
    const edited = await call(appRouter.orders.getDraft, { id }, { context: m.ctx })
    expect(edited?.createdBy?.at).toEqual(first?.createdBy?.at)

    // A copy names its own maker: the log row points at the new draft, not the source.
    const copy = await call(appRouter.orders.duplicateOrder, { id }, { context: m.ctx })
    const copied = await call(
      appRouter.orders.getDraft,
      { id: copy?.id as string },
      { context: m.ctx },
    )
    expect(copied?.createdBy).toMatchObject({ source: 'admin' })
  })
})

describe('sale source on abandoned checkouts', () => {
  it('returns the cart attribution and filters the list by channel', async () => {
    const m = await merchant('carts@example.com', 'source-carts')
    const variantId = await seedVariant(m.storeId)
    const left = new Date(Date.now() - 2 * 3_600_000)
    const [social, untracked] = await owner
      .insert(cart)
      .values([
        {
          storeId: m.storeId,
          email: 'riya@example.com',
          updatedAt: left,
          attribution: {
            channel: 'social',
            source: 'instagram',
            medium: 'social',
            campaign: 'diwali',
            landing: '/products/pad',
            at: new Date(Date.now() - DAY).toISOString(),
          },
        },
        { storeId: m.storeId, email: 'kabir@example.com', updatedAt: left },
      ])
      .returning()
    await owner.insert(cartLine).values(
      [social, untracked].map((c) => ({
        storeId: m.storeId,
        cartId: c?.id as string,
        variantId,
        quantity: 1,
        unitPricePaise: 100_000,
      })),
    )

    const detail = await call(
      appRouter.orders.getAbandoned,
      { id: social?.id as string },
      { context: m.ctx },
    )
    expect(detail.attribution).toMatchObject({ channel: 'social', campaign: 'diwali' })

    const list = async (channels?: ('social' | 'email' | 'untracked')[]) =>
      (
        await call(
          appRouter.orders.listAbandoned,
          { page: 1, perPage: 50, ...(channels ? { channels } : {}) },
          { context: m.ctx },
        )
      ).items
    const all = await list()
    expect(all.find((c) => c.id === social?.id)?.channel).toBe('social')
    expect(all.find((c) => c.id === untracked?.id)?.channel).toBeNull()
    expect((await list(['social'])).map((c) => c.id)).toEqual([social?.id])
    expect((await list(['untracked'])).map((c) => c.id)).toEqual([untracked?.id])
    expect(await list(['email'])).toEqual([])
  })
})
