import { createMerchantAuth } from '@commerce/auth'
import { createDb, inventoryLevel, newId, product, store, variant } from '@commerce/db'
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

async function seedVariant(storeId: string, weightGrams: number, costPaise: number | null = null) {
  const productId = newId()
  await owner
    .insert(product)
    .values({ id: productId, storeId, title: 'Glasspad', handle: `pad-${productId}` })
  const variantId = newId()
  await owner.insert(variant).values({
    id: variantId,
    storeId,
    productId,
    title: `${weightGrams} g`,
    pricePaise: 500_000,
    weightGrams,
    costPaise,
  })
  await owner.insert(inventoryLevel).values({ storeId, variantId, onHand: 0 })
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

describe('purchasing routers', () => {
  it('keeps suppliers: create, search, read with their orders, edit and delete', async () => {
    const m = await merchant('sup@example.com', 'sup-a')
    const id = await call(
      appRouter.suppliers.save,
      { name: 'Shenzhen Pads Co', country: 'cn', currency: 'USD', paymentTerms: '30% advance' },
      { context: m.ctx },
    )
    const found = await call(appRouter.suppliers.list, { search: 'shenzhen' }, { context: m.ctx })
    expect(found.rows).toEqual([
      expect.objectContaining({ id, country: 'CN', currency: 'USD', orders: 0 }),
    ])
    await call(
      appRouter.suppliers.save,
      { id, name: 'Shenzhen Pads Ltd', country: 'CN', currency: 'USD' },
      { context: m.ctx },
    )
    const got = await call(appRouter.suppliers.get, { id }, { context: m.ctx })
    expect(got).toMatchObject({ name: 'Shenzhen Pads Ltd', paymentTerms: null, orders: [] })
    await call(appRouter.suppliers.delete, { id }, { context: m.ctx })
    await expect(call(appRouter.suppliers.get, { id }, { context: m.ctx })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('runs an import: USD order, shipment charges, preview, receive at landed cost, late bill', async () => {
    const m = await merchant('imp@example.com', 'imp-a')
    const light = await seedVariant(m.storeId, 250)
    const heavy = await seedVariant(m.storeId, 750)
    const [loc] = await call(appRouter.inventory.locations, undefined, { context: m.ctx })
    const supplierId = await call(
      appRouter.suppliers.save,
      { name: 'Shenzhen Pads', country: 'CN', currency: 'USD' },
      { context: m.ctx },
    )
    // 4 × $5 + 4 × $5 at ₹85 = ₹1,700 + ₹1,700
    const poId = await call(
      appRouter.purchaseOrders.save,
      {
        supplierId,
        supplierName: 'Shenzhen Pads',
        locationId: loc?.id as string,
        currency: 'USD',
        fxRate: '85',
        markOrdered: true,
        lines: [
          { variantId: light, quantity: 4, unitPriceMinor: 500, hsnCode: '39269099' },
          { variantId: heavy, quantity: 4, unitPriceMinor: 500 },
        ],
      },
      { context: m.ctx },
    )
    const suppliers = await call(appRouter.suppliers.list, {}, { context: m.ctx })
    expect(suppliers.rows[0]).toMatchObject({ id: supplierId, orders: 1 })
    const shipmentId = await call(
      appRouter.inboundShipments.save,
      { reference: 'MSKU1234567', billOfEntryNo: '7654321', port: 'Nhava Sheva' },
      { context: m.ctx },
    )
    await call(
      appRouter.inboundShipments.attach,
      { id: shipmentId, purchaseOrderId: poId },
      { context: m.ctx },
    )
    // ₹400 freight by weight (1 kg : 3 kg), ₹340 BCD by value, ₹600 IGST recoverable
    await call(
      appRouter.purchaseCharges.add,
      { inboundShipmentId: shipmentId, kind: 'freight_insurance', amountMinor: 40_000 },
      { context: m.ctx },
    )
    await call(
      appRouter.purchaseCharges.add,
      { inboundShipmentId: shipmentId, kind: 'customs_bcd', amountMinor: 34_000 },
      { context: m.ctx },
    )
    await call(
      appRouter.purchaseCharges.add,
      { inboundShipmentId: shipmentId, kind: 'customs_igst', amountMinor: 60_000 },
      { context: m.ctx },
    )

    const preview = await call(appRouter.purchaseOrders.costs, { id: poId }, { context: m.ctx })
    expect(preview.shipmentId).toBe(shipmentId)
    expect(preview.warnings).toEqual([])
    const byVariant = new Map(preview.lines.map((l) => [l.variantId, l]))
    // light: 1,700 + 100 + 170 = 1,970 → ₹492.50; heavy: 1,700 + 300 + 170 = 2,170 → ₹542.50
    expect(byVariant.get(light)).toMatchObject({
      goodsPaise: 170_000,
      chargesPaise: 27_000,
      recoverablePaise: 30_000,
      landedUnitPaise: 49_250,
    })
    expect(byVariant.get(heavy)?.landedUnitPaise).toBe(54_250)
    expect(preview.totals).toMatchObject({
      goodsPaise: 340_000,
      costChargesPaise: 74_000,
      recoverablePaise: 60_000,
      landedPaise: 414_000,
    })
    const shipmentCosts = await call(
      appRouter.inboundShipments.costs,
      { id: shipmentId },
      { context: m.ctx },
    )
    expect(shipmentCosts.charges).toHaveLength(3)
    const shipment = await call(
      appRouter.inboundShipments.get,
      { id: shipmentId },
      { context: m.ctx },
    )
    expect(shipment.orders).toEqual([expect.objectContaining({ id: poId, units: 8 })])

    const po = await call(appRouter.purchaseOrders.get, { id: poId }, { context: m.ctx })
    expect(po).toMatchObject({ supplier: { id: supplierId }, shipment: { id: shipmentId } })
    const lightLine = po.lines.find((l) => l.variantId === light)
    expect(lightLine).toMatchObject({ hsnCode: '39269099', unitCostPaise: 42_500 })
    const result = await call(
      appRouter.purchaseOrders.receive,
      { id: poId, receipts: [{ lineId: lightLine?.id as string, accepted: 3, rejected: 1 }] },
      { context: m.ctx },
    )
    expect(result).toMatchObject({ units: 3, rejected: 1 })
    expect(result.lines[0]).toMatchObject({ costBeforePaise: null, costAfterPaise: 49_250 })

    // A late CHA bill of ₹80 (+ ₹14.40 GST), by value: ₹40 a line, ₹10 a unit on the light line.
    const chaId = await call(
      appRouter.purchaseCharges.add,
      { inboundShipmentId: shipmentId, kind: 'cha_fee', amountMinor: 8000, gstPaise: 1440 },
      { context: m.ctx },
    )
    const [v] = await owner.select().from(variant).where(eq(variant.id, light))
    expect(v?.costPaise).toBe(50_250)
    await call(appRouter.purchaseCharges.remove, { id: chaId }, { context: m.ctx })
    const [back] = await owner.select().from(variant).where(eq(variant.id, light))
    expect(back?.costPaise).toBe(49_250)

    const listed = await call(appRouter.inboundShipments.list, {}, { context: m.ctx })
    expect(listed.rows[0]).toMatchObject({ id: shipmentId, orders: 1, charges: 3 })
    await call(appRouter.inboundShipments.detach, { purchaseOrderId: poId }, { context: m.ctx })
    await call(appRouter.inboundShipments.delete, { id: shipmentId }, { context: m.ctx })
  })

  it('cancels and reopens an order and refuses charges that do not add up', async () => {
    const m = await merchant('can@example.com', 'can-a')
    const v = await seedVariant(m.storeId, 100)
    const [loc] = await call(appRouter.inventory.locations, undefined, { context: m.ctx })
    const id = await call(
      appRouter.purchaseOrders.save,
      {
        supplierName: 'Local mill',
        locationId: loc?.id as string,
        markOrdered: true,
        lines: [{ variantId: v, quantity: 2, unitPriceMinor: 10_000 }],
      },
      { context: m.ctx },
    )
    const po = await call(appRouter.purchaseOrders.get, { id }, { context: m.ctx })
    await expect(
      call(
        appRouter.purchaseCharges.add,
        {
          purchaseOrderId: id,
          kind: 'customs_bcd',
          amountMinor: 500,
          splitMethod: 'manual',
          manualSplits: [{ lineId: po.lines[0]?.id as string, amountPaise: 400 }],
        },
        { context: m.ctx },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    await call(appRouter.purchaseOrders.cancel, { id }, { context: m.ctx })
    expect(
      (await call(appRouter.purchaseOrders.counts, undefined, { context: m.ctx })).cancelled,
    ).toBe(1)
    await call(appRouter.purchaseOrders.reopen, { id }, { context: m.ctx })
    const back = await call(appRouter.purchaseOrders.get, { id }, { context: m.ctx })
    expect(back.status).toBe('ordered')
  })
})
