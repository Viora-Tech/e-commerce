import { attributionFromVisit, compactAttribution, pickAttribution } from '@commerce/core/marketing'
import {
  address,
  createDb,
  customer,
  order,
  orderLine,
  payment,
  product,
  refund,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { applyAsAffiliate, recordAffiliateClick, savePayoutDetails } from '../src/affiliates'
import {
  applyRefunds,
  approveDueCommissions,
  commissionForOrder,
  creditOrder,
  reverseCommission,
  startHold,
} from '../src/commissions'
import { createPayouts, markPayoutPaid, payoutCandidates } from '../src/payouts'
import { payoutOutlook, portalPayouts, portalSales, portalStats, rangeStart } from '../src/portal'
import {
  type AffiliateSettings,
  cleanChannels,
  defaultAffiliateSettings,
  maskBuyer,
  programRate,
} from '../src/settings'

/*
 * The whole referral path as an affiliate sees it: a click on their link, the attribution the
 * order carries, the commission (discounts, prepaid offers, shipping, GST), refunds and
 * clawbacks, and what their dashboard shows.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-secret-test-secret-test-secret-00'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const settings: AffiliateSettings = { ...defaultAffiliateSettings, approval: 'auto' }
const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

async function seed() {
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mat', title: 'Mat' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'Default', pricePaise: 1180_00 })
    .returning()
  const [c] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'asha@example.com', name: 'Asha' })
    .returning()
  const a = await withStore(app, s.id, (tx) =>
    applyAsAffiliate(
      tx,
      s.id,
      {
        customerId: c?.id as string,
        email: 'asha@example.com',
        phone: '+91 98765 43210',
        name: 'Asha K',
        social: '@asha',
        message: '',
      },
      settings,
      SECRET,
    ),
  )
  return { storeId: s.id, variantId: v?.id as string, affiliate: a }
}

let numbers = 5000
let buyers = 0
/** An order of one ₹1,180 line (18% GST inside), from a new buyer each time. */
async function placeOrder(
  storeId: string,
  variantId: string,
  over: Partial<typeof order.$inferInsert> = {},
) {
  buyers++
  const [ship] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Rahul Sharma',
      line1: `${buyers} Park Street`,
      city: 'Kolkata',
      stateCode: 'WB',
      pincode: '700016',
      phone: '9000000001',
    })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: numbers++,
      email: `buyer${buyers}@example.com`,
      phone: `+91 90000 ${String(10000 + buyers).slice(-5)}`,
      shippingAddressId: ship?.id,
      status: 'open',
      paymentStatus: 'paid',
      subtotalPaise: 1180_00,
      totalPaise: 1180_00,
      ...over,
    })
    .returning()
  if (!o) throw new Error('seed')
  await owner.insert(orderLine).values({
    storeId,
    orderId: o.id,
    variantId,
    quantity: 1,
    unitPricePaise: 1180_00,
    gstRatePercent: 18,
  })
  return o
}

async function refundOrder(storeId: string, orderId: string, amountPaise: number) {
  const [pay] = await owner
    .insert(payment)
    .values({
      storeId,
      orderId,
      provider: 'razorpay',
      providerRef: `pay_${Math.random().toString(36).slice(2)}`,
      amountPaise,
      status: 'captured',
    })
    .returning()
  await owner.insert(refund).values({
    storeId,
    orderId,
    paymentId: pay?.id as string,
    amountPaise,
    status: 'processed',
  })
}

/** Credit, deliver and clear the hold at once, so the commission is approved. */
async function earn(storeId: string, orderId: string) {
  const now = new Date()
  await inStore(storeId, async (tx) => {
    await creditOrder(tx, storeId, orderId, settings, SECRET)
    await startHold(tx, orderId, { ...settings, holdDays: 0 }, new Date(now.getTime() - 1000))
    await approveDueCommissions(tx, storeId, settings, now)
  })
  return inStore(storeId, (tx) => commissionForOrder(tx, orderId))
}

describe('link to order to commission', () => {
  it('a click on the link is counted, rides on the order and credits the affiliate', async () => {
    const s = await seed()
    const landed = attributionFromVisit({
      landingUrl: `https://shop.example/products/mat?ref=${s.affiliate.code.toUpperCase()}`,
      referrer: 'https://l.instagram.com/',
      storeHost: 'shop.example',
    })
    expect(landed).toMatchObject({ channel: 'affiliate', ref: s.affiliate.code })
    // A later direct visit in the window keeps the affiliate's touch (last non-direct click).
    const later = attributionFromVisit({
      landingUrl: 'https://shop.example/',
      storeHost: 'shop.example',
    })
    const carried = compactAttribution(pickAttribution(later, landed))
    expect(carried.ref).toBe(s.affiliate.code)

    const counted = await inStore(s.storeId, (tx) =>
      recordAffiliateClick(tx, s.storeId, carried.ref as string),
    )
    expect(counted).toBe(true)

    const o = await placeOrder(s.storeId, s.variantId, { attribution: carried })
    const c = await inStore(s.storeId, (tx) => creditOrder(tx, s.storeId, o.id, settings, SECRET))
    // ₹1,180 with 18% GST inside = ₹1,000 net; 10% = ₹100.
    expect(c).toMatchObject({ source: 'link', basePaise: 1000_00, commissionPaise: 100_00 })

    const stats = await inStore(s.storeId, (tx) =>
      portalStats(tx, s.affiliate.id, rangeStart('7d')),
    )
    expect(stats).toMatchObject({ clicks: 1, orders: 1, salesPaise: 1000_00, earnedPaise: 100_00 })
    expect(stats.conversion).toBe(100)
  })

  it('a prepaid offer lowers the commission like a code; shipping and a COD fee do not raise it', async () => {
    const s = await seed()
    const attribution = {
      channel: 'affiliate',
      ref: s.affiliate.code,
      at: new Date().toISOString(),
    }
    // 5% prepaid offer on ₹1,180 = ₹59 off, plus ₹100 shipping.
    const prepaid = await placeOrder(s.storeId, s.variantId, {
      attribution,
      paymentAdjustmentPaise: -59_00,
      shippingPaise: 100_00,
      totalPaise: 1180_00 - 59_00 + 100_00,
    })
    // A ₹50 COD fee and ₹100 shipping.
    const cod = await placeOrder(s.storeId, s.variantId, {
      attribution,
      paymentAdjustmentPaise: 50_00,
      shippingPaise: 100_00,
      totalPaise: 1180_00 + 50_00 + 100_00,
    })
    const [a, b] = await inStore(s.storeId, async (tx) => [
      await creditOrder(tx, s.storeId, prepaid.id, settings, SECRET),
      await creditOrder(tx, s.storeId, cod.id, settings, SECRET),
    ])
    // ₹1,121 paid for goods, GST inside: ₹950 net, 10% = ₹95.
    expect(a).toMatchObject({ basePaise: 950_00, commissionPaise: 95_00 })
    expect(b).toMatchObject({ basePaise: 1000_00, commissionPaise: 100_00 })
  })

  it('refunding every item reverses the commission even when the shipping charge was kept', async () => {
    const s = await seed()
    const o = await placeOrder(s.storeId, s.variantId, {
      attribution: { channel: 'affiliate', ref: s.affiliate.code, at: new Date().toISOString() },
      shippingPaise: 100_00,
      totalPaise: 1280_00,
    })
    await inStore(s.storeId, (tx) => creditOrder(tx, s.storeId, o.id, settings, SECRET))
    await refundOrder(s.storeId, o.id, 1180_00)
    const c = await inStore(s.storeId, (tx) => applyRefunds(tx, s.storeId, o.id))
    expect(c).toMatchObject({ status: 'reversed', reversedReason: 'refunded' })
  })

  it('a partial refund on an approved commission shrinks its TDS too', async () => {
    const s = await seed()
    await inStore(s.storeId, (tx) =>
      savePayoutDetails(tx, s.affiliate.id, { method: 'upi', upiId: 'asha@okaxis' }, SECRET),
    )
    // ₹2,95,000 incl. GST = ₹2,50,000 net; 10% = ₹25,000, over the ₹20,000 TDS threshold.
    const o = await placeOrder(s.storeId, s.variantId, {
      attribution: { channel: 'affiliate', ref: s.affiliate.code, at: new Date().toISOString() },
      subtotalPaise: 2_95_000_00,
      totalPaise: 2_95_000_00,
    })
    await owner
      .update(orderLine)
      .set({ unitPricePaise: 2_95_000_00 })
      .where(eq(orderLine.orderId, o.id))
    const c = await earn(s.storeId, o.id)
    // No PAN: 20% of ₹25,000 = ₹5,000.
    expect(c).toMatchObject({ status: 'approved', commissionPaise: 25_000_00, tdsPaise: 5_000_00 })
    await refundOrder(s.storeId, o.id, 1_47_500_00)
    const half = await inStore(s.storeId, (tx) => applyRefunds(tx, s.storeId, o.id))
    expect(half).toMatchObject({ commissionPaise: 12_500_00, tdsPaise: 2_500_00 })
    const [p] = await inStore(s.storeId, (tx) => payoutCandidates(tx, settings))
    expect(p).toMatchObject({ grossPaise: 12_500_00, tdsPaise: 2_500_00, netPaise: 10_000_00 })
  })

  it('a second refund after a clawback was recovered is still won back', async () => {
    const s = await seed()
    await inStore(s.storeId, (tx) =>
      savePayoutDetails(
        tx,
        s.affiliate.id,
        { method: 'upi', upiId: 'asha@okaxis', pan: 'ABCDE1234F' },
        SECRET,
      ),
    )
    const big = (n: number) =>
      placeOrder(s.storeId, s.variantId, {
        attribution: { channel: 'affiliate', ref: s.affiliate.code, at: new Date().toISOString() },
        subtotalPaise: n,
        totalPaise: n,
      }).then(async (o) => {
        await owner.update(orderLine).set({ unitPricePaise: n }).where(eq(orderLine.orderId, o.id))
        return o
      })
    // ₹11,800 = ₹10,000 net, ₹1,000 commission. Paid out.
    const first = await big(11_800_00)
    await earn(s.storeId, first.id)
    const [p1] = await inStore(s.storeId, (tx) => createPayouts(tx, s.storeId, settings))
    await inStore(s.storeId, (tx) => markPayoutPaid(tx, s.storeId, p1?.id as string, 'UTR1'))

    // A quarter refunded: ₹250 to claw back, recovered from the next payout.
    await refundOrder(s.storeId, first.id, 2_950_00)
    await inStore(s.storeId, (tx) => applyRefunds(tx, s.storeId, first.id))
    const second = await big(11_800_00)
    await earn(s.storeId, second.id)
    const [p2] = await inStore(s.storeId, (tx) => createPayouts(tx, s.storeId, settings))
    expect(p2).toMatchObject({ grossPaise: 1_000_00, clawbackPaise: 250_00 })
    await inStore(s.storeId, (tx) => markPayoutPaid(tx, s.storeId, p2?.id as string, 'UTR2'))

    // Then the rest of the first order is cancelled: the other ₹750 must come back too.
    await inStore(s.storeId, (tx) => reverseCommission(tx, s.storeId, first.id, 'cancelled'))
    expect(await inStore(s.storeId, (tx) => commissionForOrder(tx, first.id))).toMatchObject({
      clawbackPaise: 1_000_00,
    })
    const third = await big(11_800_00)
    await earn(s.storeId, third.id)
    const [c3] = await inStore(s.storeId, (tx) => payoutCandidates(tx, settings))
    expect(c3).toMatchObject({ grossPaise: 1_000_00, clawbackPaise: 750_00 })
  })
})

describe('the affiliate dashboard', () => {
  it('lists their sales with the buyer masked, their payouts and the next payout', async () => {
    const s = await seed()
    const attribution = {
      channel: 'affiliate',
      ref: s.affiliate.code,
      at: new Date().toISOString(),
    }
    const delivered = await placeOrder(s.storeId, s.variantId, { attribution })
    const waiting = await placeOrder(s.storeId, s.variantId, { attribution })
    await earn(s.storeId, delivered.id)
    const clearsAt = new Date(Date.now() - 1000)
    await inStore(s.storeId, async (tx) => {
      await creditOrder(tx, s.storeId, waiting.id, settings, SECRET)
      await startHold(tx, waiting.id, settings, clearsAt)
    })

    const sales = await inStore(s.storeId, (tx) => portalSales(tx, s.affiliate.id))
    expect(sales).toHaveLength(2)
    expect(sales.map((x) => x.buyer)).toEqual(['R••• S.', 'R••• S.'])
    expect(JSON.stringify(sales)).not.toContain('Sharma')
    expect(JSON.stringify(sales)).not.toContain('example.com')

    // ₹100 approved is below the ₹500 minimum; ₹100 more clears 7 days after delivery.
    const outlook = await inStore(s.storeId, (tx) => payoutOutlook(tx, s.affiliate.id, settings))
    expect(outlook).toMatchObject({
      readyPaise: 100_00,
      blocker: 'below_minimum',
      processingPaise: 0,
    })
    expect(outlook.nextClear?.paise).toBe(100_00)

    await inStore(s.storeId, (tx) =>
      savePayoutDetails(tx, s.affiliate.id, { method: 'upi', upiId: 'asha@okaxis' }, SECRET),
    )
    const [p] = await inStore(s.storeId, (tx) =>
      createPayouts(tx, s.storeId, { ...settings, minPayoutPaise: 0 }),
    )
    const listed = await inStore(s.storeId, (tx) => portalPayouts(tx, s.affiliate.id))
    expect(listed).toMatchObject([{ id: p?.id, status: 'pending', netPaise: 100_00 }])
    const after = await inStore(s.storeId, (tx) => payoutOutlook(tx, s.affiliate.id, settings))
    expect(after).toMatchObject({ readyPaise: 0, processingPaise: 100_00 })
  })

  it('counts only the chosen range', async () => {
    const s = await seed()
    const attribution = {
      channel: 'affiliate',
      ref: s.affiliate.code,
      at: new Date().toISOString(),
    }
    const old = await placeOrder(s.storeId, s.variantId, {
      attribution: { ...attribution, at: new Date(Date.now() - 50 * 86_400_000).toISOString() },
      placedAt: new Date(Date.now() - 50 * 86_400_000),
    })
    const recent = await placeOrder(s.storeId, s.variantId, { attribution })
    await inStore(s.storeId, async (tx) => {
      await creditOrder(tx, s.storeId, old.id, { ...settings, cookieDays: 30 }, SECRET)
      await creditOrder(tx, s.storeId, recent.id, settings, SECRET)
    })
    const [week, all] = await inStore(s.storeId, async (tx) => [
      await portalStats(tx, s.affiliate.id, rangeStart('30d')),
      await portalStats(tx, s.affiliate.id, rangeStart('all')),
    ])
    expect(week.orders).toBe(1)
    expect(all.orders).toBe(2)
  })
})

describe('signup helpers', () => {
  it('keeps known channels, masks buyers and states the best rate', () => {
    expect(cleanChannels(['youtube', 'nope', 'instagram', 3])).toEqual(['instagram', 'youtube'])
    expect(maskBuyer('rahul kumar sharma')).toBe('R••• S.')
    expect(maskBuyer('Asha')).toBe('A•••')
    expect(maskBuyer('  ')).toBeNull()
    expect(
      programRate({
        commission: { type: 'percent', bp: 1000 },
        levels: [{ minOrderPaise: 2000_00, rule: { type: 'percent', bp: 1200 } }],
        tiers: [{ name: 'Gold', minSalesPaise: 1_00_000_00, bp: 1500 }],
      }),
    ).toEqual({ rule: { type: 'percent', bp: 1000 }, upToBp: 1500 })
    expect(
      programRate({ commission: { type: 'flat', paise: 150_00 }, levels: [], tiers: [] }),
    ).toEqual({ rule: { type: 'flat', paise: 150_00 }, upToBp: null })
  })
})
