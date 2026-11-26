import { address, createDb, customer, order, type StoreTx, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { applyAsAffiliate, getAffiliate } from '../src/affiliates'
import {
  fillActivity,
  indiaToday,
  periodOf,
  periodsBetween,
  portalActivity,
  portalCommissions,
  spanDays,
  unitFor,
  updateAffiliateProfile,
} from '../src/portal-activity'
import { portalCommissionsCsv, portalPayoutsCsv } from '../src/portal-csv'
import { affiliateClickDay, affiliateCommission } from '../src/schema'
import { defaultAffiliateSettings } from '../src/settings'

/*
 * The affiliate portal's chart and Commission page (`affiliate.<store domain>`): figures per
 * India day, the filters, and that one affiliate never sees another's rows.
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

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

async function seed() {
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  const mk = async (email: string, name: string) => {
    const [c] = await owner.insert(customer).values({ storeId: s.id, email, name }).returning()
    return inStore(s.id, (tx) =>
      applyAsAffiliate(
        tx,
        s.id,
        { customerId: c?.id as string, email, phone: null, name, social: '', message: '' },
        { ...defaultAffiliateSettings, approval: 'auto' },
        SECRET,
      ),
    )
  }
  return {
    storeId: s.id,
    asha: await mk('asha@example.com', 'Asha K'),
    ravi: await mk('ravi@example.com', 'Ravi M'),
  }
}

let numbers = 9000
/** A referred order for `affiliateId`, placed at `placedAt`. */
async function commission(
  storeId: string,
  affiliateId: string,
  placedAt: Date,
  over: Partial<typeof affiliateCommission.$inferInsert> = {},
) {
  const [ship] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Rahul Sharma',
      line1: '1 Park Street',
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
      shippingAddressId: ship?.id,
      status: 'open',
      paymentStatus: 'paid',
      subtotalPaise: 1180_00,
      totalPaise: 1180_00,
    })
    .returning()
  await owner.insert(affiliateCommission).values({
    storeId,
    affiliateId,
    orderId: o?.id as string,
    source: 'link',
    basePaise: 1000_00,
    earnedPaise: 100_00,
    commissionPaise: 100_00,
    placedAt,
    ...over,
  })
}

describe('chart periods', () => {
  it('picks days, weeks or months by the span', () => {
    expect(spanDays('2026-11-01', '2026-11-30')).toBe(30)
    expect(unitFor(30)).toBe('day')
    expect(unitFor(180)).toBe('week')
    expect(unitFor(800)).toBe('month')
  })

  it('starts weeks on Monday and months on the 1st, with no gaps', () => {
    expect(periodOf('2026-11-26', 'week')).toBe('2026-11-23')
    expect(periodOf('2026-11-23', 'week')).toBe('2026-11-23')
    expect(periodOf('2026-11-26', 'month')).toBe('2026-11-01')
    expect(periodsBetween('2026-11-28', '2026-12-02', 'day')).toEqual([
      '2026-11-28',
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
    ])
    expect(periodsBetween('2026-11-20', '2026-12-02', 'week')).toEqual([
      '2026-11-16',
      '2026-11-23',
      '2026-11-30',
    ])
    expect(periodsBetween('2026-12-02', '2026-11-20', 'day')).toEqual([])
  })

  it('sums rows into their periods and drops days outside', () => {
    const points = fillActivity(
      '2026-11-23',
      '2026-11-29',
      'week',
      [
        { day: '2026-11-24', referrals: 1, salesPaise: 100, commissionPaise: 10 },
        { day: '2026-11-26', referrals: 2, salesPaise: 200, commissionPaise: 20 },
        { day: '2026-11-30', referrals: 9, salesPaise: 900, commissionPaise: 90 },
      ],
      [{ day: '2026-11-25', clicks: 7 }],
    )
    expect(points).toEqual([
      { period: '2026-11-23', referrals: 3, salesPaise: 300, commissionPaise: 30, clicks: 7 },
    ])
  })

  it('reads today in India', () => {
    // 20:00 UTC on the 25th is 01:30 on the 26th in India.
    expect(indiaToday(new Date('2026-11-25T20:00:00Z'))).toBe('2026-11-26')
  })
})

describe('the portal chart and Commission page', () => {
  it('counts one affiliate’s referrals, sales, commission and clicks per India day', async () => {
    const s = await seed()
    // 23:00 UTC on the 24th is the 25th in India.
    await commission(s.storeId, s.asha.id, new Date('2026-11-24T23:00:00Z'))
    await commission(s.storeId, s.asha.id, new Date('2026-11-25T06:00:00Z'))
    await commission(s.storeId, s.asha.id, new Date('2026-11-25T07:00:00Z'), {
      status: 'reversed',
      reversedReason: 'cancelled',
    })
    await commission(s.storeId, s.ravi.id, new Date('2026-11-25T06:00:00Z'))
    await owner.insert(affiliateClickDay).values([
      { storeId: s.storeId, affiliateId: s.asha.id, day: '2026-11-25', clicks: 12 },
      { storeId: s.storeId, affiliateId: s.ravi.id, day: '2026-11-25', clicks: 99 },
    ])
    const { unit, points } = await inStore(s.storeId, (tx) =>
      portalActivity(tx, s.asha.id, { from: '2026-11-24', to: '2026-11-26' }),
    )
    expect(unit).toBe('day')
    expect(points).toEqual([
      { period: '2026-11-24', referrals: 0, salesPaise: 0, commissionPaise: 0, clicks: 0 },
      {
        period: '2026-11-25',
        referrals: 2,
        salesPaise: 2000_00,
        commissionPaise: 200_00,
        clicks: 12,
      },
      { period: '2026-11-26', referrals: 0, salesPaise: 0, commissionPaise: 0, clicks: 0 },
    ])
  })

  it('filters their commissions by source, status and India dates, buyer masked', async () => {
    const s = await seed()
    await commission(s.storeId, s.asha.id, new Date('2026-11-10T06:00:00Z'))
    await commission(s.storeId, s.asha.id, new Date('2026-11-20T06:00:00Z'), {
      source: 'coupon',
      status: 'approved',
    })
    await commission(s.storeId, s.ravi.id, new Date('2026-11-20T06:00:00Z'))
    const all = await inStore(s.storeId, (tx) => portalCommissions(tx, s.asha.id))
    expect(all).toHaveLength(2)
    expect(all[0]?.buyer).toBe('R••• S.')
    const coupon = await inStore(s.storeId, (tx) =>
      portalCommissions(tx, s.asha.id, { source: 'coupon' }),
    )
    expect(coupon.map((c) => c.source)).toEqual(['coupon'])
    const pending = await inStore(s.storeId, (tx) =>
      portalCommissions(tx, s.asha.id, { status: 'pending' }),
    )
    expect(pending.map((c) => c.status)).toEqual(['pending'])
    const dated = await inStore(s.storeId, (tx) =>
      portalCommissions(tx, s.asha.id, { from: '2026-11-15', to: '2026-11-20' }),
    )
    expect(dated).toHaveLength(1)
    // A bad date is ignored, not an error.
    const bad = await inStore(s.storeId, (tx) =>
      portalCommissions(tx, s.asha.id, { from: '2026-13-45' }),
    )
    expect(bad).toHaveLength(2)

    const csv = portalCommissionsCsv(all)
    expect(csv.split('\r\n')[0]).toContain('"Commission (INR)"')
    expect(csv).toContain('"R••• S."')
    expect(csv).not.toContain('Rahul')
    expect(portalPayoutsCsv([])).toContain('"Paid to you (INR)"')
  })

  it('lets them change their name and profile link, never to an empty name', async () => {
    const s = await seed()
    expect(
      await inStore(s.storeId, (tx) =>
        updateAffiliateProfile(tx, s.asha.id, { name: '  Asha Kumar ', social: '@asha.k' }),
      ),
    ).toBe(true)
    expect(
      await inStore(s.storeId, (tx) =>
        updateAffiliateProfile(tx, s.asha.id, { name: ' ', social: '' }),
      ),
    ).toBe(false)
    const row = await inStore(s.storeId, (tx) => getAffiliate(tx, s.asha.id))
    expect(row).toMatchObject({ name: 'Asha Kumar', social: '@asha.k' })
  })
})
