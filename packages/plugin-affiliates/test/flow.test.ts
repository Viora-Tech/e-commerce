import { anonymiseCustomer, phoneBlindIndex, rotateStoreSecrets } from '@commerce/core'
import {
  address,
  createDb,
  customer,
  discount,
  order,
  orderLine,
  outboxEvent,
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
import { applyAsAffiliate, readPayoutDetails, savePayoutDetails } from '../src/affiliates'
import {
  applyRefunds,
  approveDueCommissions,
  commissionForOrder,
  creditOrder,
  reverseCommission,
  startHold,
} from '../src/commissions'
import { createPayouts, markPayoutPaid, payoutsCsv } from '../src/payouts'
import { affiliate } from '../src/schema'
import { AFFILIATE_CIPHER_COLUMNS, refreshAffiliatePhoneIndexes } from '../src/secrets'
import { type AffiliateSettings, defaultAffiliateSettings } from '../src/settings'

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

async function seed() {
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mat', title: 'Mat' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Default', pricePaise: 1180_00 })
    .returning()
  if (!v) throw new Error('seed')
  const [aff] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'asha@example.com', name: 'Asha' })
    .returning()
  if (!aff) throw new Error('seed')
  return { storeId: s.id, variantId: v.id, affiliateCustomerId: aff.id }
}

let numbers = 1000
async function placeOrder(
  storeId: string,
  variantId: string,
  over: Partial<typeof order.$inferInsert> = {},
) {
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Buyer',
      line1: '5 Park Street',
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
      email: 'buyer@example.com',
      phone: '+91 90000 00001',
      shippingAddressId: a?.id,
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

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

async function events(storeId: string, type: string) {
  return (await owner.select().from(outboxEvent).where(eq(outboxEvent.storeId, storeId))).filter(
    (e) => e.type === type,
  )
}

async function newAffiliate(
  storeId: string,
  customerId: string | null,
  email = 'asha@example.com',
) {
  return inStore(storeId, (tx) =>
    applyAsAffiliate(
      tx,
      storeId,
      { customerId, email, phone: '+91 98765 43210', name: 'Asha K', social: '@asha', message: '' },
      settings,
      SECRET,
    ),
  )
}

const ref = (code: string, at = new Date()) => ({
  channel: 'affiliate',
  ref: code,
  at: at.toISOString(),
})

describe('affiliate signup', () => {
  it('approves automatically, makes a coupon in the discount engine and emails the affiliate', async () => {
    const s = await seed()
    const a = await newAffiliate(s.storeId, s.affiliateCustomerId)
    expect(a.status).toBe('approved')
    expect(a.code).toBe('asha-k')
    expect(a.couponCode).toBe('ASHA-K')
    const [d] = await owner.select().from(discount).where(eq(discount.storeId, s.storeId))
    expect(d).toMatchObject({ code: 'ASHA-K', method: 'percent', value: 1000, status: 'active' })
    expect(await events(s.storeId, 'affiliate.approved')).toHaveLength(1)
    // One affiliate per customer account.
    const again = await newAffiliate(s.storeId, s.affiliateCustomerId)
    expect(again.id).toBe(a.id)
  })

  it('keeps payout details encrypted and shows only a hint', async () => {
    const s = await seed()
    const a = await newAffiliate(s.storeId, s.affiliateCustomerId)
    const saved = await inStore(s.storeId, (tx) =>
      savePayoutDetails(
        tx,
        a.id,
        { method: 'upi', upiId: 'asha@okaxis', pan: 'ABCDE1234F' },
        SECRET,
      ),
    )
    expect(saved).toEqual({ hint: 'UPI as•••@okaxis', hasPan: true })
    const [row] = await owner.select().from(affiliate).where(eq(affiliate.id, a.id))
    expect(row?.payoutDetails).not.toContain('okaxis')
    expect(readPayoutDetails(row as typeof affiliate.$inferSelect, SECRET)).toMatchObject({
      upiId: 'asha@okaxis',
    })
  })
})

describe('commission lifecycle', () => {
  it('credits a link order, holds it until delivery and the return window, then approves it', async () => {
    const s = await seed()
    const a = await newAffiliate(s.storeId, s.affiliateCustomerId)
    const o = await placeOrder(s.storeId, s.variantId, { attribution: ref(a.code) })
    const c = await inStore(s.storeId, (tx) => creditOrder(tx, s.storeId, o.id, settings, SECRET))
    expect(c).toMatchObject({
      source: 'link',
      status: 'pending',
      basePaise: 1000_00,
      commissionPaise: 100_00,
    })
    expect(await events(s.storeId, 'affiliate.commission_created')).toHaveLength(1)
    // Idempotent: a second order.paid (or order.delivered) keeps the one commission.
    const again = await inStore(s.storeId, (tx) =>
      creditOrder(tx, s.storeId, o.id, settings, SECRET),
    )
    expect(again?.id).toBe(c?.id)

    const delivered = new Date('2026-10-01T10:00:00Z')
    await owner
      .update(order)
      .set({ deliveredAt: delivered, fulfillmentStatus: 'delivered' })
      .where(eq(order.id, o.id))
    const held = await inStore(s.storeId, (tx) => startHold(tx, o.id, settings))
    expect(held?.eligibleAt?.toISOString()).toBe('2026-10-08T10:00:00.000Z')

    const early = await inStore(s.storeId, (tx) =>
      approveDueCommissions(tx, s.storeId, settings, new Date('2026-10-05T00:00:00Z')),
    )
    expect(early.approved).toBe(0)
    const later = await inStore(s.storeId, (tx) =>
      approveDueCommissions(tx, s.storeId, settings, new Date('2026-10-09T00:00:00Z')),
    )
    expect(later.approved).toBe(1)
    expect(await events(s.storeId, 'affiliate.commission_approved')).toHaveLength(1)
  })

  it('credits a coupon order even without the link', async () => {
    const s = await seed()
    const a = await newAffiliate(s.storeId, s.affiliateCustomerId)
    const o = await placeOrder(s.storeId, s.variantId, {
      discountCode: a.couponCode,
      discountPaise: 118_00,
    })
    const c = await inStore(s.storeId, (tx) => creditOrder(tx, s.storeId, o.id, settings, SECRET))
    expect(c).toMatchObject({ source: 'coupon', basePaise: 900_00, commissionPaise: 90_00 })
  })

  it('ignores an expired link, test orders and repeat customers on a first-order program', async () => {
    const s = await seed()
    const a = await newAffiliate(s.storeId, s.affiliateCustomerId)
    const old = await placeOrder(s.storeId, s.variantId, {
      attribution: ref(a.code, new Date(Date.now() - 40 * 86_400_000)),
    })
    const test = await placeOrder(s.storeId, s.variantId, {
      attribution: ref(a.code),
      isTest: true,
    })
    const repeat = await placeOrder(s.storeId, s.variantId, { attribution: ref(a.code) })
    const results = await inStore(s.storeId, async (tx) => [
      await creditOrder(tx, s.storeId, old.id, settings, SECRET),
      await creditOrder(tx, s.storeId, test.id, settings, SECRET),
      await creditOrder(tx, s.storeId, repeat.id, settings, SECRET),
    ])
    // `old` (placed now, same email) makes `repeat` the buyer's second order.
    expect(results).toEqual([null, null, null])
  })

  it('records a self-referral reversed and never emails it', async () => {
    const s = await seed()
    const a = await newAffiliate(s.storeId, s.affiliateCustomerId)
    const o = await placeOrder(s.storeId, s.variantId, {
      attribution: ref(a.code),
      email: 'ASHA@example.com',
    })
    const c = await inStore(s.storeId, (tx) => creditOrder(tx, s.storeId, o.id, settings, SECRET))
    expect(c).toMatchObject({
      status: 'reversed',
      flag: 'same_email',
      reversedReason: 'self_referral',
    })
    expect(await events(s.storeId, 'affiliate.commission_created')).toHaveLength(0)
  })

  it('reverses on cancel or RTO, shrinks on a partial refund, reverses on a full one', async () => {
    const s = await seed()
    const a = await newAffiliate(s.storeId, s.affiliateCustomerId)
    const cancelled = await placeOrder(s.storeId, s.variantId, {
      attribution: ref(a.code),
      email: 'x1@example.com',
    })
    const rto = await placeOrder(s.storeId, s.variantId, {
      attribution: ref(a.code),
      email: 'x2@example.com',
    })
    const partial = await placeOrder(s.storeId, s.variantId, {
      attribution: ref(a.code),
      email: 'x3@example.com',
    })
    for (const o of [cancelled, rto, partial]) {
      await inStore(s.storeId, (tx) => creditOrder(tx, s.storeId, o.id, settings, SECRET))
    }
    await inStore(s.storeId, (tx) => reverseCommission(tx, s.storeId, cancelled.id, 'cancelled'))
    await inStore(s.storeId, (tx) => reverseCommission(tx, s.storeId, rto.id, 'rto'))
    const [pay] = await owner
      .insert(payment)
      .values({
        storeId: s.storeId,
        orderId: partial.id,
        provider: 'razorpay',
        providerRef: 'pay_test',
        amountPaise: 1180_00,
        status: 'captured',
      })
      .returning()
    await owner.insert(refund).values({
      storeId: s.storeId,
      orderId: partial.id,
      paymentId: pay?.id as string,
      amountPaise: 295_00,
      status: 'processed',
    })
    const shrunk = await inStore(s.storeId, (tx) => applyRefunds(tx, s.storeId, partial.id))
    expect(shrunk?.commissionPaise).toBe(75_00)
    await owner.insert(refund).values({
      storeId: s.storeId,
      orderId: partial.id,
      paymentId: pay?.id as string,
      amountPaise: 885_00,
      status: 'processed',
    })
    const gone = await inStore(s.storeId, (tx) => applyRefunds(tx, s.storeId, partial.id))
    expect(gone).toMatchObject({ status: 'reversed', reversedReason: 'refunded' })
    const rows = await inStore(s.storeId, async (tx) => [
      await commissionForOrder(tx, cancelled.id),
      await commissionForOrder(tx, rto.id),
    ])
    expect(rows.map((r) => r?.reversedReason)).toEqual(['cancelled', 'rto'])
    expect(await events(s.storeId, 'affiliate.commission_reversed')).toHaveLength(3)
  })

  it('reverses a due commission whose order was cancelled after delivery, instead of approving it', async () => {
    const s = await seed()
    const a = await newAffiliate(s.storeId, s.affiliateCustomerId)
    const o = await placeOrder(s.storeId, s.variantId, { attribution: ref(a.code) })
    await inStore(s.storeId, (tx) => creditOrder(tx, s.storeId, o.id, settings, SECRET))
    await inStore(s.storeId, (tx) => startHold(tx, o.id, { ...settings, holdDays: 0 }))
    await owner.update(order).set({ status: 'cancelled' }).where(eq(order.id, o.id))
    const r = await inStore(s.storeId, (tx) => approveDueCommissions(tx, s.storeId, settings))
    expect(r).toEqual({ approved: 0, reversed: 1 })
  })
})

describe('payouts', () => {
  it('groups approved commissions, deducts TDS and marks them paid; the CSV has the decrypted details', async () => {
    const s = await seed()
    const a = await newAffiliate(s.storeId, s.affiliateCustomerId)
    await inStore(s.storeId, (tx) =>
      savePayoutDetails(
        tx,
        a.id,
        {
          method: 'bank',
          accountName: 'Asha K',
          accountNumber: '123456789012',
          ifsc: 'HDFC0001234',
          pan: 'ABCDE1234F',
        },
        SECRET,
      ),
    )
    // A big order: 2,36,000 incl. GST = 2,00,000 net; 10% = 20,000 commission, then 5,000 more.
    const big = await placeOrder(s.storeId, s.variantId, {
      attribution: ref(a.code),
      subtotalPaise: 2_36_000_00,
      totalPaise: 2_36_000_00,
    })
    await owner
      .update(orderLine)
      .set({ unitPricePaise: 2_36_000_00 })
      .where(eq(orderLine.orderId, big.id))
    const now = new Date()
    await inStore(s.storeId, async (tx) => {
      await creditOrder(tx, s.storeId, big.id, settings, SECRET)
      await startHold(tx, big.id, { ...settings, holdDays: 0 }, new Date(now.getTime() - 1000))
      await approveDueCommissions(tx, s.storeId, settings, now)
    })
    const c = await inStore(s.storeId, (tx) => commissionForOrder(tx, big.id))
    expect(c).toMatchObject({ status: 'approved', commissionPaise: 20_000_00, tdsPaise: 0 })

    const second = await placeOrder(s.storeId, s.variantId, {
      attribution: ref(a.code),
      email: 'other@example.com',
      subtotalPaise: 59_000_00,
      totalPaise: 59_000_00,
    })
    await owner
      .update(orderLine)
      .set({ unitPricePaise: 59_000_00 })
      .where(eq(orderLine.orderId, second.id))
    await inStore(s.storeId, async (tx) => {
      await creditOrder(tx, s.storeId, second.id, settings, SECRET)
      await startHold(tx, second.id, { ...settings, holdDays: 0 }, new Date(now.getTime() - 1000))
      await approveDueCommissions(tx, s.storeId, settings, now)
    })
    // 25,000 in the year passes ₹20,000: 2% of 25,000 = 500 on this credit.
    expect((await inStore(s.storeId, (tx) => commissionForOrder(tx, second.id)))?.tdsPaise).toBe(
      500_00,
    )

    const [p] = await inStore(s.storeId, (tx) => createPayouts(tx, s.storeId, settings))
    expect(p).toMatchObject({
      grossPaise: 25_000_00,
      tdsPaise: 500_00,
      netPaise: 24_500_00,
      status: 'pending',
    })
    const csv = await inStore(s.storeId, (tx) => payoutsCsv(tx, SECRET))
    expect(csv).toContain('"123456789012"')
    expect(csv).toContain('"HDFC0001234"')
    expect(csv).toContain('"24500.00"')
    await inStore(s.storeId, (tx) => markPayoutPaid(tx, s.storeId, p?.id as string, 'UTR123'))
    expect((await inStore(s.storeId, (tx) => commissionForOrder(tx, big.id)))?.status).toBe('paid')
    expect(await events(s.storeId, 'affiliate.payout_paid')).toHaveLength(1)

    // Clawback: the paid order is refunded; its commission is won back from the next payout.
    const clawed = await inStore(s.storeId, (tx) =>
      reverseCommission(tx, s.storeId, big.id, 'refunded'),
    )
    expect(clawed).toMatchObject({ status: 'reversed', clawbackPaise: 20_000_00 })
    const third = await placeOrder(s.storeId, s.variantId, {
      attribution: ref(a.code),
      email: 'third@example.com',
      subtotalPaise: 2_95_000_00,
      totalPaise: 2_95_000_00,
    })
    await owner
      .update(orderLine)
      .set({ unitPricePaise: 2_95_000_00 })
      .where(eq(orderLine.orderId, third.id))
    await inStore(s.storeId, async (tx) => {
      await creditOrder(tx, s.storeId, third.id, settings, SECRET)
      await startHold(tx, third.id, { ...settings, holdDays: 0 }, new Date(now.getTime() - 1000))
      await approveDueCommissions(tx, s.storeId, settings, now)
    })
    // 2,50,000 net, 10% = 25,000 commission. The reversed 20,000 no longer counts for the year:
    // 30,000 at 2% = 600, less 500 already deducted = 100 TDS. Less the 20,000 clawback.
    const [next] = await inStore(s.storeId, (tx) => createPayouts(tx, s.storeId, settings))
    expect(next).toMatchObject({
      grossPaise: 25_000_00,
      clawbackPaise: 20_000_00,
      tdsPaise: 100_00,
      netPaise: 4_900_00,
    })
    // Recovered once: a further payout has no clawback left.
    const [again] = await inStore(s.storeId, (tx) => createPayouts(tx, s.storeId, settings))
    expect(again).toBeUndefined()
  })

  it('takes a partial refund on a paid commission back as a clawback', async () => {
    const s = await seed()
    const a = await newAffiliate(s.storeId, s.affiliateCustomerId)
    await inStore(s.storeId, (tx) =>
      savePayoutDetails(tx, a.id, { method: 'upi', upiId: 'asha@okaxis' }, SECRET),
    )
    const o = await placeOrder(s.storeId, s.variantId, {
      attribution: ref(a.code),
      subtotalPaise: 11_800_00,
      totalPaise: 11_800_00,
    })
    await owner
      .update(orderLine)
      .set({ unitPricePaise: 11_800_00 })
      .where(eq(orderLine.orderId, o.id))
    const now = new Date()
    await inStore(s.storeId, async (tx) => {
      await creditOrder(tx, s.storeId, o.id, settings, SECRET)
      await startHold(tx, o.id, { ...settings, holdDays: 0 }, new Date(now.getTime() - 1000))
      await approveDueCommissions(tx, s.storeId, settings, now)
    })
    const [p] = await inStore(s.storeId, (tx) => createPayouts(tx, s.storeId, settings))
    await inStore(s.storeId, (tx) => markPayoutPaid(tx, s.storeId, p?.id as string, 'UTR1'))
    const [pay] = await owner
      .insert(payment)
      .values({
        storeId: s.storeId,
        orderId: o.id,
        provider: 'razorpay',
        providerRef: 'pay_2',
        amountPaise: 11_800_00,
        status: 'captured',
      })
      .returning()
    await owner.insert(refund).values({
      storeId: s.storeId,
      orderId: o.id,
      paymentId: pay?.id as string,
      amountPaise: 2_950_00,
      status: 'processed',
    })
    const c = await inStore(s.storeId, (tx) => applyRefunds(tx, s.storeId, o.id))
    expect(c).toMatchObject({ status: 'paid', commissionPaise: 750_00, clawbackPaise: 250_00 })
  })
})

describe('secrets and privacy', () => {
  it('rotate-secrets moves payout details and the phone index to the new key', async () => {
    const s = await seed()
    const a = await newAffiliate(s.storeId, s.affiliateCustomerId)
    await owner
      .update(customer)
      .set({ phone: '+91 98765 43210' })
      .where(eq(customer.id, s.affiliateCustomerId))
    await inStore(s.storeId, (tx) =>
      savePayoutDetails(tx, a.id, { method: 'upi', upiId: 'asha@okaxis' }, SECRET),
    )
    const NEXT = 'next-secret-next-secret-next-secret-000'
    const keyring = { current: NEXT, previous: [SECRET] }
    const counts = await inStore(s.storeId, async (tx) => {
      const c = await rotateStoreSecrets(tx, s.storeId, keyring, {
        apply: true,
        columns: AFFILIATE_CIPHER_COLUMNS,
      })
      await refreshAffiliatePhoneIndexes(tx, NEXT, [SECRET])
      return c
    })
    expect(counts.columns['affiliate payout details']).toBe(1)
    const [row] = await owner.select().from(affiliate).where(eq(affiliate.id, a.id))
    expect(readPayoutDetails(row as typeof affiliate.$inferSelect, NEXT)).toMatchObject({
      upiId: 'asha@okaxis',
    })
    expect(row?.phoneIndex).toBe(phoneBlindIndex('9876543210', NEXT))
  })

  it('erasing the affiliate keeps the ledger but drops the person and payout details', async () => {
    const s = await seed()
    const a = await newAffiliate(s.storeId, s.affiliateCustomerId)
    await inStore(s.storeId, (tx) =>
      savePayoutDetails(
        tx,
        a.id,
        { method: 'upi', upiId: 'asha@okaxis', pan: 'ABCDE1234F' },
        SECRET,
      ),
    )
    const o = await placeOrder(s.storeId, s.variantId, { attribution: ref(a.code) })
    await inStore(s.storeId, (tx) => creditOrder(tx, s.storeId, o.id, settings, SECRET))
    await inStore(s.storeId, (tx) =>
      anonymiseCustomer(
        { storeId: s.storeId, tx },
        { customerId: s.affiliateCustomerId, actor: { type: 'system' } },
      ),
    )
    const [row] = await owner.select().from(affiliate).where(eq(affiliate.id, a.id))
    expect(row).toMatchObject({
      name: 'Former affiliate',
      email: null,
      phoneIndex: null,
      payoutDetails: null,
      payoutHint: null,
      hasPan: false,
      customerId: null,
      status: 'suspended',
    })
    const [d] = await owner
      .select()
      .from(discount)
      .where(eq(discount.id, row?.discountId as string))
    expect(d?.status).toBe('disabled')
    const c = await inStore(s.storeId, (tx) => commissionForOrder(tx, o.id))
    expect(c).toMatchObject({ commissionPaise: 100_00, basePaise: 1000_00 })
  })
})
