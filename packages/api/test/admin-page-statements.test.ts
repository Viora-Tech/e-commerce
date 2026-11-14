import { writeFileSync } from 'node:fs'
import { createMerchantAuth } from '@commerce/auth'
import {
  createDb,
  media,
  newId,
  order,
  orderLine,
  product,
  productMedia,
  productOption,
  productOptionValue,
  role,
  rolePermission,
  store,
  storeActivity,
  storeMember,
  variant,
  variantMedia,
  variantOptionValue,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { createRequestMemo } from '../src/procedures/request-memo'
import { appRouter } from '../src/routers/_app'

/**
 * How many SQL statements the Orders list and the product page cost, counted on the driver
 * (`begin`, `set_config` and `commit` included), the way `scripts/perf/admin-pages.ts` counts
 * them from Postgres' log. A server render shares one request memo (`serverContext`); the
 * browser's reads at load go in one batched request with its own memo (`/api/rpc/__batch__`).
 * The ceilings catch a change that brings back a per-row or per-call read. The page calls
 * (`orders.listPage`, `products.getPage`) must answer exactly what the separate calls did.
 */

const statements: string[] = []
const app = createDb(process.env.DATABASE_URL as string, {
  onStatement: (query) => statements.push(query),
})
const owner = createDb(process.env.DATABASE_URL_OWNER as string)

const sent: { email: string; otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

let headers: Headers
let storeId: string
let orgId: string
let productId: string
let variantIds: string[] = []
let mediaIds: string[] = []

const BOX = {
  id: 'box-s',
  name: 'Small box',
  kind: 'box' as const,
  lengthCm: 20,
  widthCm: 15,
  heightCm: 10,
  weightGrams: 120,
  isDefault: true,
  costPaise: null,
}

/** A fresh request: its own memo, as the admin's server render or one batched HTTP call has. */
const request = (): ApiContext => ({
  db: app,
  auth,
  headers,
  notifications: { add: async () => undefined },
  memo: createRequestMemo(),
})

/** `STATEMENTS_DUMP=<dir>`: writes each measured page's statements there, one file per page. */
function dump(name: string, sql: string[]) {
  const dir = process.env.STATEMENTS_DUMP
  if (dir) writeFileSync(`${dir}/${name}.sql`, sql.map((q) => q.replace(/\s+/g, ' ')).join('\n'))
}

/** Statements run by `fn`, after one warm-up run (type lookups, prepared statements). */
async function count(fn: () => Promise<unknown>): Promise<{ n: number; sql: string[] }> {
  await fn()
  statements.length = 0
  await fn()
  return { n: statements.length, sql: [...statements] }
}

/** The layout's `store.shell` alone, to tell the page's own share. */
async function shellOnly() {
  await call(appRouter.store.shell, undefined, { context: request() })
}

/** What `apps/admin/src/app/(admin)/orders/page.tsx` reads, with the layout's `store.shell`. */
async function ordersServer() {
  const context = request()
  await call(appRouter.store.shell, undefined, { context })
  await call(appRouter.orders.listPage, { page: 1, perPage: 50 }, { context })
}

/** The Orders list's reads in the browser at load (the filter panel's options). */
async function ordersClient() {
  await call(appRouter.orders.facets, undefined, { context: request() })
}

/** What `apps/admin/src/app/(admin)/products/[id]/page.tsx` reads, with the layout's shell. */
async function productServer() {
  const context = request()
  await call(appRouter.store.shell, undefined, { context })
  await call(appRouter.products.getPage, { id: productId }, { context })
}

/**
 * The product page's reads in the browser at load: the open tab (Overview) and the side column.
 * The other tabs' cards (stock history, pre-order campaigns, Search Console, app sections) load
 * when their tab is first opened; the shipping boxes come with the server render.
 */
async function productClient() {
  const context = request()
  const soft = (p: Promise<unknown>) => p.catch(() => null)
  await Promise.all([
    soft(call(appRouter.suppliers.list, { perPage: 100 }, { context })),
    soft(call(appRouter.collections.list, undefined, { context })),
    soft(call(appRouter.collections.forProduct, { productId }, { context })),
    soft(call(appRouter.products.sales, { productId }, { context })),
    soft(
      call(
        appRouter.metaobjects.metafields,
        { ownerType: 'product', ownerId: productId },
        { context },
      ),
    ),
  ])
}

/** A second member of the store on a role holding only `perms`. */
async function memberWith(email: string, perms: string[]): Promise<ApiContext> {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  const memberHeaders = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const userId = (await auth.api.getSession({ headers: memberHeaders }))?.user.id as string
  await auth.api.addMember({ body: { userId, role: 'member', organizationId: orgId } })
  await auth.api.setActiveOrganization({ headers: memberHeaders, body: { organizationId: orgId } })
  const [r] = await owner
    .insert(role)
    .values({ storeId, name: 'Cataloguer', slug: 'cataloguer' })
    .returning()
  await owner
    .insert(rolePermission)
    .values(perms.map((permission) => ({ storeId, roleId: r?.id as string, permission })))
  const [existing] = await owner
    .select()
    .from(storeMember)
    .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, userId)))
  if (existing)
    await owner
      .update(storeMember)
      .set({ roleId: r?.id as string })
      .where(eq(storeMember.id, existing.id))
  else await owner.insert(storeMember).values({ storeId, userId, roleId: r?.id as string })
  return { ...request(), headers: memberHeaders }
}

beforeAll(async () => {
  await resetDb(owner)
  const email = 'perf-owner@example.com'
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const org = await auth.api.createOrganization({ headers, body: { name: 'perf', slug: 'perf' } })
  orgId = org?.id as string
  await auth.api.setActiveOrganization({ headers, body: { organizationId: orgId } })
  const [s] = await owner
    .insert(store)
    .values({ slug: 'perf', name: 'perf', organizationId: orgId, shipping: { boxPresets: [BOX] } })
    .returning()
  storeId = s?.id as string

  // One product with two options (4 sizes × 5 colours = 20 variants) and three photos.
  productId = newId()
  await owner
    .insert(product)
    .values({ id: productId, storeId, title: 'Glasspad', handle: 'glasspad', status: 'active' })
  const options = [
    { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
    { name: 'Colour', values: ['Red', 'Blue', 'Green', 'Black', 'White'] },
  ]
  const valueIds: string[][] = []
  for (const [position, o] of options.entries()) {
    const optionId = newId()
    await owner
      .insert(productOption)
      .values({ id: optionId, storeId, productId, name: o.name, position })
    const ids = o.values.map(() => newId())
    await owner.insert(productOptionValue).values(
      o.values.map((value, i) => ({
        id: ids[i] as string,
        storeId,
        optionId,
        value,
        position: i,
      })),
    )
    valueIds.push(ids)
  }
  variantIds = []
  let position = 0
  for (const size of valueIds[0] ?? []) {
    for (const colour of valueIds[1] ?? []) {
      const id = newId()
      variantIds.push(id)
      await owner.insert(variant).values({
        id,
        storeId,
        productId,
        title: `v${position}`,
        sku: `GP-${position}`,
        pricePaise: 1000,
        position: position++,
      })
      await owner.insert(variantOptionValue).values([
        { storeId, variantId: id, optionValueId: size },
        { storeId, variantId: id, optionValueId: colour },
      ])
    }
  }
  mediaIds = []
  for (let i = 0; i < 3; i++) {
    const mediaId = newId()
    mediaIds.push(mediaId)
    await owner.insert(media).values({ id: mediaId, storeId, url: `https://cdn.test/${i}.jpg` })
    await owner.insert(productMedia).values({ storeId, productId, mediaId, position: i })
  }
  // The first variant has two images in its list; the second only its single `media_id`.
  const [m0, m1, m2] = mediaIds as [string, string, string]
  const [v0, v1] = variantIds as [string, string]
  await owner.update(variant).set({ mediaId: m2 }).where(eq(variant.id, v0))
  await owner.insert(variantMedia).values([
    { storeId, variantId: v0, mediaId: m2, position: 0 },
    { storeId, variantId: v0, mediaId: m0, position: 1 },
  ])
  await owner.update(variant).set({ mediaId: m1 }).where(eq(variant.id, v1))

  // 60 orders over the last ten days, two lines each: some cancelled, unpaid, COD, manual
  // transfers, test-mode and archived.
  const now = Date.now()
  for (let n = 1; n <= 60; n++) {
    const id = newId()
    await owner.insert(order).values({
      id,
      storeId,
      number: 1000 + n,
      status: n % 10 === 0 ? 'cancelled' : 'open',
      paymentStatus: n % 3 === 0 ? 'unpaid' : 'paid',
      paymentMethod: n % 4 === 0 ? 'cod' : n % 7 === 0 ? 'manual' : 'razorpay',
      isTest: n % 11 === 0,
      archivedAt: n % 13 === 0 ? new Date() : null,
      subtotalPaise: 2000,
      totalPaise: 2000,
      email: `buyer${n}@example.com`,
      placedAt: new Date(now - (n % 10) * 86_400_000 - 60_000),
    })
    await owner.insert(orderLine).values(
      [0, 1].map((k) => ({
        storeId,
        orderId: id,
        variantId: variantIds[(n + k) % variantIds.length] as string,
        title: 'Glasspad',
        quantity: 1,
        unitPricePaise: 1000,
      })),
    )
  }
  // A shopper's bank-transfer checkout kept as a draft: the Pending UPI card counts it.
  await owner.insert(order).values({
    storeId,
    number: 9001,
    draftNumber: 1,
    status: 'draft',
    draftSource: 'checkout',
    paymentMethod: 'manual',
    subtotalPaise: 500,
    totalPaise: 500,
  })
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('admin page statement counts', () => {
  it('Orders list', async () => {
    const shell = await count(shellOnly)
    const server = await count(ordersServer)
    const client = await count(ordersClient)
    dump('orders-server', server.sql)
    dump('orders-client', client.sql)
    process.stdout.write(
      `orders: server ${server.n} (shell ${shell.n}), browser at load ${client.n}\n`,
    )
    // One transaction: begin, set_config, the aggregate, the rows, the store row, commit.
    expect(server.n - shell.n).toBeLessThanOrEqual(6)
    expect(client.n).toBeLessThanOrEqual(12)
  })

  it('product page', async () => {
    const shell = await count(shellOnly)
    const server = await count(productServer)
    const client = await count(productClient)
    dump('product-server', server.sql)
    dump('product-client', client.sql)
    process.stdout.write(
      `product: server ${server.n} (shell ${shell.n}), browser at load ${client.n}\n`,
    )
    // One transaction: begin, set_config, seven product reads, six facet reads, the boxes, commit.
    expect(server.n - shell.n).toBeLessThanOrEqual(17)
    expect(client.n).toBeLessThanOrEqual(28)
  })

  it('writes no activity log row for a page view', async () => {
    await productServer()
    await productClient()
    await ordersServer()
    const rows = await owner.select().from(storeActivity).where(eq(storeActivity.storeId, storeId))
    expect(rows).toEqual([])
  })
})

describe('orders.listPage', () => {
  const inputs = [
    { page: 1, perPage: 25 },
    { page: 2, perPage: 10 },
    { page: 1, perPage: 25, view: 'unpaid' as const },
    { page: 1, perPage: 25, view: 'pending_upi' as const },
    { page: 1, perPage: 25, view: 'archived' as const },
    { page: 1, perPage: 25, search: 'buyer1' },
    { page: 1, perPage: 25, search: '#1012' },
    { page: 1, perPage: 25, paymentMethod: 'cod' as const },
  ]

  it.each(inputs)('answers what the four separate calls did (%o)', async (input) => {
    const context = request()
    const page = await call(appRouter.orders.listPage, input, { context })
    const [result, counts, tiles, appActions] = await Promise.all([
      call(appRouter.orders.list, input, { context }),
      call(appRouter.orders.tabCounts, undefined, { context }),
      call(appRouter.orders.tiles, undefined, { context }),
      call(appRouter.apps.orderActions, undefined, { context }),
    ])
    expect(page).toEqual({ result, counts, tiles, appActions })
  })

  it('counts the stat cards from the orders', async () => {
    const { tiles, result } = await call(
      appRouter.orders.listPage,
      { page: 1, perPage: 25 },
      { context: request() },
    )
    const ns = Array.from({ length: 60 }, (_, i) => i + 1)
    expect(result.testOrders).toBe(ns.filter((n) => n % 11 === 0).length)
    // Live: not cancelled, not test-mode. Placed n % 10 days ago (and a minute).
    const live = ns.filter((n) => n % 10 !== 0 && n % 11 !== 0)
    const week = live.filter((n) => n % 10 < 7).length
    expect(tiles.salesWeek).toEqual({
      paise: week * 2000,
      previousPaise: (live.length - week) * 2000,
    })
    // Placed today: n % 10 === 0, all cancelled.
    expect(tiles.newToday.value).toBe(0)
    // The bank-transfer draft counts on the Pending UPI card.
    expect(tiles.pendingUpi).toBeGreaterThanOrEqual(1)
  })
})

describe('products.getPage', () => {
  it('answers what get, facets, ai.status and store.getShipping did', async () => {
    const context = request()
    const page = await call(appRouter.products.getPage, { id: productId }, { context })
    const [loaded, facets, shipping, ai] = await Promise.all([
      call(appRouter.products.get, { id: productId }, { context }),
      call(appRouter.products.facets, undefined, { context }),
      call(appRouter.store.getShipping, undefined, { context }),
      call(appRouter.ai.status, undefined, { context }),
    ])
    expect(page).toEqual({
      product: loaded,
      facets,
      boxPresets: shipping.settings.boxPresets,
      aiWriter: ai.productWriter,
    })
    expect(page.boxPresets).toEqual([BOX])
  })

  it('reads the options, variants and images in order', async () => {
    const { product: p, facets } = await call(
      appRouter.products.getPage,
      { id: productId },
      { context: request() },
    )
    expect(p?.options.map((o) => [o.name, o.values.map((v) => v.value)])).toEqual([
      ['Size', ['S', 'M', 'L', 'XL']],
      ['Colour', ['Red', 'Blue', 'Green', 'Black', 'White']],
    ])
    expect(p?.variants).toHaveLength(20)
    expect(p?.variants.slice(0, 6).map((v) => v.optionValues)).toEqual([
      ['S', 'Red'],
      ['S', 'Blue'],
      ['S', 'Green'],
      ['S', 'Black'],
      ['S', 'White'],
      ['M', 'Red'],
    ])
    const [m0, m1, m2] = mediaIds
    expect(p?.variants[0]?.mediaIds).toEqual([m2, m0])
    expect(p?.variants[1]?.mediaIds).toEqual([m1])
    expect(p?.variants[2]?.mediaIds).toEqual([])
    expect(p?.images.map((i) => i.id)).toEqual(mediaIds)
    expect(facets.options).toEqual([
      { name: 'Colour', values: ['Red', 'Blue', 'Green', 'Black', 'White'] },
      { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
    ])
  })

  it('answers no product when it is missing, and for "Add product"', async () => {
    const context = request()
    const missing = await call(appRouter.products.getPage, { id: newId() }, { context })
    expect(missing.product).toBeNull()
    const blank = await call(appRouter.products.getPage, {}, { context })
    expect(blank.product).toBeNull()
    expect(blank.boxPresets).toEqual([BOX])
  })

  it('leaves the boxes out for a role that cannot read settings, as store.getShipping does', async () => {
    const context = await memberWith('cataloguer@example.com', ['products.read'])
    const page = await call(appRouter.products.getPage, { id: productId }, { context })
    expect(page.product?.id).toBe(productId)
    expect(page.boxPresets).toEqual([])
    await expect(call(appRouter.store.getShipping, undefined, { context })).rejects.toThrow()
    // orders.listPage needs orders.read, like the calls it replaced.
    await expect(
      call(appRouter.orders.listPage, { page: 1, perPage: 25 }, { context }),
    ).rejects.toThrow()
  })
})
