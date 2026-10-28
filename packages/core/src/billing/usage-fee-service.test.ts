/** SOURCE OF TRUTH: per-order fee inputs tests — WHAT: which orders and paid periods a month reads / WHY: the bill must count only real orders in paid time */
import { createDb, usageBill, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { ordersFrom, seedOrders, seedPaidPeriod, seedStore } from '../testing/usage-seed'
import { feeEstimate, loadMonthFeeInputs, monthOf, previousMonth } from './usage-fee-service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

// 1 Oct and 1 Nov 2026 at midnight in India.
const OCT = new Date('2026-09-30T18:30:00Z')
const NOV = new Date('2026-10-31T18:30:00Z')
const at = (iso: string) => new Date(iso)

describe('months', () => {
  it('names the IST month and the one before', () => {
    expect(monthOf(at('2026-10-31T19:00:00Z'))).toBe('2026-11')
    expect(previousMonth('2026-11')).toBe('2026-10')
    expect(previousMonth('2026-01')).toBe('2025-12')
  })
})

describe('loadMonthFeeInputs', () => {
  it('excludes drafts, cancelled, test and fully refunded orders but keeps part refunds and COD', async () => {
    const id = await seedStore(owner, 'asha')
    const day = at('2026-10-10T06:00:00Z')
    const [open, part, cod] = await seedOrders(owner, id, [
      { placedAt: day },
      { placedAt: day, paymentStatus: 'partially_refunded' },
      { placedAt: day, paymentStatus: 'unpaid', paymentMethod: 'cod' },
      { placedAt: day, status: 'draft' },
      { placedAt: day, status: 'cancelled' },
      { placedAt: day, isTest: true },
      { placedAt: day, paymentStatus: 'refunded' },
      { placedAt: at('2026-09-30T18:00:00Z') },
      { placedAt: NOV },
    ])
    const { orders } = await withStore(app, id, (tx) => loadMonthFeeInputs(tx, id, '2026-10'))
    expect(orders.map((o) => o.id).sort()).toEqual([open, part, cod].sort())
  })

  it('returns only paid periods overlapping the month', async () => {
    const id = await seedStore(owner, 'asha')
    await seedPaidPeriod(
      owner,
      id,
      'growth',
      at('2026-09-15T00:00:00Z'),
      at('2026-10-15T00:00:00Z'),
    )
    await seedPaidPeriod(
      owner,
      id,
      'starter',
      at('2026-08-01T00:00:00Z'),
      at('2026-09-01T00:00:00Z'),
    )
    const { periods } = await withStore(app, id, (tx) => loadMonthFeeInputs(tx, id, '2026-10'))
    expect(periods).toEqual([
      { plan: 'growth', start: at('2026-09-15T00:00:00Z'), end: at('2026-10-15T00:00:00Z') },
    ])
  })
})

describe('feeEstimate', () => {
  it('reports this month so far and the carried amount', async () => {
    const id = await seedStore(owner, 'asha')
    await seedPaidPeriod(owner, id, 'starter', OCT, NOV)
    await seedOrders(owner, id, ordersFrom(55, at('2026-10-05T06:00:00Z'), 2_00_000))
    await owner.insert(usageBill).values({
      storeId: id,
      month: '2026-09',
      ordersCounted: 52,
      feeOrders: 2,
      feePaise: 4_000,
      totalPaise: 4_000,
      status: 'carried',
    })
    const est = await withStore(app, id, (tx) => feeEstimate(tx, id, at('2026-10-20T06:00:00Z')))
    expect(est).toMatchObject({
      month: '2026-10',
      ordersCounted: 55,
      feeOrders: 5,
      feePaise: 10_000,
      carriedInPaise: 4_000,
    })
  })
})
