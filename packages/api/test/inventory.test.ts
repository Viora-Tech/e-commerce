import { createMerchantAuth } from '@commerce/auth'
import { createDb, inventoryLevel, newId, product, store, variant } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
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

async function seedVariant(storeId: string, onHand: number, sku = 'GP-1') {
  const productId = newId()
  await owner
    .insert(product)
    .values({ id: productId, storeId, title: 'Glasspad', handle: `pad-${productId}` })
  const variantId = newId()
  await owner.insert(variant).values({
    id: variantId,
    storeId,
    productId,
    title: 'Default',
    pricePaise: 250000,
    sku,
  })
  await owner.insert(inventoryLevel).values({ storeId, variantId, onHand })
  return variantId
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('inventory router', () => {
  it('lists stock at the default location and edits it inline', async () => {
    const m = await merchant('inv@example.com', 'inv-a')
    const variantId = await seedVariant(m.storeId, 8)
    const [loc] = await call(appRouter.inventory.locations, undefined, { context: m.ctx })
    expect(loc).toMatchObject({ isDefault: true, fulfilsOnlineOrders: true })
    const locationId = loc?.id as string

    const list = await call(appRouter.inventory.list, { locationId }, { context: m.ctx })
    expect(list.total).toBe(1)
    expect(list.rows[0]).toMatchObject({ variantId, onHand: 8, available: 8, sku: 'GP-1' })

    const next = await call(
      appRouter.inventory.edit,
      { variantId, locationId, mode: 'set', value: 3, reason: 'correction' },
      { context: m.ctx },
    )
    expect(next).toBe(3)

    await expect(
      call(
        appRouter.inventory.edit,
        { variantId, locationId, mode: 'adjust', value: -4, reason: 'damaged' },
        { context: m.ctx },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    const history = await call(appRouter.inventory.history, { variantId }, { context: m.ctx })
    expect(history.map((h) => h.delta)).toEqual([-5])

    const stats = await call(appRouter.inventory.stats, { locationId }, { context: m.ctx })
    expect(stats).toMatchObject({ skus: 1, outOfStock: 0, lowStock: 1 })
  })

  it('bulk adjusts by a delta and refuses, naming SKUs, when any would go below zero', async () => {
    const m = await merchant('bulk@example.com', 'inv-bulk')
    const a = await seedVariant(m.storeId, 10, 'BULK-A')
    const b = await seedVariant(m.storeId, 2, 'BULK-B')
    const [loc] = await call(appRouter.inventory.locations, undefined, { context: m.ctx })
    const locationId = loc?.id as string
    const onHand = async () => {
      const list = await call(appRouter.inventory.list, { locationId }, { context: m.ctx })
      return Object.fromEntries(list.rows.map((r) => [r.sku, r.onHand]))
    }

    await expect(
      call(
        appRouter.inventory.bulkEdit,
        { locationId, variantIds: [a, b], mode: 'adjust', value: -4, reason: 'damaged' },
        { context: m.ctx },
      ),
    ).rejects.toThrow('Stock would go below zero for BULK-B')
    expect(await onHand()).toEqual({ 'BULK-A': 10, 'BULK-B': 2 })

    const res = await call(
      appRouter.inventory.bulkEdit,
      {
        locationId,
        variantIds: [a, b],
        mode: 'adjust',
        value: -2,
        reason: 'damaged',
        note: 'Water leak',
      },
      { context: m.ctx },
    )
    expect(res).toEqual({ updated: 2 })
    expect(await onHand()).toEqual({ 'BULK-A': 8, 'BULK-B': 0 })

    const history = await call(
      appRouter.inventory.history,
      { variantId: a, locationId },
      { context: m.ctx },
    )
    expect(history[0]).toMatchObject({ delta: -2, reason: 'damaged', note: 'Water leak' })

    await call(
      appRouter.inventory.bulkEdit,
      { locationId, variantIds: [a, b], mode: 'adjust', value: 5, reason: 'received' },
      { context: m.ctx },
    )
    expect(await onHand()).toEqual({ 'BULK-A': 13, 'BULK-B': 5 })
  })

  it('runs a purchase order from draft to received', async () => {
    const m = await merchant('po@example.com', 'inv-b')
    const variantId = await seedVariant(m.storeId, 0)
    const [loc] = await call(appRouter.inventory.locations, undefined, { context: m.ctx })
    const locationId = loc?.id as string

    const id = await call(
      appRouter.purchaseOrders.save,
      {
        supplierName: 'Pulsar Gaming',
        locationId,
        lines: [{ variantId, quantity: 10, unitPriceMinor: 120000 }],
      },
      { context: m.ctx },
    )
    await call(
      appRouter.purchaseCharges.add,
      { purchaseOrderId: id, kind: 'freight_local', amountMinor: 10000 },
      { context: m.ctx },
    )
    await call(appRouter.purchaseOrders.markOrdered, { id }, { context: m.ctx })
    let [row] = (await call(appRouter.inventory.list, { locationId }, { context: m.ctx })).rows
    expect(row).toMatchObject({ onHand: 0, incoming: 10 })

    const po = await call(appRouter.purchaseOrders.get, { id }, { context: m.ctx })
    expect(po?.totals).toMatchObject({ units: 10, totalPaise: 1210000 })
    const lineId = po?.lines[0]?.id as string
    await call(
      appRouter.purchaseOrders.receive,
      { id, receipts: [{ lineId, accepted: 10 }] },
      { context: m.ctx },
    )
    ;[row] = (await call(appRouter.inventory.list, { locationId }, { context: m.ctx })).rows
    expect(row).toMatchObject({ onHand: 10, incoming: 0 })
    const listed = await call(appRouter.purchaseOrders.list, {}, { context: m.ctx })
    expect(listed.rows[0]).toMatchObject({ number: 1, status: 'received', receivedUnits: 10 })
  })

  it('keeps each store to its own locations', async () => {
    const a = await merchant('a@example.com', 'inv-c')
    const b = await merchant('b@example.com', 'inv-d')
    const made = await call(
      appRouter.inventory.createLocation,
      { name: 'Warehouse' },
      { context: a.ctx },
    )
    const seen = await call(appRouter.inventory.locations, undefined, { context: b.ctx })
    expect(seen.map((l) => l.name)).toEqual(['Default location'])
    await expect(
      call(appRouter.inventory.updateLocation, { id: made.id, name: 'Mine' }, { context: b.ctx }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    const renamed = await call(
      appRouter.inventory.updateLocation,
      { id: made.id, name: 'Pune warehouse', city: 'Pune', stateCode: 'MH' },
      { context: a.ctx },
    )
    expect(renamed).toMatchObject({ name: 'Pune warehouse', city: 'Pune', stateCode: 'MH' })
    const none = await call(appRouter.transfers.list, { search: 'Warehouse' }, { context: a.ctx })
    expect(none.total).toBe(0)
  })

  it('finds a purchase order by its displayed number and says when one is missing', async () => {
    const m = await merchant('search@example.com', 'inv-e')
    const variantId = await seedVariant(m.storeId, 0)
    const [loc] = await call(appRouter.inventory.locations, undefined, { context: m.ctx })
    const make = (supplierName: string) =>
      call(
        appRouter.purchaseOrders.save,
        {
          supplierName,
          locationId: loc?.id as string,
          lines: [{ variantId, quantity: 1, unitPriceMinor: 0 }],
        },
        { context: m.ctx },
      )
    await make('Alpha')
    await make('Beta')
    for (const search of ['2', '#2', 'PO2', '#PO2', 'po 2', ' #po 2 ']) {
      const res = await call(appRouter.purchaseOrders.list, { search }, { context: m.ctx })
      expect(
        res.rows.map((r) => r.supplierName),
        search,
      ).toEqual(['Beta'])
    }
    await expect(
      call(appRouter.purchaseOrders.get, { id: newId() }, { context: m.ctx }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
