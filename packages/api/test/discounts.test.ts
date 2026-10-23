import { createMerchantAuth } from '@commerce/auth'
import { createDb, discount, discountUsage, order, store } from '@commerce/db'
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
  return {
    ctx: { db: app, auth, headers, notifications: { add: async () => undefined } } as ApiContext,
    storeId: s?.id as string,
  }
}

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000)

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('discounts', () => {
  it('creates, lists by lifecycle, rejects duplicate codes and reports stats, per store', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const b = await merchant('b@example.com', 'store-b')

    const created = await call(
      appRouter.discounts.create,
      { title: 'Launch', kind: 'code', code: 'launch10', method: 'percent', value: 1000 },
      { context: a.ctx },
    )
    expect(created).toMatchObject({ code: 'LAUNCH10', status: 'active', usedCount: 0 })

    await call(
      appRouter.discounts.create,
      {
        title: 'Diwali',
        kind: 'automatic',
        method: 'fixed',
        value: 20000,
        startsAt: daysFromNow(5),
      },
      { context: a.ctx },
    )
    await call(
      appRouter.discounts.create,
      {
        title: 'Old',
        kind: 'code',
        code: 'OLD',
        method: 'free_shipping',
        value: 0,
        endsAt: daysFromNow(-1),
      },
      { context: a.ctx },
    )
    // Same code in another store is fine; in the same store it is a conflict.
    await call(
      appRouter.discounts.create,
      { title: 'Other', kind: 'code', code: 'LAUNCH10', method: 'percent', value: 500 },
      { context: b.ctx },
    )
    await expect(
      call(
        appRouter.discounts.create,
        { title: 'Dupe', kind: 'code', code: 'launch10', method: 'percent', value: 500 },
        { context: a.ctx },
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' })

    const all = await call(appRouter.discounts.list, {}, { context: a.ctx })
    expect(all.total).toBe(3)
    expect(all.items.map((d) => d.lifecycle).sort()).toEqual(['active', 'expired', 'scheduled'])
    const active = await call(appRouter.discounts.list, { lifecycle: 'active' }, { context: a.ctx })
    expect(active.items.map((d) => d.code)).toEqual(['LAUNCH10'])
    const search = await call(appRouter.discounts.list, { search: 'diw' }, { context: a.ctx })
    expect(search.items.map((d) => d.title)).toEqual(['Diwali'])

    const stats = await call(appRouter.discounts.stats, undefined, { context: a.ctx })
    expect(stats).toMatchObject({ active: 1, scheduled: 1, expired: 1, usedThisMonth: 0 })

    const other = await call(appRouter.discounts.list, {}, { context: b.ctx })
    expect(other.total).toBe(1)
  })

  it('validates input, toggles, and disables instead of deleting a used discount', async () => {
    const a = await merchant('a@example.com', 'store-a')
    await expect(
      call(
        appRouter.discounts.create,
        { title: 'No code', kind: 'code', method: 'percent', value: 1000 },
        { context: a.ctx },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await expect(
      call(
        appRouter.discounts.create,
        { title: 'Too much', kind: 'automatic', method: 'percent', value: 20000 },
        { context: a.ctx },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    const d = await call(
      appRouter.discounts.create,
      { title: 'Flat', kind: 'code', code: 'FLAT', method: 'fixed', value: 5000 },
      { context: a.ctx },
    )
    if (!d) throw new Error('create')
    const off = await call(
      appRouter.discounts.toggle,
      { id: d.id, status: 'disabled' },
      { context: a.ctx },
    )
    expect(off?.status).toBe('disabled')

    const updated = await call(
      appRouter.discounts.update,
      {
        id: d.id,
        data: { title: 'Flat 60', kind: 'code', code: 'FLAT', method: 'fixed', value: 6000 },
      },
      { context: a.ctx },
    )
    expect(updated).toMatchObject({ title: 'Flat 60', value: 6000, status: 'active' })

    const [o] = await owner
      .insert(order)
      .values({
        storeId: a.storeId,
        number: 1,
        subtotalPaise: 10000,
        totalPaise: 4000,
        discountId: d.id,
        discountPaise: 6000,
      })
      .returning()
    await owner.insert(discountUsage).values({
      storeId: a.storeId,
      discountId: d.id,
      orderId: o?.id as string,
      amountPaise: 6000,
    })
    const detail = await call(appRouter.discounts.get, { id: d.id }, { context: a.ctx })
    expect(detail?.usage).toEqual({ orders: 1, amountPaise: 6000 })
    const gone = await call(appRouter.discounts.delete, { id: d.id }, { context: a.ctx })
    expect(gone).toEqual({ outcome: 'disabled' })
    const [row] = await owner.select().from(discount).where(eq(discount.id, d.id))
    expect(row?.status).toBe('disabled')
  })

  it('saves a different amount for each product, and clears it when switched back', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const x = crypto.randomUUID()
    const y = crypto.randomUUID()
    const input = {
      title: 'Killtoned',
      kind: 'code' as const,
      code: 'killtoned',
      method: 'fixed' as const,
      value: 0,
      appliesTo: 'products' as const,
      appliesToIds: [x, y],
      productValues: { [x]: 20_000, [y]: 30_000 },
    }
    const d = await call(appRouter.discounts.create, input, { context: a.ctx })
    if (!d) throw new Error('create')
    expect(d).toMatchObject({ value: 0, productValues: { [x]: 20_000, [y]: 30_000 } })

    const list = await call(appRouter.discounts.list, {}, { context: a.ctx })
    expect(list.items[0]).toMatchObject({ appliesTo: 'products', productValues: { [x]: 20_000 } })

    await expect(
      call(
        appRouter.discounts.create,
        { ...input, code: 'MISSING', productValues: { [x]: 20_000 } },
        { context: a.ctx },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    const single = await call(
      appRouter.discounts.update,
      { id: d.id, data: { ...input, value: 20_000, productValues: null } },
      { context: a.ctx },
    )
    expect(single).toMatchObject({ value: 20_000, productValues: null })
  })

  it('duplicates a discount as a paused copy with a free code and no usage', async () => {
    const a = await merchant('dup@example.com', 'store-dup')
    const d = await call(
      appRouter.discounts.create,
      { title: 'Diwali', kind: 'code', code: 'diwali10', method: 'percent', value: 1000 },
      { context: a.ctx },
    )
    if (!d) throw new Error('create')
    await owner.update(discount).set({ usedCount: 5 }).where(eq(discount.id, d.id))

    const first = await call(appRouter.discounts.duplicate, { id: d.id }, { context: a.ctx })
    expect(first).toMatchObject({
      title: 'Diwali (copy)',
      code: 'DIWALI10-COPY',
      status: 'disabled',
      usedCount: 0,
      value: 1000,
    })
    const second = await call(appRouter.discounts.duplicate, { id: d.id }, { context: a.ctx })
    expect(second).toMatchObject({ code: 'DIWALI10-COPY2', status: 'disabled' })
    expect(
      await call(appRouter.discounts.duplicate, { id: crypto.randomUUID() }, { context: a.ctx }),
    ).toBeNull()
  })

  it('saves Shopify types: buy X get Y, free shipping limits, eligibility and combinations', async () => {
    const a = await merchant('t@example.com', 'store-t')
    const P = '00000000-0000-4000-8000-000000000001'
    const bogo = await call(
      appRouter.discounts.create,
      {
        title: 'BOGO',
        type: 'bxgy',
        kind: 'automatic',
        method: 'percent',
        value: 10_000,
        bxgy: {
          buys: { kind: 'quantity', quantity: 1, amountPaise: 0, appliesTo: 'products', ids: [P] },
          gets: { quantity: 1, appliesTo: 'products', ids: [P] },
          maxUsesPerOrder: 2,
        },
        combinesWith: { products: false, order: true, shipping: true },
      },
      { context: a.ctx },
    )
    const ship = await call(
      appRouter.discounts.create,
      {
        title: 'Ship',
        type: 'shipping',
        kind: 'code',
        code: 'SHIPKA',
        method: 'free_shipping',
        value: 0,
        minQuantity: 2,
        shippingStates: ['KA'],
        maxShippingPaise: 15_000,
        customerEligibility: 'customers',
        eligibleIds: [P],
      },
      { context: a.ctx },
    )
    const got = await call(appRouter.discounts.get, { id: bogo?.id as string }, { context: a.ctx })
    expect(got).toMatchObject({ type: 'bxgy', bxgy: { maxUsesPerOrder: 2 } })
    expect(got?.combinesWith).toEqual({ products: false, order: true, shipping: true })
    const gotShip = await call(
      appRouter.discounts.get,
      { id: ship?.id as string },
      { context: a.ctx },
    )
    expect(gotShip).toMatchObject({
      type: 'shipping',
      minQuantity: 2,
      shippingStates: ['KA'],
      maxShippingPaise: 15_000,
      customerEligibility: 'customers',
      eligibleIds: [P],
    })
    // An older-shaped input still saves, with the type derived and nothing stacking.
    const old = await call(
      appRouter.discounts.create,
      { title: 'Old', kind: 'code', code: 'OLD5', method: 'fixed', value: 500 },
      { context: a.ctx },
    )
    const gotOld = await call(
      appRouter.discounts.get,
      { id: old?.id as string },
      { context: a.ctx },
    )
    expect(gotOld).toMatchObject({ type: 'order', customerEligibility: 'all', bxgy: null })
  })
})
