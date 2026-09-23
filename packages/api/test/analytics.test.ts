import { createMerchantAuth } from '@commerce/auth'
import {
  address,
  cart,
  createDb,
  customer,
  inventoryAdjustment,
  inventoryLevel,
  order,
  orderLine,
  payment,
  product,
  refund,
  shipment,
  store,
  variant,
} from '@commerce/db'
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

/** Fixed sessions so conversion maths is checkable without Dragonfly. */
const visitors = {
  live: async () => ({ last30: 4, perMinute: Array.from({ length: 30 }, () => 0) }),
  daily: async (_storeId: string, days: string[]) => ({
    perDay: days.map(() => 0),
    total: 200,
  }),
}

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
    ctx: {
      db: app,
      auth,
      headers,
      notifications: { add: async () => undefined },
      visitors,
    } as ApiContext,
    storeId: s?.id as string,
  }
}

const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000)
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)

/**
 * The IST day a timestamp falls in, the way the analytics buckets compute it.
 * Tests that seed "a few hours ago" cannot assume that is still today: between
 * midnight and 05:30 IST those rows belong to the previous day's bucket.
 */
const istDay = (at: Date) => new Date(at.getTime() + 19_800_000).toISOString().slice(0, 10)

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('analytics.overview', () => {
  it('reports revenue, conversion and the funnel for the range, ignoring drafts and cancellations', async () => {
    const a = await merchant('a@example.com', 'store-a')
    const [c] = await owner
      .insert(customer)
      .values({ storeId: a.storeId, name: 'Asha', email: 'asha@example.com' })
      .returning()
    const [addr] = await owner
      .insert(address)
      .values({
        storeId: a.storeId,
        name: 'Asha',
        line1: '12 MG Road',
        city: 'Bengaluru',
        stateCode: 'KA',
        pincode: '560001',
        phone: '9999999999',
      })
      .returning()
    const base = { storeId: a.storeId, customerId: c?.id, subtotalPaise: 100000 }
    await owner.insert(order).values([
      {
        ...base,
        number: 1,
        totalPaise: 100000,
        status: 'paid',
        paymentMethod: 'razorpay',
        placedAt: hoursAgo(2),
        shippingAddressId: addr?.id,
      },
      {
        ...base,
        number: 2,
        totalPaise: 60000,
        status: 'placed',
        paymentMethod: 'cod',
        placedAt: daysAgo(2),
        shippingAddressId: addr?.id,
      },
      { ...base, number: 3, totalPaise: 90000, status: 'cancelled', placedAt: daysAgo(3) },
      { ...base, number: 4, totalPaise: 40000, status: 'draft', placedAt: daysAgo(1) },
      // Outside a 7-day range, inside 30.
      { ...base, number: 5, totalPaise: 25000, status: 'paid', placedAt: daysAgo(12) },
    ])
    await owner.insert(cart).values([
      { storeId: a.storeId, status: 'open', email: 'someone@example.com' },
      { storeId: a.storeId, status: 'open' },
      { storeId: a.storeId, status: 'converted', email: 'asha@example.com' },
    ])

    const week = await call(
      appRouter.analytics.overview,
      { range: { key: '7d' } },
      { context: a.ctx },
    )
    const kpi = (id: string) => week.kpis.find((k) => k.id === id)
    expect(kpi('orders')?.value).toBe(2)
    expect(kpi('revenue')?.value).toBe(160000)
    expect(kpi('sessions')?.value).toBe(200)
    expect(kpi('conversion')?.value).toBeCloseTo(2 / 200)
    expect(kpi('aov')?.value).toBe(80000)
    expect(week.range.days).toHaveLength(7)

    const funnel = Object.fromEntries(week.funnel.map((s) => [s.id, s.value]))
    expect(funnel.sessions).toBe(200)
    expect(funnel.carts).toBe(3)
    expect(funnel.checkouts).toBe(2)
    expect(funnel.orders).toBe(2)

    const methods = Object.fromEntries(week.paymentMethods.map((m) => [m.method, m.orders]))
    expect(methods).toEqual({ razorpay: 1, cod: 1 })
    expect(week.salesByState[0]).toMatchObject({ stateCode: 'KA', orders: 2 })

    const month = await call(
      appRouter.analytics.overview,
      { range: { key: '30d' } },
      { context: a.ctx },
    )
    expect(kpiValue(month, 'orders')).toBe(3)
    expect(kpiValue(month, 'revenue')).toBe(185000)
    expect(month.salesOverTime.day).toHaveLength(30)
    expect(month.salesOverTime.week.length).toBeLessThan(month.salesOverTime.day.length)
  })

  it('keeps one store out of the other store numbers', async () => {
    const a = await merchant('a2@example.com', 'store-a2')
    const b = await merchant('b2@example.com', 'store-b2')
    await owner.insert(order).values({
      storeId: a.storeId,
      number: 1,
      subtotalPaise: 100000,
      totalPaise: 100000,
      status: 'paid',
      placedAt: hoursAgo(1),
    })
    const seen = await call(
      appRouter.analytics.overview,
      { range: { key: '7d' } },
      { context: b.ctx },
    )
    expect(kpiValue(seen, 'orders')).toBe(0)
    expect(kpiValue(seen, 'revenue')).toBe(0)
  })
})

type Ctx = Awaited<ReturnType<typeof merchant>>

async function report(a: Ctx, slug: string, key: '7d' | '30d' = '7d') {
  return call(appRouter.analytics.report, { slug, range: { key } }, { context: a.ctx })
}

const row = (r: { rows: { key: string; values: Record<string, unknown> }[] }, key: string) =>
  r.rows.find((x) => x.key === key)?.values

/** A catalogue shop: two products, three variants, stock at the default location. */
async function catalogue(storeId: string) {
  const [mouse, pad] = await owner
    .insert(product)
    .values([
      {
        storeId,
        handle: 'mouse',
        title: 'Mouse',
        vendor: 'Waimers',
        productType: 'Mouse',
        status: 'active',
      },
      {
        storeId,
        handle: 'pad',
        title: 'Pad',
        vendor: 'Glide',
        productType: 'Mouse Pad',
        status: 'active',
      },
    ])
    .returning()
  const [black, white, padV] = await owner
    .insert(variant)
    .values([
      {
        storeId,
        productId: mouse?.id as string,
        title: 'Black',
        sku: 'M-BLK',
        pricePaise: 20000,
        costPaise: 8000,
      },
      { storeId, productId: mouse?.id as string, title: 'White', sku: 'M-WHT', pricePaise: 20000 },
      {
        storeId,
        productId: pad?.id as string,
        title: 'Default Title',
        sku: 'PAD',
        pricePaise: 5000,
      },
    ])
    .returning()
  await owner.insert(inventoryLevel).values([
    { storeId, variantId: black?.id as string, onHand: 10, reserved: 2 },
    { storeId, variantId: white?.id as string, onHand: 1, reserved: 0 },
    { storeId, variantId: padV?.id as string, onHand: 40, reserved: 0 },
  ])
  return {
    mouse: mouse?.id as string,
    pad: pad?.id as string,
    black: black?.id as string,
    white: white?.id as string,
    padV: padV?.id as string,
  }
}

async function shipTo(storeId: string, stateCode: string, pincode: string) {
  const [addr] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Asha',
      line1: '1 Road',
      city: 'Town',
      stateCode,
      pincode,
      phone: '9999999999',
    })
    .returning()
  return addr?.id as string
}

describe('analytics.report', () => {
  it('breaks sales down by day, gross to net, with the previous period beside it', async () => {
    const a = await merchant('c@example.com', 'store-c')
    const first = daysAgo(2)
    const second = daysAgo(3)
    const tax = {
      taxPaise: 7627,
      cgstPaise: 3814,
      sgstPaise: 3813,
      igstPaise: 0,
      ratePercent: 18,
      interState: false,
    }
    const [o1] = await owner
      .insert(order)
      .values([
        {
          storeId: a.storeId,
          number: 1,
          subtotalPaise: 50000,
          discountPaise: 5000,
          shippingPaise: 4900,
          paymentAdjustmentPaise: 1100,
          totalPaise: 51000,
          taxPaise: 7627,
          taxBreakdown: tax,
          status: 'paid',
          paymentMethod: 'cod',
          placedAt: first,
        },
        {
          storeId: a.storeId,
          number: 2,
          subtotalPaise: 30000,
          totalPaise: 30000,
          status: 'paid',
          placedAt: second,
        },
        {
          storeId: a.storeId,
          number: 3,
          subtotalPaise: 9000,
          totalPaise: 9000,
          status: 'cancelled',
          placedAt: second,
        },
        // Previous 7 days: always days 7 to 13 back, whatever the hour.
        {
          storeId: a.storeId,
          number: 4,
          subtotalPaise: 20000,
          totalPaise: 20000,
          status: 'paid',
          placedAt: daysAgo(10),
        },
      ])
      .returning()
    const [pay] = await owner
      .insert(payment)
      .values({
        storeId: a.storeId,
        orderId: o1?.id as string,
        provider: 'cod',
        providerRef: 'x',
        status: 'captured',
        amountPaise: 51000,
      })
      .returning()
    await owner.insert(refund).values([
      {
        storeId: a.storeId,
        orderId: o1?.id as string,
        paymentId: pay?.id as string,
        amountPaise: 6000,
        status: 'manual',
        reason: 'Damaged',
      },
      {
        storeId: a.storeId,
        orderId: o1?.id as string,
        paymentId: pay?.id as string,
        amountPaise: 999,
        status: 'failed',
      },
    ])

    const overTime = await report(a, 'sales-over-time')
    expect(overTime.rows).toHaveLength(7)
    expect(overTime.totals).toMatchObject({
      orders: 2,
      grossSales: 80000,
      discounts: 5000,
      returns: 6000,
      netSales: 69000,
      shipping: 4900,
      paymentFees: 1100,
      totalSales: 75000,
    })
    expect(overTime.previousTotals).toMatchObject({ orders: 1, totalSales: 20000 })
    const dayBefore = new Date(Date.parse(`${overTime.range.from}T00:00:00Z`) - 86_400_000)
    expect(overTime.previousRange?.to).toBe(dayBefore.toISOString().slice(0, 10))
    // Rows sit on the IST day each order falls in, not on "the last row".
    expect(row(overTime, istDay(first))).toMatchObject({ grossSales: expect.any(Number) })
    expect(Number(row(overTime, istDay(second))?.orders)).toBeGreaterThanOrEqual(1)
    expect(overTime.chart).toHaveLength(7)
    expect(overTime.chart.some((p) => p.previous !== null)).toBe(true)

    const net = await report(a, 'gross-to-net')
    const line = (id: string) => row(net, id)?.amount
    expect(line('grossSales')).toBe(80000)
    expect(line('discounts')).toBe(-5000)
    expect(line('returns')).toBe(-6000)
    expect(line('netSales')).toBe(69000)
    expect(line('totalSales')).toBe(75000)
    expect(line('cgst')).toBe(3814)
    expect(line('sgst')).toBe(3813)
    expect(line('igst')).toBe(0)
    expect(net.rows.find((r) => r.key === 'grossSales')?.previous).toBe(20000)

    const aov = await report(a, 'aov-over-time')
    expect(aov.totals).toMatchObject({ orders: 2, aov: 40500 })

    const status = await report(a, 'orders-by-status')
    expect(row(status, 'paid')?.orders).toBe(2)
    expect(row(status, 'cancelled')?.orders).toBe(1)

    const reasons = await report(a, 'refunds-by-reason')
    expect(reasons.rows).toHaveLength(1)
    expect(reasons.rows[0]?.values).toMatchObject({ reason: 'Damaged', refunded: 6000 })

    const unknown = await report(a, 'not-a-report')
    expect(unknown.slug).toBe('sales-over-time')
    const byChannel = await report(a, 'sales-by-channel')
    expect(byChannel.slug).toBe('sales-by-channel')
    expect(byChannel.rows[0]?.values).toMatchObject({ channel: 'Not tracked', orders: 2 })
  })

  it('reports products, variants, vendors and stock', async () => {
    const a = await merchant('p@example.com', 'store-p')
    const cat = await catalogue(a.storeId)
    const [o1, o2] = await owner
      .insert(order)
      .values([
        {
          storeId: a.storeId,
          number: 1,
          subtotalPaise: 45000,
          totalPaise: 45000,
          status: 'paid',
          placedAt: daysAgo(1),
        },
        {
          storeId: a.storeId,
          number: 2,
          subtotalPaise: 20000,
          totalPaise: 20000,
          status: 'paid',
          placedAt: daysAgo(2),
        },
      ])
      .returning()
    await owner.insert(orderLine).values([
      {
        storeId: a.storeId,
        orderId: o1?.id as string,
        variantId: cat.black,
        quantity: 2,
        unitPricePaise: 20000,
      },
      {
        storeId: a.storeId,
        orderId: o1?.id as string,
        variantId: cat.padV,
        quantity: 1,
        unitPricePaise: 5000,
      },
      {
        storeId: a.storeId,
        orderId: o2?.id as string,
        variantId: cat.white,
        quantity: 1,
        unitPricePaise: 20000,
      },
    ])
    await owner.insert(inventoryAdjustment).values({
      storeId: a.storeId,
      variantId: cat.black,
      delta: 1,
      reason: 'returned',
    })

    const products = await report(a, 'sales-by-product')
    expect(row(products, cat.mouse)).toMatchObject({
      product: 'Mouse',
      orders: 2,
      units: 3,
      grossSales: 60000,
    })
    expect(row(products, cat.mouse)?.share).toBeCloseTo(60000 / 65000)
    expect(products.chart[0]).toMatchObject({ label: 'Mouse', value: 60000 })

    const variants = await report(a, 'sales-by-variant')
    expect(row(variants, cat.black)).toMatchObject({
      variant: 'Mouse / Black',
      sku: 'M-BLK',
      units: 2,
    })
    expect(row(variants, cat.padV)?.variant).toBe('Pad')

    const vendors = await report(a, 'sales-by-vendor')
    expect(row(vendors, 'Glide')).toMatchObject({ products: 1, grossSales: 5000 })
    const types = await report(a, 'sales-by-product-type')
    expect(row(types, 'Mouse Pad')?.units).toBe(1)

    const abc = await report(a, 'abc-analysis')
    expect(row(abc, cat.mouse)?.abcClass).toBe('A')
    expect(row(abc, cat.pad)?.abcClass).toBe('B')

    const sell = await report(a, 'sell-through')
    expect(row(sell, cat.black)).toMatchObject({ sold: 2, onHand: 10 })
    expect(row(sell, cat.black)?.sellThrough).toBeCloseTo(2 / 12)

    const cover = await report(a, 'days-of-cover')
    // 8 available, 2 sold over 7 days.
    expect(row(cover, cat.black)?.daysOfCover).toBeCloseTo(8 / (2 / 7))

    const low = await report(a, 'low-stock')
    expect(low.rows.map((r) => r.key)).toEqual([cat.white])

    const onHand = await report(a, 'inventory-on-hand')
    expect(onHand.previousRange).toBeNull()
    expect(onHand.totals).toMatchObject({
      onHand: 51,
      committed: 2,
      available: 49,
      costValue: 80000,
    })

    const returns = await report(a, 'returns-by-product')
    expect(row(returns, cat.black)).toMatchObject({ returned: 1, sold: 2, returnRate: 0.5 })
  })

  it('splits sales and RTO by state, pincode, courier and COD vs prepaid', async () => {
    const a = await merchant('s@example.com', 'store-s')
    const ka = await shipTo(a.storeId, 'KA', '560001')
    const mh = await shipTo(a.storeId, 'MH', '400001')
    const placed = daysAgo(3)
    const [o1, o2, o3] = await owner
      .insert(order)
      .values([
        {
          storeId: a.storeId,
          number: 1,
          subtotalPaise: 10000,
          totalPaise: 10000,
          status: 'delivered',
          paymentMethod: 'cod',
          placedAt: placed,
          shippingAddressId: ka,
        },
        {
          storeId: a.storeId,
          number: 2,
          subtotalPaise: 30000,
          totalPaise: 30000,
          status: 'fulfilled',
          paymentMethod: 'razorpay',
          placedAt: placed,
          shippingAddressId: ka,
        },
        {
          storeId: a.storeId,
          number: 3,
          subtotalPaise: 20000,
          totalPaise: 20000,
          status: 'fulfilled',
          paymentMethod: 'cod',
          placedAt: placed,
          shippingAddressId: mh,
        },
      ])
      .returning()
    const at = (hours: number) => new Date(placed.getTime() + hours * 3_600_000)
    await owner.insert(shipment).values([
      {
        storeId: a.storeId,
        orderId: o1?.id as string,
        provider: 'delhivery',
        waybill: 'W1',
        status: 'delivered',
        createdAt: at(12),
        tracking: {
          waybill: 'W1',
          status: 'delivered',
          events: [{ at: at(48).toISOString(), status: 'delivered', description: 'Delivered' }],
        },
      },
      {
        storeId: a.storeId,
        orderId: o2?.id as string,
        provider: 'delhivery',
        waybill: 'W2',
        status: 'in_transit',
        createdAt: at(24),
      },
      {
        storeId: a.storeId,
        orderId: o3?.id as string,
        provider: 'delhivery',
        waybill: 'W3',
        status: 'rto',
        createdAt: at(36),
      },
    ])

    const states = await report(a, 'sales-by-state')
    expect(row(states, 'KA')).toMatchObject({
      state: 'KA',
      orders: 2,
      totalSales: 40000,
      aov: 20000,
      codShare: 0.5,
    })

    const pins = await report(a, 'sales-by-pincode')
    expect(row(pins, '400001')).toMatchObject({ city: 'Town', state: 'MH', orders: 1 })

    const methods = await report(a, 'sales-by-payment-method')
    expect(row(methods, 'cod')).toMatchObject({ paymentType: 'cod', orders: 2, totalSales: 30000 })
    expect(row(methods, 'razorpay')?.paymentType).toBe('prepaid')

    const cod = await report(a, 'cod-vs-prepaid')
    expect(row(cod, 'cod')).toMatchObject({ orders: 2, rtoRate: 0.5 })
    expect(row(cod, 'prepaid')).toMatchObject({ orders: 1, rtoRate: null })

    const courier = await report(a, 'shipping-by-courier')
    expect(row(courier, 'delhivery')).toMatchObject({
      shipments: 3,
      delivered: 1,
      rto: 1,
      rtoRate: 0.5,
    })
    expect(row(courier, 'delhivery')?.dispatchHours).toBeCloseTo(24)
    expect(row(courier, 'delhivery')?.deliveryDays).toBeCloseTo(2)

    const rtoState = await report(a, 'rto-by-state')
    expect(row(rtoState, 'MH')).toMatchObject({ shipments: 1, rto: 1, rtoRate: 1 })
    expect(row(rtoState, 'KA')).toMatchObject({
      shipments: 2,
      delivered: 1,
      inTransit: 1,
      rtoRate: 0,
    })
    const rtoPin = await report(a, 'rto-by-pincode')
    expect(rtoPin.rows[0]?.key).toBe('400001')
    const rtoPay = await report(a, 'rto-by-payment')
    expect(row(rtoPay, 'cod')?.rto).toBe(1)

    const timing = await report(a, 'fulfilment-time')
    expect(row(timing, istDay(placed))).toMatchObject({ orders: 3, shipments: 3, delivered: 1 })
  })

  it('separates new from returning customers and follows cohorts', async () => {
    const a = await merchant('k@example.com', 'store-k')
    const [asha, ravi] = await owner
      .insert(customer)
      .values([
        { storeId: a.storeId, name: 'Asha', email: 'asha@example.com' },
        { storeId: a.storeId, name: 'Ravi', email: 'ravi@example.com' },
      ])
      .returning()
    const base = { storeId: a.storeId, status: 'paid' as const }
    await owner.insert(order).values([
      // Asha first ordered long before the range; Ravi's first order is in it.
      {
        ...base,
        number: 1,
        customerId: asha?.id,
        subtotalPaise: 10000,
        totalPaise: 10000,
        placedAt: daysAgo(40),
      },
      {
        ...base,
        number: 2,
        customerId: asha?.id,
        subtotalPaise: 30000,
        totalPaise: 30000,
        placedAt: daysAgo(3),
      },
      {
        ...base,
        number: 3,
        customerId: ravi?.id,
        subtotalPaise: 20000,
        totalPaise: 20000,
        placedAt: daysAgo(4),
      },
      {
        ...base,
        number: 4,
        customerId: ravi?.id,
        subtotalPaise: 5000,
        totalPaise: 5000,
        placedAt: daysAgo(2),
      },
      {
        ...base,
        number: 5,
        email: 'Guest@Example.com',
        subtotalPaise: 7000,
        totalPaise: 7000,
        placedAt: daysAgo(2),
      },
    ])

    const split = await report(a, 'first-time-vs-returning')
    expect(row(split, 'new')).toMatchObject({ customers: 2, orders: 2, totalSales: 27000 })
    expect(row(split, 'returning')).toMatchObject({ customers: 2, orders: 2, totalSales: 35000 })

    const overTime = await report(a, 'customers-over-time')
    expect(overTime.totals).toMatchObject({
      customers: 3,
      newCustomers: 2,
      returningCustomers: 1,
      orders: 4,
    })

    const cohorts = await report(a, 'customer-cohorts')
    expect(cohorts.totals).toMatchObject({
      customers: 2,
      repeatCustomers: 1,
      repeatRate: 0.5,
      orders: 3,
      lifetimeSales: 32000,
    })

    const top = await report(a, 'top-customers')
    expect(top.rows[0]?.values).toMatchObject({
      customer: 'Asha',
      orders: 1,
      totalSales: 30000,
      lastOrder: istDay(daysAgo(3)),
    })
    expect(top.rows.map((r) => r.values.email)).toContain('Guest@Example.com')
  })

  it('answers every report in the catalogue on an empty store', async () => {
    const a = await merchant('e@example.com', 'store-e')
    const catalogue = await call(appRouter.analytics.reports, undefined, { context: a.ctx })
    for (const def of catalogue) {
      const result = await report(a, def.slug, '30d')
      expect(result.slug).toBe(def.available ? def.slug : 'sales-over-time')
      for (const r of result.rows) {
        for (const column of def.available ? def.columns : []) {
          expect(r.values).toHaveProperty(column.id)
        }
      }
    }
    expect(catalogue.filter((r) => !r.available).every((r) => r.missing)).toBe(true)
  })
})

describe('analytics.live', () => {
  it('counts open carts and the last hour of orders', async () => {
    const a = await merchant('d@example.com', 'store-d')
    await owner.insert(order).values([
      {
        storeId: a.storeId,
        number: 1,
        subtotalPaise: 20000,
        totalPaise: 20000,
        status: 'paid',
        placedAt: new Date(Date.now() - 10 * 60_000),
      },
      {
        storeId: a.storeId,
        number: 2,
        subtotalPaise: 30000,
        totalPaise: 30000,
        status: 'paid',
        placedAt: hoursAgo(5),
      },
    ])
    await owner.insert(cart).values({ storeId: a.storeId, status: 'open' })

    const live = await call(appRouter.analytics.live, undefined, { context: a.ctx })
    expect(live.visitors.last30).toBe(4)
    expect(live.activeCarts).toBe(1)
    expect(live.ordersLastHour).toBe(1)
    expect(live.revenueLastHourPaise).toBe(20000)
    expect(live.events.length).toBeGreaterThan(0)
  })
})

function kpiValue(result: { kpis: { id: string; value: number }[] }, id: string): number {
  return result.kpis.find((k) => k.id === id)?.value ?? -1
}
