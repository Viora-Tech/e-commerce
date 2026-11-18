import { address, createDb, order, orderLine, product, store, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { cancelInvoice, enqueueOrder, issueDrafts, listQueue } from '../src/queue'
import { recordExternalInvoice } from '../src/record-external'
import { pdfBytes } from '../src/render'
import { gstr1ForPeriod } from '../src/reports'
import { gstReturn } from '../src/returns'
import { invoice } from '../src/schema'

/** "Already invoiced" (owner, 18 Nov 2026): an invoice issued outside Koomerce, recorded. */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const NL = String.fromCharCode(10)
const d = (iso: string) => new Date(iso)
const NOW = d('2026-11-18T06:00:00Z')

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

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
    .values({ storeId: s.id, handle: 'kurta', title: 'Kurta' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({
      storeId: s.id,
      productId: p?.id as string,
      title: 'M',
      sku: 'KRT-M',
      hsCode: '620520',
      pricePaise: 100_000,
    })
    .returning()
  return { storeId: s.id, variantId: v?.id as string }
}

async function seedOrder(storeId: string, variantId: string, n: number) {
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Aarav Mehta',
      line1: 'Carter Road',
      city: 'Mumbai',
      stateCode: 'MH',
      pincode: '400050',
      country: 'IN',
      phone: '9820012345',
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
      subtotalPaise: 200_000,
      shippingPaise: 5_000,
      totalPaise: 205_000,
      email: 'aarav@example.com',
    })
    .returning()
  if (!o) throw new Error('seed')
  await owner.insert(orderLine).values({
    storeId,
    orderId: o.id,
    variantId,
    title: 'Kurta',
    variantTitle: 'M',
    quantity: 2,
    unitPricePaise: 100_000,
    gstRatePercent: 12,
    hsCode: '620520',
  })
  return o.id
}

const inStore = <T>(storeId: string, fn: Parameters<typeof withStore<T>>[2]) =>
  withStore(app, storeId, fn)

/** Queue an order by hand: the draft "Already invoiced" works on. */
async function queued(storeId: string, orderId: string) {
  const q = await inStore(storeId, (tx) => enqueueOrder(tx, storeId, orderId, 'manual', NOW))
  if (!q) throw new Error('not queued')
  return q.row.id
}

const record = (storeId: string, id: string, number: string, at: Date) =>
  inStore(storeId, (tx) =>
    recordExternalInvoice(tx, storeId, id, { number, invoiceDate: at }, { now: NOW }),
  )

describe('already invoiced', () => {
  it('records the number and date, leaves the queue and makes no PDF', async () => {
    const { storeId, variantId } = await seedStore()
    const orderId = await seedOrder(storeId, variantId, 1)
    const id = await queued(storeId, orderId)
    const row = await record(storeId, id, ' vi/26-27/642 ', d('2026-10-05T06:30:00Z'))
    expect(row).toMatchObject({
      status: 'issued',
      source: 'external',
      number: 'VI/26-27/642',
      seriesId: null,
      fyStartYear: 2026,
      pdfStatus: 'none',
    })
    expect(row.totalPaise).toBe(205_000)
    expect(await inStore(storeId, (tx) => listQueue(tx, {}))).toHaveLength(0)
    const deps = {
      storeId,
      inStore: <T>(fn: Parameters<typeof withStore<T>>[2]) => inStore(storeId, fn),
      storage: async () => {
        throw new Error('no storage')
      },
    }
    await expect(pdfBytes(deps, id)).rejects.toThrow(/outside Koomerce/)
  })

  it('refuses a number another invoice of this GSTIN used in the same financial year', async () => {
    const { storeId, variantId } = await seedStore()
    const a = await queued(storeId, await seedOrder(storeId, variantId, 1))
    const b = await queued(storeId, await seedOrder(storeId, variantId, 2))
    await record(storeId, a, 'VI/26-27/642', d('2026-10-05T06:30:00Z'))
    await expect(record(storeId, b, 'vi/26-27/642', d('2026-10-06T06:30:00Z'))).rejects.toThrow(
      /VI\/26-27\/642 is already used by another invoice \(order #1\).*FY 26-27/,
    )
    // A number our own series already gave out is refused the same way.
    const [plan] = await inStore(storeId, (tx) =>
      issueDrafts(tx, storeId, [{ id: b, invoiceDate: d('2026-11-01T06:00:00Z') }], {
        commit: true,
        now: NOW,
      }),
    )
    expect(plan?.number).toBe('INV/26-27/0001')
    const c = await queued(storeId, await seedOrder(storeId, variantId, 3))
    await expect(record(storeId, c, 'INV/26-27/0001', d('2026-11-02T06:00:00Z'))).rejects.toThrow(
      /already used/,
    )
    // A cancelled number stays used too.
    await inStore(storeId, (tx) => cancelInvoice(tx, b, 'Duplicate'))
    await expect(record(storeId, c, 'INV/26-27/0001', d('2026-11-02T06:00:00Z'))).rejects.toThrow(
      /already used/,
    )
  })

  it('takes a number of our own series out of it, so issuing never repeats it', async () => {
    const { storeId, variantId } = await seedStore()
    const a = await queued(storeId, await seedOrder(storeId, variantId, 1))
    const b = await queued(storeId, await seedOrder(storeId, variantId, 2))
    const row = await record(storeId, a, 'INV/26-27/0007', d('2026-11-01T06:00:00Z'))
    expect(row).toMatchObject({ seriesId: 'inv', seq: 7 })
    const [plan] = await inStore(storeId, (tx) =>
      issueDrafts(tx, storeId, [{ id: b, invoiceDate: d('2026-11-02T06:00:00Z') }], {
        commit: true,
        now: NOW,
      }),
    )
    expect(plan?.number).toBe('INV/26-27/0008')
  })

  it('counts in the GSTR-1 export and JSON like an issued invoice, with its own Table 13 row', async () => {
    const { storeId, variantId } = await seedStore()
    const a = await queued(storeId, await seedOrder(storeId, variantId, 1))
    const b = await queued(storeId, await seedOrder(storeId, variantId, 2))
    await record(storeId, a, 'VI/26-27/642', d('2026-10-05T06:30:00Z'))
    await inStore(storeId, (tx) =>
      issueDrafts(tx, storeId, [{ id: b, invoiceDate: d('2026-10-20T06:00:00Z') }], {
        commit: true,
        now: NOW,
      }),
    )
    const [ext] = await owner.select().from(invoice).where(eq(invoice.id, a))
    const [ours] = await owner.select().from(invoice).where(eq(invoice.id, b))
    // Tax worked out from the order exactly as issuing does.
    expect(ext).toMatchObject({
      taxablePaise: ours?.taxablePaise,
      igstPaise: ours?.igstPaise,
      totalPaise: ours?.totalPaise,
    })
    const csv = await inStore(storeId, (tx) =>
      gstr1ForPeriod(tx, d('2026-09-30T18:30:00Z'), d('2026-10-31T18:30:00Z'), null),
    )
    expect(csv.docs.split(NL)).toEqual([
      'Nature of Document,Sr. No. From,Sr. No. To,Total Number,Cancelled,Net Issued',
      'Invoices for outward supply,VI/26-27/642,VI/26-27/642,1,0,1',
      'Invoices for outward supply,INV/26-27/0001,INV/26-27/0001,1,0,1',
    ])
    const ret = await inStore(storeId, (tx) => gstReturn(tx, storeId, '2026-10', null))
    const b2cs = ret.gstr1.b2cs ?? []
    const taxable = b2cs.reduce((n, r) => n + r.txval, 0)
    expect(taxable).toBeCloseTo(((ext?.taxablePaise ?? 0) + (ours?.taxablePaise ?? 0)) / 100, 2)
    const docs = ret.gstr1.doc_issue.doc_det.flatMap((x) => x.docs)
    expect(docs.map((x) => x.from)).toContain('VI/26-27/642')
  })
})
