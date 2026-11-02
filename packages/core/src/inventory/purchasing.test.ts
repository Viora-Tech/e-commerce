/** SOURCE OF TRUTH: tests for landed cost on real rows: receipts, WAC, late charges, shipments */
import {
  createDb,
  inventoryLevel,
  newId,
  product,
  purchaseChargeSplit,
  purchaseOrder,
  purchaseOrderLine,
  purchaseOrderReceiptLine,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { addPurchaseCharge, removePurchaseCharge, updatePurchaseCharge } from './charges'
import { loadCosting, lockCostingGroup } from './costing'
import {
  attachPurchaseOrder,
  deleteInboundShipment,
  detachPurchaseOrder,
  saveInboundShipment,
} from './inbound-shipments'
import { adjustStock, defaultLocationId } from './levels'
import {
  cancelPurchaseOrder,
  closePurchaseOrder,
  deletePurchaseOrder,
  duplicatePurchaseOrder,
  reopenPurchaseOrder,
  savePurchaseOrder,
} from './purchase-orders'
import { receivePurchaseOrder } from './receiving'
import type { PurchaseChargeInput, PurchaseOrderInput } from './schemas'
import { saveSupplier } from './suppliers'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

type VariantSeed = { onHand?: number; costPaise?: number | null; weightGrams?: number | null }

async function seedStore(slug = 'w') {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  const productId = newId()
  await owner
    .insert(product)
    .values({ id: productId, storeId: s.id, title: 'Pad', handle: `pad-${slug}` })
  const addVariant = async (v: VariantSeed = {}) => {
    const id = newId()
    await owner.insert(variant).values({
      id,
      storeId: s.id,
      productId,
      title: id.slice(-6),
      pricePaise: 500_000,
      costPaise: v.costPaise ?? null,
      weightGrams: v.weightGrams === undefined ? 500 : v.weightGrams,
    })
    await owner
      .insert(inventoryLevel)
      .values({ storeId: s.id, variantId: id, onHand: v.onHand ?? 0 })
    return id
  }
  const loc = await withStore(app, s.id, (tx) => defaultLocationId(tx, s.id))
  return { storeId: s.id, loc, addVariant }
}

type Ctx = Awaited<ReturnType<typeof seedStore>>

const run = <T>(c: Ctx, fn: (tx: StoreTx) => Promise<T>) => withStore(app, c.storeId, fn)

async function order(
  c: Ctx,
  lines: { variantId: string; quantity: number; unitPriceMinor: number }[],
  over: Partial<PurchaseOrderInput> = {},
) {
  return run(c, (tx) =>
    savePurchaseOrder(tx, c.storeId, {
      supplierName: 'Shenzhen Pads',
      locationId: c.loc,
      currency: 'INR',
      fxRate: '1',
      markOrdered: true,
      lines,
      ...over,
    }),
  )
}

const charge = (
  c: Ctx,
  input: Omit<PurchaseChargeInput, 'currency' | 'fxRate' | 'gstPaise'> &
    Partial<PurchaseChargeInput>,
) =>
  run(c, (tx) =>
    addPurchaseCharge(tx, c.storeId, { currency: 'INR', fxRate: '1', gstPaise: 0, ...input }),
  )

const linesOf = (poId: string) =>
  owner
    .select()
    .from(purchaseOrderLine)
    .where(eq(purchaseOrderLine.purchaseOrderId, poId))
    .orderBy(purchaseOrderLine.id)

const lineFor = async (poId: string, variantId: string) =>
  (await linesOf(poId)).find(
    (l) => l.variantId === variantId,
  ) as typeof purchaseOrderLine.$inferSelect

const costOf = async (variantId: string) =>
  (await owner.select({ c: variant.costPaise }).from(variant).where(eq(variant.id, variantId)))[0]
    ?.c

const receive = (
  c: Ctx,
  id: string,
  receipts: { lineId: string; accepted: number; rejected?: number }[],
) =>
  run(c, (tx) =>
    receivePurchaseOrder(
      tx,
      c.storeId,
      { id, receipts: receipts.map((r) => ({ rejected: 0, ...r })) },
      'user-1',
    ),
  )

const sell = (c: Ctx, variantId: string, units: number) =>
  run(c, (tx) => adjustStock(tx, { storeId: c.storeId, variantId, delta: -units, reason: 'sold' }))

describe('landed cost on a purchase order', () => {
  it('converts a USD order, splits freight by weight, keeps IGST out, and books WAC on an empty shelf', async () => {
    const c = await seedStore()
    const light = await c.addVariant({ weightGrams: 200 })
    const heavy = await c.addVariant({ weightGrams: 800 })
    // 10 × $10 and 10 × $20 at ₹80 = ₹8,000 + ₹16,000
    const id = await order(
      c,
      [
        { variantId: light, quantity: 10, unitPriceMinor: 1000 },
        { variantId: heavy, quantity: 10, unitPriceMinor: 2000 },
      ],
      { currency: 'USD', fxRate: '80' },
    )
    // $50 freight at ₹80 = ₹4,000, by weight 2,000 g : 8,000 g → ₹800 : ₹3,200
    await charge(c, {
      purchaseOrderId: id,
      kind: 'freight_insurance',
      amountMinor: 5000,
      currency: 'USD',
      fxRate: '80',
    })
    // BCD ₹2,400 by value (1 : 2) → ₹800 : ₹1,600; IGST ₹5,000 recoverable; CHA ₹1,500 + ₹270 GST by value
    await charge(c, { purchaseOrderId: id, kind: 'customs_bcd', amountMinor: 240_000 })
    await charge(c, { purchaseOrderId: id, kind: 'customs_igst', amountMinor: 500_000 })
    await charge(c, {
      purchaseOrderId: id,
      kind: 'cha_fee',
      amountMinor: 150_000,
      gstPaise: 27_000,
    })

    const l1 = await lineFor(id, light)
    const l2 = await lineFor(id, heavy)
    // light: 8,000 + 800 + 800 + 500 = ₹10,100 → ₹1,010 a unit
    expect(l1).toMatchObject({ unitCostPaise: 80_000, landedUnitCostPaise: 101_000 })
    // heavy: 16,000 + 3,200 + 1,600 + 1,000 = ₹21,800 → ₹2,180 a unit
    expect(l2).toMatchObject({ unitCostPaise: 160_000, landedUnitCostPaise: 218_000 })

    const got = await receive(c, id, [
      { lineId: l1.id, accepted: 10 },
      { lineId: l2.id, accepted: 10 },
    ])
    expect(got.units).toBe(20)
    expect(await costOf(light)).toBe(101_000)
    expect(await costOf(heavy)).toBe(218_000)
    const snaps = await owner.select().from(purchaseOrderReceiptLine)
    expect(snaps.map((s) => s.landedUnitCostPaise).sort()).toEqual([101_000, 218_000])
    expect(snaps.every((s) => s.costBeforePaise === null)).toBe(true)
  })

  it('averages with stock already on hand, across partial receipts', async () => {
    const c = await seedStore()
    const v = await c.addVariant({ onHand: 10, costPaise: 50_000 })
    const id = await order(c, [{ variantId: v, quantity: 20, unitPriceMinor: 80_000 }])
    const line = await lineFor(id, v)

    // (10 × 500 + 10 × 800) / 20 = 650
    await receive(c, id, [{ lineId: line.id, accepted: 10 }])
    expect(await costOf(v)).toBe(65_000)
    // (20 × 650 + 5 × 800) / 25 = 680
    const second = await receive(c, id, [{ lineId: line.id, accepted: 5, rejected: 5 }])
    expect(second.lines[0]).toMatchObject({ costBeforePaise: 65_000, costAfterPaise: 68_000 })
    expect(await costOf(v)).toBe(68_000)

    const [po] = await owner.select().from(purchaseOrder).where(eq(purchaseOrder.id, id))
    expect(po?.status).toBe('received')
    const after = await lineFor(id, v)
    expect(after).toMatchObject({ received: 15, rejected: 5, costedUnits: 15 })
    const [level] = await owner.select().from(inventoryLevel).where(eq(inventoryLevel.variantId, v))
    expect(level).toMatchObject({ onHand: 25, incoming: 0 })
  })

  it('revalues only what is still on the shelf when a bill arrives late', async () => {
    const c = await seedStore()
    const v = await c.addVariant()
    const id = await order(c, [{ variantId: v, quantity: 10, unitPriceMinor: 100_000 }])
    const line = await lineFor(id, v)
    await receive(c, id, [{ lineId: line.id, accepted: 10 }])
    expect(await costOf(v)).toBe(100_000)
    await sell(c, v, 4)

    // A ₹1,000 CHA bill after receipt: ₹100 a unit; 6 of the 10 are left.
    const chargeId = await charge(c, { purchaseOrderId: id, kind: 'cha_fee', amountMinor: 100_000 })
    expect(await costOf(v)).toBe(110_000)
    expect(await lineFor(id, v)).toMatchObject({
      landedUnitCostPaise: 110_000,
      bookedCostPaise: 1_100_000,
    })

    // The bill was really ₹500: −₹50 a unit on the 6 left.
    await run(c, (tx) =>
      updatePurchaseCharge(tx, c.storeId, {
        id: chargeId,
        kind: 'cha_fee',
        amountMinor: 50_000,
        currency: 'INR',
        fxRate: '1',
        gstPaise: 0,
      }),
    )
    expect(await costOf(v)).toBe(105_000)

    // Everything sold: removing the charge no longer moves the cost.
    await sell(c, v, 6)
    await run(c, (tx) => removePurchaseCharge(tx, c.storeId, chargeId))
    expect(await costOf(v)).toBe(105_000)
    expect(await lineFor(id, v)).toMatchObject({ bookedCostPaise: 1_000_000 })
  })

  it('takes manual per-line customs amounts that add up, and refuses ones that do not', async () => {
    const c = await seedStore()
    const a = await c.addVariant()
    const b = await c.addVariant()
    const id = await order(c, [
      { variantId: a, quantity: 1, unitPriceMinor: 10_000 },
      { variantId: b, quantity: 1, unitPriceMinor: 10_000 },
    ])
    const la = await lineFor(id, a)
    const lb = await lineFor(id, b)
    await expect(
      charge(c, {
        purchaseOrderId: id,
        kind: 'customs_bcd',
        amountMinor: 1000,
        splitMethod: 'manual',
        manualSplits: [{ lineId: la.id, amountPaise: 999 }],
      }),
    ).rejects.toMatchObject({ code: 'CHARGE_SPLIT_MISMATCH' })
    await charge(c, {
      purchaseOrderId: id,
      kind: 'customs_bcd',
      amountMinor: 1000,
      splitMethod: 'manual',
      manualSplits: [
        { lineId: la.id, amountPaise: 900 },
        { lineId: lb.id, amountPaise: 100 },
      ],
    })
    expect((await lineFor(id, a)).landedUnitCostPaise).toBe(10_900)
    expect((await lineFor(id, b)).landedUnitCostPaise).toBe(10_100)
  })

  it('falls back to value with a warning when a line has no weight', async () => {
    const c = await seedStore()
    const a = await c.addVariant({ weightGrams: 100 })
    const b = await c.addVariant({ weightGrams: null })
    const id = await order(c, [
      { variantId: a, quantity: 1, unitPriceMinor: 30_000 },
      { variantId: b, quantity: 1, unitPriceMinor: 10_000 },
    ])
    await charge(c, { purchaseOrderId: id, kind: 'freight_insurance', amountMinor: 4000 })
    const costing = await run(c, async (tx) =>
      loadCosting(tx, await lockCostingGroup(tx, c.storeId, { purchaseOrderId: id })),
    )
    const lb = await lineFor(id, b)
    expect(costing.result.warnings).toEqual([
      expect.objectContaining({ code: 'missing_weight', lineIds: [lb.id] }),
    ])
    expect((await lineFor(id, a)).landedUnitCostPaise).toBe(33_000)
    expect(lb.landedUnitCostPaise).toBe(11_000)
  })

  it('keeps line ids on a draft edit so charges that name lines still find them', async () => {
    const c = await seedStore()
    const a = await c.addVariant()
    const b = await c.addVariant()
    const lines = [
      { variantId: a, quantity: 1, unitPriceMinor: 10_000 },
      { variantId: b, quantity: 1, unitPriceMinor: 10_000 },
    ]
    const id = await order(c, lines, { markOrdered: false })
    const la = await lineFor(id, a)
    await charge(c, {
      purchaseOrderId: id,
      kind: 'port_handling',
      amountMinor: 500,
      splitMethod: 'specific_lines',
      splitLineIds: [la.id],
    })
    await order(
      c,
      [{ ...lines[0], quantity: 2 } as (typeof lines)[number], lines[1] as (typeof lines)[number]],
      {
        id,
        markOrdered: false,
      },
    )
    const after = await lineFor(id, a)
    expect(after.id).toBe(la.id)
    // (2 × ₹100 + ₹5) / 2 = ₹102.50
    expect(after.landedUnitCostPaise).toBe(10_250)
  })
})

describe('inbound shipments', () => {
  it('splits shared freight across two orders from two suppliers by weight', async () => {
    const c = await seedStore()
    const a = await c.addVariant({ weightGrams: 1000 })
    const b = await c.addVariant({ weightGrams: 3000 })
    const po1 = await order(c, [{ variantId: a, quantity: 10, unitPriceMinor: 10_000 }])
    const po2 = await order(c, [{ variantId: b, quantity: 10, unitPriceMinor: 10_000 }], {
      supplierName: 'Guangzhou Mats',
    })
    const ship = await run(c, (tx) =>
      saveInboundShipment(tx, c.storeId, { status: 'in_transit', billOfEntryNo: '1234567' }),
    )
    await run(c, (tx) => attachPurchaseOrder(tx, c.storeId, ship, po1))
    await run(c, (tx) => attachPurchaseOrder(tx, c.storeId, ship, po2))
    // ₹4,000 freight: 10 kg : 30 kg → ₹1,000 : ₹3,000
    await charge(c, { inboundShipmentId: ship, kind: 'freight_insurance', amountMinor: 400_000 })
    expect((await lineFor(po1, a)).landedUnitCostPaise).toBe(20_000)
    expect((await lineFor(po2, b)).landedUnitCostPaise).toBe(40_000)

    // Receive the first order, then take the second off the shipment: all ₹4,000 lands on
    // the first order's 10 units, which are still on the shelf.
    const la = await lineFor(po1, a)
    await receive(c, po1, [{ lineId: la.id, accepted: 10 }])
    expect(await costOf(a)).toBe(20_000)
    await run(c, (tx) => detachPurchaseOrder(tx, c.storeId, po2))
    expect((await lineFor(po1, a)).landedUnitCostPaise).toBe(50_000)
    expect(await costOf(a)).toBe(50_000)
    expect((await lineFor(po2, b)).landedUnitCostPaise).toBe(10_000)

    await expect(run(c, (tx) => deleteInboundShipment(tx, c.storeId, ship))).rejects.toMatchObject({
      code: 'SHIPMENT_NOT_EMPTY',
    })
  })

  it('drops a cancelled order out of the shared split', async () => {
    const c = await seedStore()
    const a = await c.addVariant()
    const b = await c.addVariant()
    const po1 = await order(c, [{ variantId: a, quantity: 1, unitPriceMinor: 10_000 }])
    const po2 = await order(c, [{ variantId: b, quantity: 1, unitPriceMinor: 10_000 }])
    const ship = await run(c, (tx) => saveInboundShipment(tx, c.storeId, { status: 'at_port' }))
    await run(c, (tx) => attachPurchaseOrder(tx, c.storeId, ship, po1))
    await run(c, (tx) => attachPurchaseOrder(tx, c.storeId, ship, po2))
    await charge(c, { inboundShipmentId: ship, kind: 'port_handling', amountMinor: 2000 })
    expect((await lineFor(po1, a)).landedUnitCostPaise).toBe(11_000)
    await run(c, (tx) => cancelPurchaseOrder(tx, c.storeId, po2))
    expect((await lineFor(po1, a)).landedUnitCostPaise).toBe(12_000)
    const splits = await owner.select().from(purchaseChargeSplit)
    expect(splits.map((s) => s.amountPaise)).toEqual([2000])
  })
})

describe('orders on a shipment, and duplicates (#1059, #1060)', () => {
  const edit = (
    c: Ctx,
    id: string,
    lines: { variantId: string; quantity: number; unitPriceMinor: number }[],
  ) =>
    run(c, (tx) =>
      savePurchaseOrder(tx, c.storeId, {
        id,
        supplierName: 'Shenzhen Pads',
        locationId: c.loc,
        currency: 'INR',
        fxRate: '1',
        lines,
      }),
    )

  it('lets an order on a shipment change until goods arrive, re-splitting shared freight', async () => {
    const c = await seedStore()
    const a = await c.addVariant({ weightGrams: 1000 })
    const b = await c.addVariant({ weightGrams: 1000 })
    const po1 = await order(c, [{ variantId: a, quantity: 10, unitPriceMinor: 10_000 }])
    const po2 = await order(c, [{ variantId: b, quantity: 10, unitPriceMinor: 10_000 }])
    const ship = await run(c, (tx) => saveInboundShipment(tx, c.storeId, { status: 'in_transit' }))
    await run(c, (tx) => attachPurchaseOrder(tx, c.storeId, ship, po1))
    await run(c, (tx) => attachPurchaseOrder(tx, c.storeId, ship, po2))
    // ₹2,000 freight over 10 kg + 10 kg: ₹100 a unit each.
    await charge(c, { inboundShipmentId: ship, kind: 'freight_insurance', amountMinor: 200_000 })
    expect((await lineFor(po1, a)).landedUnitCostPaise).toBe(20_000)

    // The supplier sends 30 of the first product: 30 kg + 10 kg now share the ₹2,000.
    await edit(c, po1, [{ variantId: a, quantity: 30, unitPriceMinor: 10_000 }])
    expect((await lineFor(po1, a)).quantity).toBe(30)
    expect((await lineFor(po1, a)).landedUnitCostPaise).toBe(15_000)
    expect((await lineFor(po2, b)).landedUnitCostPaise).toBe(15_000)

    // Once something arrives on it, the lines are fixed.
    await receive(c, po1, [{ lineId: (await lineFor(po1, a)).id, accepted: 1 }])
    await expect(
      edit(c, po1, [{ variantId: a, quantity: 40, unitPriceMinor: 10_000 }]),
    ).rejects.toMatchObject({ code: 'PO_IN_SHIPMENT' })
  })

  it('duplicates an order into a new draft with its supplier and lines, nothing received', async () => {
    const c = await seedStore()
    const a = await c.addVariant()
    const po = await order(c, [{ variantId: a, quantity: 6, unitPriceMinor: 4_500 }], {
      name: 'Diwali restock',
      currency: 'USD',
      fxRate: '83.5',
    })
    await receive(c, po, [{ lineId: (await lineFor(po, a)).id, accepted: 6 }])
    const copy = await run(c, (tx) => duplicatePurchaseOrder(tx, c.storeId, po))
    expect(copy).not.toBe(po)
    const [row] = await owner.select().from(purchaseOrder).where(eq(purchaseOrder.id, copy))
    expect(row).toMatchObject({
      status: 'draft',
      name: 'Diwali restock',
      supplierName: 'Shenzhen Pads',
      currency: 'USD',
      inboundShipmentId: null,
    })
    expect(Number(row?.fxRate)).toBe(83.5)
    expect(await linesOf(copy)).toMatchObject([
      { variantId: a, quantity: 6, unitPriceMinor: 4_500, received: 0, rejected: 0 },
    ])
  })
})

describe('cancel and reopen', () => {
  it('cancels an order with nothing received and reopens it as ordered', async () => {
    const c = await seedStore()
    const v = await c.addVariant()
    const id = await order(c, [{ variantId: v, quantity: 5, unitPriceMinor: 100 }])
    const incoming = async () =>
      (await owner.select().from(inventoryLevel).where(eq(inventoryLevel.variantId, v)))[0]
        ?.incoming
    expect(await incoming()).toBe(5)
    await run(c, (tx) => cancelPurchaseOrder(tx, c.storeId, id))
    expect(await incoming()).toBe(0)
    await expect(
      charge(c, { purchaseOrderId: id, kind: 'other', amountMinor: 1 }),
    ).rejects.toMatchObject({ code: 'PO_CANCELLED' })
    await run(c, (tx) => reopenPurchaseOrder(tx, c.storeId, id))
    expect(await incoming()).toBe(5)
    const [po] = await owner.select().from(purchaseOrder).where(eq(purchaseOrder.id, id))
    expect(po?.status).toBe('ordered')
  })

  it('reopens a cancelled draft as a draft and lets it be deleted', async () => {
    const c = await seedStore()
    const v = await c.addVariant()
    const id = await order(c, [{ variantId: v, quantity: 5, unitPriceMinor: 100 }], {
      markOrdered: false,
    })
    await run(c, (tx) => cancelPurchaseOrder(tx, c.storeId, id))
    await run(c, (tx) => reopenPurchaseOrder(tx, c.storeId, id))
    let [po] = await owner.select().from(purchaseOrder).where(eq(purchaseOrder.id, id))
    expect(po?.status).toBe('draft')
    await run(c, (tx) => cancelPurchaseOrder(tx, c.storeId, id))
    await run(c, (tx) => deletePurchaseOrder(tx, c.storeId, id))
    ;[po] = await owner.select().from(purchaseOrder).where(eq(purchaseOrder.id, id))
    expect(po).toBeUndefined()
  })

  it('will not cancel once something arrived, but reopens a closed order for the rest', async () => {
    const c = await seedStore()
    const v = await c.addVariant()
    const id = await order(c, [{ variantId: v, quantity: 5, unitPriceMinor: 100 }])
    const line = await lineFor(id, v)
    await receive(c, id, [{ lineId: line.id, accepted: 2 }])
    await expect(run(c, (tx) => cancelPurchaseOrder(tx, c.storeId, id))).rejects.toMatchObject({
      code: 'PO_NOT_CANCELLABLE',
    })
    await run(c, (tx) => closePurchaseOrder(tx, c.storeId, id))
    await run(c, (tx) => reopenPurchaseOrder(tx, c.storeId, id))
    const [po] = await owner.select().from(purchaseOrder).where(eq(purchaseOrder.id, id))
    expect(po?.status).toBe('partially_received')
    const [level] = await owner
      .select()
      .from(inventoryLevel)
      .where(and(eq(inventoryLevel.variantId, v), eq(inventoryLevel.locationId, c.loc)))
    expect(level?.incoming).toBe(3)
  })
})

describe('editing a sent order', () => {
  const edit = (
    c: Ctx,
    id: string,
    lines: { variantId: string; quantity: number; unitPriceMinor: number }[],
    over: Partial<PurchaseOrderInput> = {},
  ) =>
    run(c, (tx) =>
      savePurchaseOrder(tx, c.storeId, {
        id,
        supplierName: 'Shenzhen Pads',
        locationId: c.loc,
        currency: 'INR',
        fxRate: '1',
        lines,
        ...over,
      }),
    )
  const incomingOf = async (variantId: string) =>
    (await owner.select().from(inventoryLevel).where(eq(inventoryLevel.variantId, variantId)))[0]
      ?.incoming

  it('changes quantities, prices and products until the goods arrive, keeping incoming right', async () => {
    const c = await seedStore()
    const a = await c.addVariant()
    const b = await c.addVariant()
    const id = await order(c, [{ variantId: a, quantity: 10, unitPriceMinor: 100 }])
    await edit(
      c,
      id,
      [
        { variantId: a, quantity: 6, unitPriceMinor: 150 },
        { variantId: b, quantity: 4, unitPriceMinor: 200 },
      ],
      { name: 'Diwali restock' },
    )
    expect(await incomingOf(a)).toBe(6)
    expect(await incomingOf(b)).toBe(4)
    expect((await lineFor(id, a)).unitPriceMinor).toBe(150)
    const [po] = await owner.select().from(purchaseOrder).where(eq(purchaseOrder.id, id))
    expect(po?.name).toBe('Diwali restock')

    // 2 of a arrive: a cannot drop below 2 or be removed; b can be removed.
    await receive(c, id, [{ lineId: (await lineFor(id, a)).id, accepted: 2 }])
    await expect(
      edit(c, id, [{ variantId: a, quantity: 1, unitPriceMinor: 150 }]),
    ).rejects.toMatchObject({ code: 'PO_BELOW_RECEIVED' })
    await expect(
      edit(c, id, [{ variantId: b, quantity: 4, unitPriceMinor: 200 }]),
    ).rejects.toMatchObject({ code: 'PO_LINE_ARRIVED' })
    await edit(c, id, [{ variantId: a, quantity: 2, unitPriceMinor: 150 }])
    expect(await incomingOf(a)).toBe(0)
    expect(await incomingOf(b)).toBe(0)
    const [after] = await owner.select().from(purchaseOrder).where(eq(purchaseOrder.id, id))
    expect(after?.status).toBe('received')
  })

  it('changes an order on an inbound shipment until goods arrive, then refuses (#1059)', async () => {
    const c = await seedStore()
    const a = await c.addVariant()
    const id = await order(c, [{ variantId: a, quantity: 5, unitPriceMinor: 100 }])
    const ship = await run(c, (tx) => saveInboundShipment(tx, c.storeId, { status: 'in_transit' }))
    await run(c, (tx) => attachPurchaseOrder(tx, c.storeId, ship, id))
    await edit(c, id, [{ variantId: a, quantity: 6, unitPriceMinor: 100 }])
    expect(await incomingOf(a)).toBe(6)
    await receive(c, id, [{ lineId: (await lineFor(id, a)).id, accepted: 1 }])
    await expect(
      edit(c, id, [{ variantId: a, quantity: 7, unitPriceMinor: 100 }]),
    ).rejects.toMatchObject({ code: 'PO_IN_SHIPMENT' })
  })

  it('corrects the price of a received order and revalues the stock', async () => {
    const c = await seedStore()
    const a = await c.addVariant()
    const id = await order(c, [{ variantId: a, quantity: 10, unitPriceMinor: 10_000 }])
    await receive(c, id, [{ lineId: (await lineFor(id, a)).id, accepted: 10 }])
    expect(await costOf(a)).toBe(10_000)
    await expect(
      edit(c, id, [{ variantId: a, quantity: 11, unitPriceMinor: 10_000 }]),
    ).rejects.toMatchObject({ code: 'PO_LINES_LOCKED' })
    await edit(c, id, [{ variantId: a, quantity: 10, unitPriceMinor: 12_000 }])
    expect(await costOf(a)).toBe(12_000)
  })
})

describe('store isolation', () => {
  it('will not put a charge, a split or a supplier from another store on an order', async () => {
    const mine = await seedStore('mine')
    const theirs = await seedStore('theirs')
    const v = await mine.addVariant()
    const tv = await theirs.addVariant()
    const id = await order(mine, [{ variantId: v, quantity: 1, unitPriceMinor: 100 }])
    const theirPo = await order(theirs, [{ variantId: tv, quantity: 1, unitPriceMinor: 100 }])
    const theirLine = await lineFor(theirPo, tv)
    const theirSupplier = await withStore(app, theirs.storeId, (tx) =>
      saveSupplier(tx, theirs.storeId, { name: 'Theirs', country: 'CN', currency: 'USD' }),
    )

    await expect(
      charge(mine, { purchaseOrderId: theirPo, kind: 'other', amountMinor: 1 }),
    ).rejects.toMatchObject({ code: 'PO_NOT_FOUND' })
    await expect(
      charge(mine, {
        purchaseOrderId: id,
        kind: 'other',
        amountMinor: 1,
        splitMethod: 'specific_lines',
        splitLineIds: [theirLine.id],
      }),
    ).rejects.toMatchObject({ code: 'CHARGE_LINE_NOT_FOUND' })
    await expect(
      order(mine, [{ variantId: v, quantity: 1, unitPriceMinor: 100 }], {
        supplierId: theirSupplier,
      }),
    ).rejects.toMatchObject({ code: 'SUPPLIER_NOT_FOUND' })
    const ship = await run(mine, (tx) =>
      saveInboundShipment(tx, mine.storeId, { status: 'in_transit' }),
    )
    await expect(
      run(mine, (tx) => attachPurchaseOrder(tx, mine.storeId, ship, theirPo)),
    ).rejects.toMatchObject({ code: 'PO_NOT_FOUND' })
  })
})
