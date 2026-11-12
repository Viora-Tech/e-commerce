import { createMerchantAuth } from '@commerce/auth'
import { createDb, newId, order, orderLine, product, store, variant } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
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
  const ctx: ApiContext = { db: app, auth, headers, notifications: { add: async () => undefined } }
  return { ctx, storeId: s?.id as string }
}

type Merchant = Awaited<ReturnType<typeof merchant>>

/** A product with one variant per size, SKU `<title>-<size>`. */
async function seedProduct(storeId: string, title: string, sizes: string[]) {
  const productId = newId()
  await owner
    .insert(product)
    .values({ id: productId, storeId, title, handle: `p-${productId}`, status: 'active' })
  const variants: Record<string, string> = {}
  for (const [position, size] of sizes.entries()) {
    const id = newId()
    variants[size] = id
    await owner.insert(variant).values({
      id,
      storeId,
      productId,
      title: size,
      pricePaise: 1000,
      sku: `${title}-${size}`,
      position,
    })
  }
  return { productId, variants }
}

/** An order with one line per variant. */
async function seedOrder(
  storeId: string,
  o: Partial<typeof order.$inferInsert> & { number: number; variantIds: string[] },
) {
  const { variantIds, ...rest } = o
  const id = newId()
  await owner
    .insert(order)
    .values({ id, storeId, status: 'open', subtotalPaise: 1000, totalPaise: 1000, ...rest })
  for (const variantId of variantIds) {
    await owner.insert(orderLine).values({
      storeId,
      orderId: id,
      variantId,
      title: 'Line',
      quantity: 1,
      unitPricePaise: 1000,
    })
  }
  return id
}

const numbers = async (m: Merchant, input: object) =>
  (await call(appRouter.orders.list, { page: 1, perPage: 50, ...input }, { context: m.ctx })).items
    .map((o) => o.number)
    .sort((a, b) => a - b)

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('orders list Product picker filter', () => {
  it('matches orders by picked products and variants, or excludes them', async () => {
    const m = await merchant('pick-orders@example.com', 'pick-orders')
    const pad = await seedProduct(m.storeId, 'Glasspad', ['S', 'M', 'L'])
    const mouse = await seedProduct(m.storeId, 'Mouse', ['Default'])
    const v = (p: { variants: Record<string, string> }, size: string) => p.variants[size] as string

    await seedOrder(m.storeId, { number: 1, variantIds: [v(pad, 'S')], paymentStatus: 'paid' })
    await seedOrder(m.storeId, { number: 2, variantIds: [v(pad, 'M'), v(mouse, 'Default')] })
    await seedOrder(m.storeId, {
      number: 3,
      variantIds: [v(mouse, 'Default')],
      paymentStatus: 'paid',
    })
    await seedOrder(m.storeId, { number: 4, status: 'draft', variantIds: [v(pad, 'L')] })

    // A product stands for every variant; the draft never shows.
    expect(await numbers(m, { productIds: [pad.productId] })).toEqual([1, 2])
    // A single variant.
    expect(await numbers(m, { variantIds: [v(pad, 'S')] })).toEqual([1])
    // Products and variants together: any line in the set.
    expect(await numbers(m, { productIds: [mouse.productId], variantIds: [v(pad, 'S')] })).toEqual([
      1, 2, 3,
    ])
    // Is not: no line in the set.
    expect(await numbers(m, { productIds: [pad.productId], excludeProducts: true })).toEqual([3])
    expect(await numbers(m, { variantIds: [v(pad, 'M')], excludeProducts: true })).toEqual([1, 3])
    // Combined with the payment filter, the old text filter and the tab.
    expect(await numbers(m, { productIds: [mouse.productId], paymentStatus: ['paid'] })).toEqual([
      3,
    ])
    // A pad order that also has a mouse line (the old text filter matches the SKU).
    expect(
      await numbers(m, { view: 'all', productIds: [pad.productId], product: 'mouse' }),
    ).toEqual([2])
    expect(
      await numbers(m, { productIds: [pad.productId], excludeProducts: true, product: 'mouse' }),
    ).toEqual([3])
    // "Select all" uses the same filter.
    const ids = await call(
      appRouter.orders.ids,
      { variantIds: [v(mouse, 'Default')], excludeProducts: true },
      { context: m.ctx },
    )
    expect(ids).toHaveLength(1)
  })

  it('looks picked products up by id or variant, and pages the picker', async () => {
    const m = await merchant('pick-lookup@example.com', 'pick-lookup')
    const pad = await seedProduct(m.storeId, 'Glasspad', ['S', 'M'])
    const mouse = await seedProduct(m.storeId, 'Mouse', ['Default'])
    await owner.update(product).set({ status: 'archived' }).where(eq(product.id, mouse.productId))

    const pick = (input: object) =>
      call(appRouter.products.pick, { limit: 30, ...input }, { context: m.ctx })
    // An archived product still names itself when a saved filter picked it.
    const found = await pick({ variantIds: [mouse.variants.Default as string] })
    expect(found.map((r) => r.title)).toEqual(['Mouse'])
    const both = await pick({
      ids: [pad.productId],
      variantIds: [mouse.variants.Default as string],
    })
    expect(both.map((r) => r.title)).toEqual(['Glasspad', 'Mouse'])
    // A SKU finds its product; the list pages with offset.
    expect((await pick({ search: 'glasspad-m' })).map((r) => r.title)).toEqual(['Glasspad'])
    await seedProduct(m.storeId, 'Keyboard', ['Default'])
    expect((await pick({ limit: 1 })).map((r) => r.title)).toEqual(['Glasspad'])
    expect((await pick({ limit: 1, offset: 1 })).map((r) => r.title)).toEqual(['Keyboard'])
  })
})
