/** SOURCE OF TRUTH: order profit service tests — WHAT: profit per order and shipment from landed cost / WHY: guards the money maths */
import {
  address,
  business,
  cart,
  cartLine,
  createDb,
  gstRegistration,
  inventoryLevel,
  order,
  orderLine,
  payment,
  product,
  refund,
  shipment,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { FakeShippingProvider } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { FakePaymentProvider } from '../providers/payment'
import { createShipmentForOrder } from '../shipping/shipments'
import { convertDraft } from './drafts'
import { placeOrderAndPay } from './place-order'
import { STANDARD_METHOD_FEES } from './profit'
import {
  feeGstClaimable,
  orderProfit,
  profitCosts,
  profitCostsView,
  profitFacts,
  saveProfitCosts,
  setCourierCharge,
} from './profit-service'
import { cancelOrder } from './status'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

/** A ₹1,180 (18% GST) shirt that cost ₹500 landed, 10 in stock; Razorpay and COD switched on. */
async function seed() {
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'waimers',
      name: 'Waimers',
      payments: { enabled: ['razorpay', 'cod', 'manual'] },
      apps: { installed: [], settings: { core: { tax: { composition: false } } } },
    })
    .returning()
  const storeId = s?.id as string
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: 'shirt', title: 'Shirt', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({
      storeId,
      productId: p?.id as string,
      title: 'M',
      pricePaise: 118_000,
      costPaise: 50_000,
      weightGrams: 400,
    })
    .returning()
  await owner.insert(inventoryLevel).values({ storeId, variantId: v?.id as string, onHand: 10 })
  return { storeId, variantId: v?.id as string }
}

type Seeded = Awaited<ReturnType<typeof seed>>

const inStore = <T>(t: Seeded, fn: (ctx: StoreContext) => Promise<T>) =>
  withStore(app, t.storeId, (tx) => fn({ storeId: t.storeId, tx }))

async function place(t: Seeded, quantity = 1) {
  const [c] = await owner.insert(cart).values({ storeId: t.storeId }).returning()
  await owner.insert(cartLine).values({
    storeId: t.storeId,
    cartId: c?.id as string,
    variantId: t.variantId,
    quantity,
    unitPricePaise: 118_000,
  })
  // Placed and paid, as checkout does: the capture is what takes money (and a fee).
  return placeOrderAndPay(app, t.storeId, {
    cartId: c?.id as string,
    paymentProvider: new FakePaymentProvider({ mode: 'capture', id: 'razorpay' }),
    // Some cases order the same item twice: the shopper said "Yes, order again".
    orderAgain: true,
    checkout: {
      email: 'a@example.com',
      phone: '9820012345',
      name: 'Aarav',
      address: { line1: '1 Road', city: 'Gurugram', stateCode: 'HR', pincode: '122001' },
    },
  })
}

describe('cost at sale', () => {
  it('placing an order snapshots each unit’s cost, so a later cost change does not move it', async () => {
    const t = await seed()
    const placed = await place(t, 2)
    await owner.update(variant).set({ costPaise: 90_000 }).where(eq(variant.id, t.variantId))
    const [line] = await owner.select().from(orderLine).where(eq(orderLine.orderId, placed.orderId))
    expect(line).toMatchObject({ costAtSalePaise: 50_000, costEstimated: false })
  })

  it('converting a draft takes the cost at conversion', async () => {
    const t = await seed()
    const [shipTo] = await owner
      .insert(address)
      .values({
        storeId: t.storeId,
        name: 'Aarav',
        line1: '12 MG Road',
        city: 'Gurugram',
        stateCode: 'HR',
        pincode: '122001',
        phone: '9876543210',
      })
      .returning()
    const [d] = await owner
      .insert(order)
      .values({
        storeId: t.storeId,
        number: 5,
        shippingAddressId: shipTo?.id,
        status: 'draft',
        subtotalPaise: 118_000,
        totalPaise: 118_000,
      })
      .returning()
    await owner.insert(orderLine).values({
      storeId: t.storeId,
      orderId: d?.id as string,
      variantId: t.variantId,
      quantity: 1,
      unitPricePaise: 118_000,
    })
    await owner.update(variant).set({ costPaise: 60_000 }).where(eq(variant.id, t.variantId))
    await inStore(t, (ctx) => convertDraft(ctx, d?.id as string))
    const [line] = await owner
      .select()
      .from(orderLine)
      .where(eq(orderLine.orderId, d?.id as string))
    expect(line?.costAtSalePaise).toBe(60_000)
  })
})

describe('order profit', () => {
  it('takes off goods, the courier’s booking charge and the gateway rate plus GST', async () => {
    const t = await seed()
    await inStore(t, (ctx) =>
      saveProfitCosts(ctx.tx, t.storeId, {
        gatewayFees: { razorpay: { percentBps: 200, fixedPaise: 0 } },
        codFee: null,
      }),
    )
    const placed = await place(t)
    const [a] = await owner.select().from(order).where(eq(order.id, placed.orderId))
    expect(a?.shippingAddressId).toBeTruthy()
    // The demo courier charges ₹40 + ₹20 a kilo: ₹60 for this parcel.
    await inStore(t, (ctx) =>
      createShipmentForOrder(ctx, new FakeShippingProvider(), placed.orderId),
    )
    const profit = await inStore(t, (ctx) => orderProfit(ctx, placed.orderId))
    expect(profit).toMatchObject({
      netSalesPaise: 100_000,
      goodsPaise: 50_000,
      courierPaise: 6_000,
      // 2% of ₹1,180 = ₹23.60, and the store has no GSTIN so 18% GST on it is a cost: ₹27.85
      feesPaise: 2_785,
      profitPaise: 100_000 - 50_000 - 6_000 - 2_785,
    })
    expect(profit?.flags).toMatchObject({ feeFromRate: true, courierMissing: false })
    expect(profit?.feeSource).toBe('estimated')
  })

  it('a GST-registered store leaves the GST on fees out (it is claimed back)', async () => {
    const t = await seed()
    await owner.update(store).set({ gstin: '06ABCDE1234F1Z5' }).where(eq(store.id, t.storeId))
    await inStore(t, (ctx) =>
      saveProfitCosts(ctx.tx, t.storeId, {
        gatewayFees: { razorpay: { percentBps: 200, fixedPaise: 0 } },
        codFee: null,
      }),
    )
    const placed = await place(t)
    expect((await inStore(t, (ctx) => orderProfit(ctx, placed.orderId)))?.feesPaise).toBe(2_360)
  })

  it('a composition registration cannot claim it back', async () => {
    const t = await seed()
    const [b] = await owner
      .insert(business)
      .values({ storeId: t.storeId, legalName: 'Waimers', pan: 'ABCDE1234F' })
      .returning()
    await owner.insert(gstRegistration).values({
      storeId: t.storeId,
      businessId: b?.id as string,
      gstin: '06ABCDE1234F1Z5',
      registrationType: 'composition',
      isDefault: true,
    })
    await owner.update(store).set({ gstin: '06ABCDE1234F1Z5' }).where(eq(store.id, t.storeId))
    expect(await inStore(t, (ctx) => feeGstClaimable(ctx.tx, t.storeId))).toBe(false)
    await owner.update(gstRegistration).set({ registrationType: 'regular' })
    expect(await inStore(t, (ctx) => feeGstClaimable(ctx.tx, t.storeId))).toBe(true)
  })

  it('the gateway’s own fee wins; until then the rate for how the shopper paid', async () => {
    const t = await seed()
    await inStore(t, (ctx) =>
      saveProfitCosts(ctx.tx, t.storeId, {
        methodFees: { upi: { percentBps: 0, fixedPaise: 0 }, credit_card: { percentBps: 300 } },
        gatewayFees: { razorpay: { percentBps: 200, fixedPaise: 0 } },
        codFee: null,
      }),
    )
    const placed = await place(t)
    const setPayment = (values: Partial<typeof payment.$inferInsert>) =>
      owner.update(payment).set(values).where(eq(payment.orderId, placed.orderId))
    const profit = () => inStore(t, (ctx) => orderProfit(ctx, placed.orderId))

    await setPayment({ methodDetail: { kind: 'upi' } })
    expect(await profit()).toMatchObject({ feesPaise: 0, feeSource: 'estimated' })

    await setPayment({ methodDetail: { kind: 'card', cardType: 'credit', network: 'visa' } })
    // 3% of ₹1,180 = ₹35.40, + 18% GST = ₹41.77
    expect((await profit())?.feesPaise).toBe(4_177)

    await setPayment({ feePaise: 2_785, feeTaxPaise: 425 })
    expect(await profit()).toMatchObject({ feesPaise: 2_785, feeSource: 'actual' })
    expect((await profit())?.flags.feeFromRate).toBe(false)
  })

  it('a courier charge typed by hand replaces the unknown one', async () => {
    const t = await seed()
    const placed = await place(t)
    const [s] = await owner
      .insert(shipment)
      .values({ storeId: t.storeId, orderId: placed.orderId, provider: 'manual', waybill: 'M1' })
      .returning()
    // No charge yet and none on record to Haryana: the default ₹100, estimated.
    const before = await inStore(t, (ctx) => orderProfit(ctx, placed.orderId))
    expect(before?.courierPaise).toBe(10_000)
    expect(before?.flags.courierEstimated).toBe(true)
    await inStore(t, (ctx) =>
      setCourierCharge(ctx, { shipmentId: s?.id as string, chargePaise: 7_500 }),
    )
    const profit = await inStore(t, (ctx) => orderProfit(ctx, placed.orderId))
    expect(profit?.courierPaise).toBe(7_500)
    expect(profit?.flags.courierEstimated).toBe(false)
    await expect(
      inStore(t, (ctx) =>
        setCourierCharge(ctx, {
          shipmentId: '0199a000-0000-7000-8000-000000000001',
          chargePaise: 1,
        }),
      ),
    ).rejects.toThrow()
  })

  it('a refund and a cancellation count only what was kept', async () => {
    const t = await seed()
    const placed = await place(t)
    const [pay] = await owner.select().from(payment).where(eq(payment.orderId, placed.orderId))
    await owner.insert(refund).values({
      storeId: t.storeId,
      orderId: placed.orderId,
      paymentId: pay?.id as string,
      amountPaise: 59_000,
      status: 'processed',
    })
    const [facts] = await inStore(t, (ctx) => profitFacts(ctx.tx, [placed.orderId]))
    expect(facts).toMatchObject({ refundedPaise: 59_000, collectedPaise: null })
    expect((await inStore(t, (ctx) => orderProfit(ctx, placed.orderId)))?.netSalesPaise).toBe(
      50_000,
    )

    const second = await place(t)
    await inStore(t, (ctx) => cancelOrder(ctx, second.orderId, { notifyCustomer: false }))
    const [cancelled] = await inStore(t, (ctx) => profitFacts(ctx.tx, [second.orderId]))
    expect(cancelled?.collectedPaise).toBe(118_000)
  })
})

describe('packing and delivery estimates', () => {
  const boxes = (costPaise: number | null) => ({
    boxPresets: [
      {
        id: 'mailer',
        name: 'Poly mailer',
        lengthCm: 30,
        widthCm: 25,
        heightCm: 2,
        weightGrams: 20,
        isDefault: true,
        costPaise,
      },
    ],
  })

  it('an unbooked order counts its box now and ₹100 delivery, both estimated', async () => {
    const t = await seed()
    await owner
      .update(store)
      .set({ shipping: boxes(800) })
      .where(eq(store.id, t.storeId))
    const placed = await place(t)
    const profit = await inStore(t, (ctx) => orderProfit(ctx, placed.orderId))
    expect(profit).toMatchObject({ packingPaise: 800, courierPaise: 10_000, estimated: true })
    expect(profit?.flags).toMatchObject({ packingEstimated: true, courierEstimated: true })
  })

  it('booking snapshots the box cost, so a later price change leaves the order alone', async () => {
    const t = await seed()
    await owner
      .update(store)
      .set({ shipping: boxes(800) })
      .where(eq(store.id, t.storeId))
    const placed = await place(t)
    const [booked] = await inStore(t, async (ctx) => [
      await createShipmentForOrder(ctx, new FakeShippingProvider(), placed.orderId),
    ])
    expect(booked).toMatchObject({ packingCostPaise: 800, boxPresetId: 'mailer' })
    await owner
      .update(store)
      .set({ shipping: boxes(3_000) })
      .where(eq(store.id, t.storeId))
    const profit = await inStore(t, (ctx) => orderProfit(ctx, placed.orderId))
    expect(profit).toMatchObject({ packingPaise: 800, courierPaise: 6_000 })
    expect(profit?.flags).toMatchObject({ packingEstimated: false, courierEstimated: false })
  })

  it('delivery is estimated at the highest real charge to the same state in 60 days', async () => {
    const t = await seed()
    const first = await place(t)
    await owner.insert(shipment).values({
      storeId: t.storeId,
      orderId: first.orderId,
      provider: 'manual',
      waybill: 'H1',
      courierChargePaise: 9_000,
    })
    const second = await place(t)
    const profit = await inStore(t, (ctx) => orderProfit(ctx, second.orderId))
    expect(profit?.courierPaise).toBe(9_000)
    expect(profit?.flags.courierEstimated).toBe(true)
    // No box set up: packing counts nothing and says so.
    expect(profit?.flags.packingMissing).toBe(true)
  })

  it('an order cancelled before packing gets no packing or delivery', async () => {
    const t = await seed()
    await owner
      .update(store)
      .set({ shipping: boxes(800) })
      .where(eq(store.id, t.storeId))
    const placed = await place(t)
    await inStore(t, (ctx) => cancelOrder(ctx, placed.orderId, { notifyCustomer: false }))
    const profit = await inStore(t, (ctx) => orderProfit(ctx, placed.orderId))
    expect(profit).toMatchObject({ packingPaise: 0, courierPaise: 0, estimated: false })
  })
})

describe('Costs for profit settings', () => {
  it('lists the gateways that need a rate and saves without touching other settings', async () => {
    const t = await seed()
    const view = await inStore(t, (ctx) => profitCostsView(ctx.tx, t.storeId))
    expect(view.gateways).toEqual(['razorpay'])
    expect(view.codOn).toBe(true)
    expect(view.methodRatesOn).toBe(true)
    expect(view.gstClaimable).toBe(false)
    expect(view.costs.methodFees).toEqual(STANDARD_METHOD_FEES)
    await inStore(t, (ctx) =>
      saveProfitCosts(ctx.tx, t.storeId, {
        gatewayFees: {},
        codFee: { percentBps: 150, fixedPaise: 2_500 },
      }),
    )
    expect((await inStore(t, (ctx) => profitCosts(ctx.tx, t.storeId))).codFee).toEqual({
      percentBps: 150,
      fixedPaise: 2_500,
    })
    const [s] = await owner.select().from(store).where(eq(store.id, t.storeId))
    expect(
      (s?.apps as { settings?: { core?: { tax?: unknown } } } | undefined)?.settings?.core?.tax,
    ).toEqual({
      composition: false,
    })
    await expect(
      inStore(t, (ctx) =>
        saveProfitCosts(ctx.tx, t.storeId, { gatewayFees: {}, codFee: { percentBps: 20_000 } }),
      ),
    ).rejects.toThrow()
  })
})
