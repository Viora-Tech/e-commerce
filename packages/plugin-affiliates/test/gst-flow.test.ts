import { gstinCheckChar } from '@commerce/core'
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
import { applyAsAffiliate, savePayoutDetails } from '../src/affiliates'
import {
  approveDueCommissions,
  creditOrder,
  reverseCommission,
  startHold,
} from '../src/commissions'
import { createPayouts, payoutCandidates, payoutsCsv } from '../src/payouts'
import { affiliate } from '../src/schema'
import { type AffiliateSettings, defaultAffiliateSettings } from '../src/settings'
import { quarterOf } from '../src/tds'
import { tdsReportCsv } from '../src/tds-report'

const PAN_NOT_AVAILABLE = 'PANNOTAVBL'

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

const settings: AffiliateSettings = {
  ...defaultAffiliateSettings,
  approval: 'auto',
  minPayoutPaise: 0,
}

const GSTIN = (() => {
  const first14 = '27AAACW1234A1Z'
  return first14 + gstinCheckChar(first14)
})()

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

async function seed() {
  const slug = `g-${Math.random().toString(36).slice(2)}`
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
  const a = await inStore(s.id, (tx) =>
    applyAsAffiliate(
      tx,
      s.id,
      {
        customerId: c?.id as string,
        email: 'asha@example.com',
        phone: '+91 98765 43210',
        name: 'Asha K',
        social: '',
        message: '',
      },
      settings,
      SECRET,
    ),
  )
  return { storeId: s.id, variantId: v?.id as string, affiliate: a }
}

let numbers = 9000
/** One ₹1,180 order through the link, credited, delivered and approved now: ₹100 commission. */
async function earn(storeId: string, variantId: string, code: string) {
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
      email: `buyer${numbers}@example.com`,
      shippingAddressId: a?.id,
      status: 'open',
      paymentStatus: 'paid',
      subtotalPaise: 1180_00,
      totalPaise: 1180_00,
      attribution: { channel: 'affiliate', ref: code, at: new Date().toISOString() },
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
  const now = new Date()
  await inStore(storeId, async (tx) => {
    await creditOrder(tx, storeId, o.id, settings, SECRET)
    await startHold(tx, o.id, { ...settings, holdDays: 0 }, new Date(now.getTime() - 1000))
    await approveDueCommissions(tx, storeId, settings, now)
  })
  return o
}

describe('GST and TDS reporting', () => {
  it('adds GST to a GST-registered affiliate’s payout and puts the GSTIN in the bank file', async () => {
    const s = await seed()
    await inStore(s.storeId, (tx) =>
      savePayoutDetails(
        tx,
        s.affiliate.id,
        { method: 'upi', upiId: 'asha@okaxis', pan: 'ABCDE1234F', gstin: GSTIN },
        SECRET,
      ),
    )
    const [row] = await owner.select().from(affiliate).where(eq(affiliate.id, s.affiliate.id))
    expect(row?.gstRegistered).toBe(true)
    expect(row?.payoutDetails).not.toContain(GSTIN)
    await earn(s.storeId, s.variantId, s.affiliate.code)
    const [p] = await inStore(s.storeId, (tx) => createPayouts(tx, s.storeId, settings))
    expect(p).toMatchObject({ grossPaise: 100_00, gstPaise: 18_00, tdsPaise: 0, netPaise: 118_00 })
    const csv = await inStore(s.storeId, (tx) => payoutsCsv(tx, SECRET))
    expect(csv).toContain(`"${GSTIN}"`)
    expect(csv).toContain('"18.00","118.00"')
  })

  it('refuses a GSTIN with a wrong check character', async () => {
    const s = await seed()
    await expect(
      inStore(s.storeId, (tx) =>
        savePayoutDetails(
          tx,
          s.affiliate.id,
          { method: 'upi', upiId: 'asha@okaxis', gstin: `${GSTIN.slice(0, 14)}0` },
          SECRET,
        ),
      ),
    ).rejects.toThrow()
  })

  it('holds a payout without a PAN once the year passes the threshold, when the store asks', async () => {
    const s = await seed()
    await inStore(s.storeId, (tx) =>
      savePayoutDetails(tx, s.affiliate.id, { method: 'upi', upiId: 'asha@okaxis' }, SECRET),
    )
    await earn(s.storeId, s.variantId, s.affiliate.code)
    const strict = {
      ...settings,
      requirePanAboveThreshold: true,
      tds: { ...settings.tds, thresholdPaise: 50_00 },
    }
    const [held] = await inStore(s.storeId, (tx) => payoutCandidates(tx, strict))
    expect(held).toMatchObject({ ready: false, blocker: 'no_pan' })
    const [open] = await inStore(s.storeId, (tx) => payoutCandidates(tx, settings))
    expect(open).toMatchObject({ ready: true, blocker: null })
  })

  it('lists the quarter’s credits for 26Q, PANNOTAVBL without a PAN, reversals apart', async () => {
    const s = await seed()
    const first = await earn(s.storeId, s.variantId, s.affiliate.code)
    await earn(s.storeId, s.variantId, s.affiliate.code)
    await inStore(s.storeId, (tx) => reverseCommission(tx, s.storeId, first.id, 'refunded'))
    const csv = await inStore(s.storeId, (tx) =>
      tdsReportCsv(tx, settings, quarterOf(new Date()), SECRET),
    )
    const [credits, reversed] = csv.split('"Reversed after credit"')
    expect(credits?.match(new RegExp(PAN_NOT_AVAILABLE, 'g'))).toHaveLength(1)
    expect(credits).toContain('"393(1) Sl. 1(ii) / 194H"')
    expect(credits).toContain('"100.00"')
    expect(reversed).toContain(`"#${first.number}"`)
    const other = await inStore(s.storeId, (tx) =>
      tdsReportCsv(tx, settings, { fy: 2020, quarter: 1 }, SECRET),
    )
    expect(other.trim().split('\r\n')).toHaveLength(1)
  })
})
