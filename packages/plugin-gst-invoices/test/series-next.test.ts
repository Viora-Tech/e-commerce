import {
  address,
  createDb,
  order,
  orderLine,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setSeriesNextNumber } from '../src/next-number'
import { enqueueOrder, issueDrafts } from '../src/queue'
import { invoice } from '../src/schema'

/*
 * The GST app's numbering settings: any series' next number can be moved, e.g. Waimers' export
 * invoices carrying on at EXP/26-27/0002 after VI/EXP/26-27/001 from the previous system.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const d = (iso: string) => new Date(iso)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const inStore = <T>(storeId: string, fn: Parameters<typeof withStore<T>>[2]) =>
  withStore(app, storeId, fn)

async function seedStore() {
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'waimers',
      name: 'Waimers',
      gstin: '06AAPFU0939F1ZZ',
      address: { line1: '14 Sector 29', city: 'Gurugram', state: 'HR', pincode: '122001' },
    })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mouse', title: 'Mouse' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({
      storeId: s.id,
      productId: p?.id as string,
      title: 'Black',
      sku: 'MS-B',
      hsCode: '847160',
      pricePaise: 100_000,
    })
    .returning()
  return { storeId: s.id, variantId: v?.id as string }
}

/** A paid order shipped to Dubai (an export). */
async function seedExport(storeId: string, variantId: string, n: number) {
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Omar Khan',
      line1: 'Marina Walk',
      city: 'Dubai',
      stateCode: 'DU',
      pincode: '00000',
      country: 'AE',
      phone: '971500000000',
    })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: n,
      status: 'open',
      paymentStatus: 'paid',
      checkoutPaidAt: new Date(),
      paymentMethod: 'razorpay',
      shippingAddressId: a?.id,
      subtotalPaise: 100_000,
      totalPaise: 100_000,
    })
    .returning()
  await owner.insert(orderLine).values({
    storeId,
    orderId: o?.id as string,
    variantId,
    title: 'Mouse',
    variantTitle: 'Black',
    quantity: 1,
    unitPricePaise: 100_000,
    gstRatePercent: 18,
    hsCode: '847160',
  })
  return o?.id as string
}

async function issueOn(storeId: string, orderId: string, at: Date) {
  return inStore(storeId, async (tx) => {
    const q = await enqueueOrder(tx, storeId, orderId, 'manual', at)
    if (!q) throw new Error('not queued')
    await issueDrafts(tx, storeId, [{ id: q.row.id, invoiceDate: at }], { commit: true, now: at })
    const [row] = await tx.select().from(invoice).where(eq(invoice.id, q.row.id))
    return row as typeof invoice.$inferSelect
  })
}

const NOV = d('2026-11-10T06:00:00Z')

describe('setting a series next number', () => {
  it('export series set to 2: the next export invoice is EXP/26-27/0002', async () => {
    const { storeId, variantId } = await seedStore()
    const set = await inStore(storeId, (tx) =>
      setSeriesNextNumber(tx, storeId, null, 'exp', 2, NOV),
    )
    expect(set).toEqual({ next: 2, number: 'EXP/26-27/0002' })
    const row = await issueOn(storeId, await seedExport(storeId, variantId, 1), NOV)
    expect(row).toMatchObject({ seriesId: 'exp', number: 'EXP/26-27/0002' })
    const next = await issueOn(storeId, await seedExport(storeId, variantId, 2), NOV)
    expect(next.number).toBe('EXP/26-27/0003')
  })

  it('refuses a number below the last issued this financial year, and an unknown series', async () => {
    const { storeId, variantId } = await seedStore()
    await inStore(storeId, (tx) => setSeriesNextNumber(tx, storeId, null, 'exp', 5, NOV))
    await issueOn(storeId, await seedExport(storeId, variantId, 1), NOV)
    await expect(
      inStore(storeId, (tx) => setSeriesNextNumber(tx, storeId, null, 'exp', 3, NOV)),
    ).rejects.toThrow('Numbers up to 5 are already used; pick 6 or more')
    await expect(
      inStore(storeId, (tx) => setSeriesNextNumber(tx, storeId, null, 'exp', 5, NOV)),
    ).rejects.toThrow(/pick 6 or more/)
    expect(
      await inStore(storeId, (tx) => setSeriesNextNumber(tx, storeId, null, 'exp', 6, NOV)),
    ).toEqual({ next: 6, number: 'EXP/26-27/0006' })
    await expect(
      inStore(storeId, (tx) => setSeriesNextNumber(tx, storeId, null, 'nope', 2, NOV)),
    ).rejects.toThrow(/Save the series first/)
  })

  it('refuses a number that would not fit in 16 characters', async () => {
    const { storeId } = await seedStore()
    await expect(
      inStore(storeId, (tx) => setSeriesNextNumber(tx, storeId, null, 'exp', 99_999_999, NOV)),
    ).rejects.toThrow(/at most 16 characters/)
  })
})
