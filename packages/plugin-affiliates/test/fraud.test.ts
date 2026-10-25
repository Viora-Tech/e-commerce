import {
  address,
  createDb,
  customer,
  order,
  orderLine,
  product,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { applyAsAffiliate, getAffiliate, savePayoutDetails } from '../src/affiliates'
import { addToBlocklist, clearReview } from '../src/blocklist'
import { creditOrder } from '../src/commissions'
import {
  blocklistHint,
  blocklistKey,
  isCouponSite,
  isCouponSpike,
  median,
  referrerHost,
} from '../src/fraud'
import { affiliateCommission } from '../src/schema'
import { type AffiliateSettings, defaultAffiliateSettings } from '../src/settings'

/*
 * Fraud pack: the pure rules (coupon sites, spikes, blocklist values), then with the database:
 * a blocked applicant is refused, a blocked buyer's or coupon-site commission is held (pending
 * with a flag, never approved by the sweep), and a PAN shared by two affiliates holds both
 * payouts until the merchant clears it.
 */

describe('rules', () => {
  it('spots coupon sites, subdomains included', () => {
    expect(referrerHost('https://www.GrabOn.in/deals/x')).toBe('grabon.in')
    expect(referrerHost('not a url')).toBeNull()
    expect(isCouponSite('m.grabon.in', ['grabon.in'])).toBe(true)
    expect(isCouponSite('notgrabon.in', ['grabon.in'])).toBe(false)
    expect(isCouponSite(null, ['grabon.in'])).toBe(false)
  })

  it('calls a spike only above the multiple and the minimum', () => {
    const quiet = Array.from({ length: 28 }, () => 0)
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(isCouponSpike(4, quiet, 3)).toBe(false)
    expect(isCouponSpike(5, quiet, 3)).toBe(true)
    const busy = Array.from({ length: 28 }, () => 4)
    expect(isCouponSpike(12, busy, 3)).toBe(false)
    expect(isCouponSpike(13, busy, 3)).toBe(true)
  })

  it('normalises and masks blocklist values', () => {
    expect(blocklistKey('email', ' Asha@Example.com ')).toBe('asha@example.com')
    expect(blocklistKey('email', 'nope')).toBeNull()
    expect(blocklistKey('email_domain', '@Spam.co')).toBe('spam.co')
    expect(blocklistKey('phone', '+91 98765 43210')).toBe('9876543210')
    expect(blocklistKey('pan', 'abcde1234f')).toBe('ABCDE1234F')
    expect(blocklistKey('payee', '1234567890@SBIN0001234')).toBe('1234567890@sbin0001234')
    expect(blocklistHint('email', 'asha@example.com')).toBe('as•••@example.com')
    expect(blocklistHint('pan', 'ABCDE1234F')).toBe('•••234F')
  })
})

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
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, apps: { installed: ['affiliates'], settings: { affiliates: {} } } })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mat', title: 'Mat' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'Default', pricePaise: 1180_00 })
    .returning()
  return { storeId: s.id, variantId: v?.id as string }
}

const join = (storeId: string, email: string, extra: { ip?: string; phone?: string } = {}) =>
  inStore(storeId, (tx) =>
    applyAsAffiliate(
      tx,
      storeId,
      {
        customerId: null,
        email,
        phone: extra.phone ?? null,
        name: email.split('@')[0] ?? 'x',
        social: '',
        message: '',
        ip: extra.ip,
      },
      settings,
      SECRET,
    ),
  )

let numbers = 9000
async function couponOrder(
  storeId: string,
  variantId: string,
  code: string,
  over: Partial<typeof order.$inferInsert> = {},
) {
  const [c] = await owner
    .insert(customer)
    .values({ storeId, email: `buyer${numbers}@shop.test`, name: 'Buyer' })
    .returning()
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Buyer',
      line1: `${numbers} Lake Road`,
      city: 'Pune',
      stateCode: 'MH',
      pincode: '411001',
      phone: '9000000002',
    })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: numbers++,
      customerId: c?.id,
      email: c?.email,
      phone: '+91 90000 00002',
      shippingAddressId: a?.id,
      status: 'open',
      paymentStatus: 'paid',
      discountCode: code,
      subtotalPaise: 1180_00,
      totalPaise: 1180_00,
      ...over,
    })
    .returning()
  await owner.insert(orderLine).values({
    storeId,
    orderId: o?.id as string,
    variantId,
    quantity: 1,
    unitPricePaise: 1180_00,
    gstRatePercent: 18,
  })
  return o as typeof order.$inferSelect
}

const credit = (storeId: string, orderId: string) =>
  inStore(storeId, (tx) => creditOrder(tx, storeId, orderId, settings, SECRET))

describe('blocklist and holds', () => {
  it('refuses a blocked email or IP at signup', async () => {
    const { storeId } = await seed()
    await inStore(storeId, (tx) =>
      addToBlocklist(tx, storeId, { kind: 'ip', value: '203.0.113.9', note: '' }, null, SECRET),
    )
    await inStore(storeId, (tx) =>
      addToBlocklist(
        tx,
        storeId,
        { kind: 'email_domain', value: 'spam.co', note: '' },
        null,
        SECRET,
      ),
    )
    await expect(join(storeId, 'a@ok.com', { ip: '203.0.113.9' })).rejects.toThrow(
      /cannot be accepted/,
    )
    await expect(join(storeId, 'b@spam.co')).rejects.toThrow(/cannot be accepted/)
    expect((await join(storeId, 'c@ok.com', { ip: '203.0.113.10' })).status).toBe('approved')
  })

  it('holds a blocked buyer’s commission and one from a coupon site', async () => {
    const { storeId, variantId } = await seed()
    const a = await join(storeId, 'creator@ok.com')
    const code = a.couponCode as string
    await inStore(storeId, (tx) =>
      addToBlocklist(tx, storeId, { kind: 'phone', value: '9000000002', note: '' }, null, SECRET),
    )
    const blocked = await couponOrder(storeId, variantId, code)
    expect(await credit(storeId, blocked.id)).toMatchObject({
      status: 'pending',
      flag: 'blocked_buyer',
    })
    const { storeId: s2, variantId: v2 } = await seed()
    const b = await join(s2, 'creator@ok.com')
    const leaked = await couponOrder(s2, v2, b.couponCode as string, {
      phone: '+91 91111 11111',
      attribution: {
        channel: 'referral',
        referrer: 'https://www.grabon.in/x',
        at: new Date().toISOString(),
      },
    })
    expect(await credit(s2, leaked.id)).toMatchObject({
      status: 'pending',
      flag: 'coupon_leak_site',
    })
    const [row] = await owner
      .select({ flag: affiliateCommission.flag })
      .from(affiliateCommission)
      .where(eq(affiliateCommission.orderId, leaked.id))
    expect(row?.flag).toBe('coupon_leak_site')
  })

  it('holds payouts of two affiliates sharing a PAN until cleared', async () => {
    const { storeId } = await seed()
    const first = await join(storeId, 'one@ok.com')
    const second = await join(storeId, 'two@ok.com')
    const details = { method: 'upi' as const, upiId: 'one@okaxis', pan: 'ABCDE1234F' }
    await inStore(storeId, (tx) => savePayoutDetails(tx, first.id, details, SECRET))
    await inStore(storeId, (tx) =>
      savePayoutDetails(tx, second.id, { ...details, upiId: 'two@okaxis' }, SECRET),
    )
    const one = await inStore(storeId, (tx) => getAffiliate(tx, first.id))
    const two = await inStore(storeId, (tx) => getAffiliate(tx, second.id))
    expect(one?.reviewReasons).toEqual(['duplicate_pan'])
    expect(two?.reviewReasons).toEqual(['duplicate_pan'])
    await inStore(storeId, (tx) => clearReview(tx, first.id))
    expect((await inStore(storeId, (tx) => getAffiliate(tx, first.id)))?.reviewReasons).toEqual([])
  })
})
