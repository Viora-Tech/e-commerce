import {
  address,
  createDb,
  order,
  orderLine,
  orderNote,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { invoiceStates } from '../src/order-states'
import {
  cancelInvoice,
  enqueueOrder,
  enqueueOrderParcels,
  issueDrafts,
  listQueue,
} from '../src/queue'
import {
  recordAlreadyInvoiced,
  recordManyWithoutDetails,
  recordWithoutDetails,
} from '../src/record-without-details'
import { gstr1ForPeriod, listDocuments } from '../src/reports'
import { gstReturn } from '../src/returns'
import { invoice } from '../src/schema'
import { undoExternalInvoice } from '../src/undo-external'

/**
 * "Already invoiced" without a number or date (owner, 23 Nov 2026): Shopify-era orders invoiced
 * in a previous system whose details are gone. They leave the queue for good, count as invoiced,
 * and are reported in no Koomerce return.
 */

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

const blank = (storeId: string, id: string) =>
  inStore(storeId, (tx) =>
    recordWithoutDetails(tx, storeId, id, { now: NOW, author: 'staff@example.com' }),
  )

const NOV = [d('2026-10-31T18:30:00Z'), d('2026-11-30T18:30:00Z')] as const

describe('already invoiced without details', () => {
  it('records no number or date, leaves the queue, makes no PDF and notes the timeline', async () => {
    const { storeId, variantId } = await seedStore()
    const orderId = await seedOrder(storeId, variantId, 2073)
    const id = await queued(storeId, orderId)
    const row = await blank(storeId, id)
    expect(row).toMatchObject({
      status: 'issued',
      source: 'external',
      number: null,
      seq: null,
      fyStartYear: null,
      invoiceDate: null,
      pdfStatus: 'none',
    })
    // The draft's figures stay, so the invoice page still shows what was sold.
    expect(row.totalPaise).toBe(205_000)
    expect(await inStore(storeId, (tx) => listQueue(tx, {}))).toHaveLength(0)
    expect(
      invoiceStates([{ fulfillmentOrderId: null, status: 'issued', source: 'external' }], 0),
    ).toEqual(['invoiced', 'invoiced-outside'])
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes.map((n) => n.body)).toEqual([
      expect.stringMatching(/^Marked as already invoiced outside Koomerce, without/),
    ])
    const list = await inStore(storeId, (tx) =>
      listDocuments(tx, { kind: 'tax_invoice', limit: 10, offset: 0 }),
    )
    expect(list.rows.map((r) => r.number)).toEqual([null])
  })

  it('takes both details or neither; with both it records as before', async () => {
    const { storeId, variantId } = await seedStore()
    const a = await queued(storeId, await seedOrder(storeId, variantId, 1))
    const b = await queued(storeId, await seedOrder(storeId, variantId, 2))
    const rec = (id: string, input: Parameters<typeof recordAlreadyInvoiced>[3]) =>
      inStore(storeId, (tx) => recordAlreadyInvoiced(tx, storeId, id, input, { now: NOW }))
    await expect(rec(a, { number: 'VI/26-27/642' })).rejects.toThrow(/Add the invoice date too/)
    await expect(rec(a, { invoiceDate: d('2026-10-05T06:30:00Z') })).rejects.toThrow(
      /Add the invoice number too/,
    )
    await expect(rec(a, { number: '  ', invoiceDate: null })).resolves.toMatchObject({
      number: null,
      invoiceDate: null,
    })
    await expect(
      rec(b, { number: 'VI/26-27/642', invoiceDate: d('2026-10-05T06:30:00Z') }),
    ).resolves.toMatchObject({ number: 'VI/26-27/642', fyStartYear: 2026 })
  })

  it('is counted in no GSTR-1 or GSTR-3B, while a dated one beside it is', async () => {
    const { storeId, variantId } = await seedStore()
    const a = await queued(storeId, await seedOrder(storeId, variantId, 1))
    const b = await queued(storeId, await seedOrder(storeId, variantId, 2))
    await blank(storeId, a)
    await inStore(storeId, (tx) =>
      issueDrafts(tx, storeId, [{ id: b, invoiceDate: d('2026-11-02T06:00:00Z') }], {
        commit: true,
        now: NOW,
      }),
    )
    const [ours] = await owner.select().from(invoice).where(eq(invoice.id, b))
    const nov = await inStore(storeId, (tx) => gstReturn(tx, storeId, '2026-11', null))
    const taxable = (nov.gstr1.b2cs ?? []).reduce((n, r) => n + r.txval, 0)
    expect(taxable).toBeCloseTo((ours?.taxablePaise ?? 0) / 100, 2)
    expect(nov.gstr1.doc_issue.doc_det.flatMap((x) => x.docs)).toHaveLength(1)
    const csv = await inStore(storeId, (tx) => gstr1ForPeriod(tx, NOV[0], NOV[1], null))
    expect(csv.docs.split(NL)).toEqual([
      'Nature of Document,Sr. No. From,Sr. No. To,Total Number,Cancelled,Net Issued',
      'Invoices for outward supply,INV/26-27/0001,INV/26-27/0001,1,0,1',
    ])
    const oct = await inStore(storeId, (tx) => gstReturn(tx, storeId, '2026-10', null))
    expect(oct.gstr1.b2cs ?? []).toHaveLength(0)
    // GSTR-3B is worked out from GSTR-1: nothing taxable in the month either.
    expect(JSON.stringify(oct.gstr3b)).not.toMatch(/"taxablePaise":[1-9]/)
  })

  it('is never queued again by the paid or fulfilled rules, and cannot be cancelled', async () => {
    const { storeId, variantId } = await seedStore()
    const orderId = await seedOrder(storeId, variantId, 2138)
    const id = await queued(storeId, orderId)
    await blank(storeId, id)
    for (const reason of ['paid', 'fulfilled', 'manual'] as const) {
      const out = await inStore(storeId, (tx) =>
        enqueueOrderParcels(tx, storeId, orderId, reason, NOW),
      )
      expect(out.map((r) => [r.row.id, r.created])).toEqual([[id, false]])
    }
    expect(await inStore(storeId, (tx) => listQueue(tx, {}))).toHaveLength(0)
    await expect(inStore(storeId, (tx) => cancelInvoice(tx, id, 'wrong'))).rejects.toThrow(
      /Undo that instead/,
    )
  })

  it('marks many ticked rows in one go and skips the ones it cannot', async () => {
    const { storeId, variantId } = await seedStore()
    const a = await queued(storeId, await seedOrder(storeId, variantId, 1))
    const b = await queued(storeId, await seedOrder(storeId, variantId, 2))
    const c = await queued(storeId, await seedOrder(storeId, variantId, 3))
    await blank(storeId, c)
    const out = await inStore(storeId, (tx) =>
      recordManyWithoutDetails(tx, storeId, [a, b, c, a], { now: NOW }),
    )
    expect(out.recorded).toBe(2)
    expect(out.skipped).toEqual([{ id: c, reason: expect.stringMatching(/waiting in the queue/) }])
    expect(await inStore(storeId, (tx) => listQueue(tx, {}))).toHaveLength(0)
    const rows = await owner.select().from(invoice).where(eq(invoice.storeId, storeId))
    expect(rows.every((r) => r.status === 'issued' && r.number === null)).toBe(true)
  })

  it('undo puts the order back in the queue and notes it', async () => {
    const { storeId, variantId } = await seedStore()
    const orderId = await seedOrder(storeId, variantId, 1)
    const id = await queued(storeId, orderId)
    await blank(storeId, id)
    const back = await inStore(storeId, (tx) =>
      undoExternalInvoice(tx, storeId, id, { now: NOW, author: 'staff@example.com' }),
    )
    expect(back).toMatchObject({ status: 'draft', source: 'koomerce', pdfStatus: 'pending' })
    expect(await inStore(storeId, (tx) => listQueue(tx, {}))).toHaveLength(1)
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes.map((n) => n.body)).toContain(
      'Undid "Already invoiced" for this order (no invoice details); the order is back in the GST invoices queue',
    )
  })
})
