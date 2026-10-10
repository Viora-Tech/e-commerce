import { createMerchantAuth } from '@commerce/auth'
import { cart, cartLine, createDb, product, store, variant } from '@commerce/db'
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

describe('abandoned checkout detail', () => {
  it('returns lines, totals and a recovery link, and hides other stores carts', async () => {
    const a = await merchant('ab-a@example.com', 'ab-a')
    const b = await merchant('ab-b@example.com', 'ab-b')
    const [p] = await owner
      .insert(product)
      .values({
        storeId: a.storeId,
        handle: 'mouse',
        title: 'Void Black Mousepad',
        status: 'active',
      })
      .returning()
    const [v] = await owner
      .insert(variant)
      .values({ storeId: a.storeId, productId: p?.id as string, title: 'L', pricePaise: 129_900 })
      .returning()
    const [c] = await owner
      .insert(cart)
      .values({ storeId: a.storeId, email: 'riya@example.com', customerName: 'Riya' })
      .returning()
    await owner.insert(cartLine).values({
      storeId: a.storeId,
      cartId: c?.id as string,
      variantId: v?.id as string,
      quantity: 2,
      unitPricePaise: 129_900,
    })

    const detail = await call(
      appRouter.orders.getAbandoned,
      { id: c?.id as string },
      { context: a.ctx },
    )
    expect(detail).toMatchObject({
      email: 'riya@example.com',
      recovered: false,
      itemCount: 2,
      subtotalPaise: 259_800,
      lines: [{ productTitle: 'Void Black Mousepad', variantTitle: 'L', totalPaise: 259_800 }],
    })
    expect(detail.recoveryUrl).toContain('/checkout/recover/')

    await expect(
      call(appRouter.orders.getAbandoned, { id: c?.id as string }, { context: b.ctx }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    await owner.update(cart).set({ status: 'converted' })
    const done = await call(
      appRouter.orders.getAbandoned,
      { id: c?.id as string },
      { context: a.ctx },
    )
    expect(done).toMatchObject({ recovered: true, recoveryUrl: null })
  })
})
