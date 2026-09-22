import {
  address,
  createDb,
  order,
  orderLine,
  payment,
  product,
  refund,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { DocumentSnapshotSchema } from '@commerce/invoices'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  documentsForOrder,
  issueCreditNote,
  issueDocument,
  loadSettings,
  regenerateDocument,
  saveSettings,
} from '../src/issue'
import { markFiled, setClosed } from '../src/periods'
import { cancelInvoice, enqueueOrder, issueDrafts } from '../src/queue'
import { gstr1ForPeriod } from '../src/reports'
import { invoice, invoiceSequence } from '../src/schema'
import { issueReceiptVoucher, issueRefundVoucher } from '../src/vouchers'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const NL = String.fromCharCode(10)
const d = (iso: string) => new Date(iso)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seedStore(slug = 'waimers') {
  const [s] = await owner
    .insert(store)
    .values({
      slug,
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
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({
      storeId: s.id,
      productId: p.id,
      title: 'M',
      sku: 'KRT-M',
      hsCode: '620520',
      pricePaise: 100_000,
    })
    .returning()
  if (!v) throw new Error('seed')
  return { storeId: s.id, variantId: v.id }
}

type SeedOpts = { state?: string; tags?: string[]; country?: string }

async function seedOrder(storeId: string, variantId: string, n: number, opts: SeedOpts = {}) {
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Aarav Mehta',
      line1: 'Carter Road',
      city: opts.country ? 'Dubai' : 'Mumbai',
      stateCode: opts.state ?? 'MH',
      pincode: '400050',
      country: opts.country ?? 'IN',
      phone: '9820012345',
    })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: n,
      status: 'paid',
      paymentMethod: 'razorpay',
      shippingAddressId: a?.id,
      subtotalPaise: 200_000,
      shippingPaise: 5_000,
      totalPaise: 205_000,
      email: 'aarav@example.com',
      tags: opts.tags ?? [],
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

/** Queue an order by hand and issue it dated `at`: the merchant's Review, Issue. */
async function issueOn(storeId: string, orderId: string, at: Date, now = at) {
  return inStore(storeId, async (tx) => {
    const q = await enqueueOrder(tx, storeId, orderId, 'manual', at)
    if (!q) throw new Error('not queued')
    const [plan] = await issueDrafts(tx, storeId, [{ id: q.row.id, invoiceDate: at }], {
      commit: true,
      now,
    })
    const [row] = await tx.select().from(invoice).where(eq(invoice.id, q.row.id))
    return { plan, row: row as typeof invoice.$inferSelect }
  })
}

async function seedRefund(storeId: string, orderId: string, amountPaise: number) {
  const [p] = await owner
    .insert(payment)
    .values({
      storeId,
      orderId,
      provider: 'razorpay',
      providerRef: 'x',
      status: 'captured',
      amountPaise: 205_000,
    })
    .returning()
  const [r] = await owner
    .insert(refund)
    .values({
      storeId,
      orderId,
      paymentId: p?.id as string,
      amountPaise,
      status: 'processed',
      reason: 'Damaged',
    })
    .returning()
  return r?.id as string
}

describe('settings and one-off documents', () => {
  it('prefills the seller from Settings > General before anything is saved', async () => {
    const { storeId } = await seedStore()
    const s = await inStore(storeId, (tx) => loadSettings(tx, storeId))
    expect(s.seller).toMatchObject({
      legalName: 'Waimers',
      gstin: '06AAPFU0939F1ZZ',
      stateCode: 'HR',
    })
  })

  it('does not number packing slips and refuses kinds that are switched off', async () => {
    const { storeId, variantId } = await seedStore()
    const orderId = await seedOrder(storeId, variantId, 1)
    await expect(
      inStore(storeId, (tx) => issueDocument(tx, storeId, orderId, 'packing_slip')),
    ).rejects.toThrow(/switched off/)
    await inStore(storeId, async (tx) => {
      const s = await loadSettings(tx, storeId)
      await saveSettings(tx, storeId, {
        ...s,
        documents: { ...s.documents, packing_slip: { ...s.documents.packing_slip, enabled: true } },
      })
    })
    const slip = await inStore(storeId, (tx) => issueDocument(tx, storeId, orderId, 'packing_slip'))
    expect(slip.row.number).toBeNull()
    expect(await owner.select().from(invoiceSequence)).toHaveLength(0)
  })
})

describe('invoice queue', () => {
  it('queues without a number; the number comes only at issue, with the GST split', async () => {
    const { storeId, variantId } = await seedStore()
    const orderId = await seedOrder(storeId, variantId, 1)
    const q = await inStore(storeId, (tx) =>
      enqueueOrder(tx, storeId, orderId, 'paid', d('2025-06-01T10:00:00Z')),
    )
    const again = await inStore(storeId, (tx) => enqueueOrder(tx, storeId, orderId, 'paid'))
    expect(q?.row).toMatchObject({ status: 'draft', number: null })
    expect(again?.row.id).toBe(q?.row.id)
    expect(await owner.select().from(invoiceSequence)).toHaveLength(0)
    const { row } = await issueOn(storeId, orderId, d('2025-06-02T10:00:00Z'))
    expect(row).toMatchObject({ status: 'issued', number: 'INV/25-26/0001', seriesId: 'inv' })
    const doc = DocumentSnapshotSchema.parse(row.snapshot)
    expect(doc.number).toBe('INV/25-26/0001')
    expect(doc.placeOfSupply?.gstCode).toBe('27')
    expect(doc.interState).toBe(true)
    expect(doc.lines[0]).toMatchObject({ hsn: '6205', sku: 'KRT-M', ratePercent: 12 })
    expect(doc.totals.totalPaise).toBe(205_000)
  })

  it('a pre-order waits for dispatch and takes the next number in the dispatch month', async () => {
    const { storeId, variantId } = await seedStore()
    const pre = await seedOrder(storeId, variantId, 1, { tags: ['pre-order'] })
    const later = await seedOrder(storeId, variantId, 2)
    // Paid in September: not eligible yet, but the advance gets a receipt voucher.
    expect(
      await inStore(storeId, (tx) =>
        enqueueOrder(tx, storeId, pre, 'paid', d('2026-09-20T06:00:00Z')),
      ),
    ).toBeNull()
    const rv = await inStore(storeId, (tx) =>
      issueReceiptVoucher(tx, storeId, pre, d('2026-09-20T06:00:00Z')),
    )
    expect(rv?.row.number).toBe('RV/26-27/0001')
    expect(DocumentSnapshotSchema.parse(rv?.row.snapshot).totals.taxPaise).toBe(0)
    const sept = await issueOn(storeId, later, d('2026-09-25T06:00:00Z'))
    expect(sept.row.number).toBe('INV/26-27/0001')
    // Dispatched in October: now it queues, dated at dispatch, numbered after September's.
    const q = await inStore(storeId, (tx) =>
      enqueueOrder(tx, storeId, pre, 'fulfilled', d('2026-10-03T06:00:00Z')),
    )
    expect(q?.row.dispatchedAt).toEqual(d('2026-10-03T06:00:00Z'))
    const [plan] = await inStore(storeId, (tx) =>
      issueDrafts(
        tx,
        storeId,
        [{ id: q?.row.id as string, invoiceDate: d('2026-10-03T06:00:00Z') }],
        { commit: true, now: d('2026-10-03T07:00:00Z') },
      ),
    )
    expect(plan?.number).toBe('INV/26-27/0002')
  })

  it('a pre-order paid in March and dispatched in April starts the new year series', async () => {
    const { storeId, variantId } = await seedStore()
    const a = await seedOrder(storeId, variantId, 1)
    const pre = await seedOrder(storeId, variantId, 2, { tags: ['pre-order'] })
    await issueOn(storeId, a, d('2026-03-20T06:00:00Z'))
    const april = await issueOn(storeId, pre, d('2026-04-02T06:00:00Z'))
    expect(april.row.number).toBe('INV/26-27/0001')
  })

  it('batch issue numbers in invoice-date order, keeping the reviewer order within a day', async () => {
    const { storeId, variantId } = await seedStore()
    const ids: string[] = []
    for (let n = 1; n <= 4; n++) {
      const orderId = await seedOrder(storeId, variantId, n)
      const q = await inStore(storeId, (tx) => enqueueOrder(tx, storeId, orderId, 'manual'))
      ids.push(q?.row.id as string)
    }
    const [a, b, c, e] = ids as [string, string, string, string]
    const items = [
      { id: a, invoiceDate: d('2025-06-05T06:00:00Z') },
      { id: b, invoiceDate: d('2025-06-03T06:00:00Z') },
      { id: c, invoiceDate: d('2025-06-05T06:00:00Z') },
      { id: e, invoiceDate: d('2025-06-04T06:00:00Z') },
    ]
    const now = d('2025-06-06T06:00:00Z')
    const preview = await inStore(storeId, (tx) =>
      issueDrafts(tx, storeId, items, { commit: false, now }),
    )
    expect(await owner.select().from(invoiceSequence)).toHaveLength(0)
    const plan = await inStore(storeId, (tx) =>
      issueDrafts(tx, storeId, items, { commit: true, now }),
    )
    expect(plan).toEqual(preview)
    expect(plan.map((p) => [p.id, p.number])).toEqual([
      [b, 'INV/25-26/0001'],
      [e, 'INV/25-26/0002'],
      [a, 'INV/25-26/0003'],
      [c, 'INV/25-26/0004'],
    ])
  })

  it('refuses a date before the last issued invoice, a future date and a closed month', async () => {
    const { storeId, variantId } = await seedStore()
    const a = await seedOrder(storeId, variantId, 1)
    const b = await seedOrder(storeId, variantId, 2)
    await issueOn(storeId, a, d('2025-06-10T06:00:00Z'))
    const q = await inStore(storeId, (tx) => enqueueOrder(tx, storeId, b, 'manual'))
    const id = q?.row.id as string
    const now = d('2025-07-02T06:00:00Z')
    const issue = (iso: string) =>
      inStore(storeId, (tx) =>
        issueDrafts(tx, storeId, [{ id, invoiceDate: d(iso) }], { commit: true, now }),
      )
    await expect(issue('2025-06-01T06:00:00Z')).rejects.toThrow(/go back past the last issued/)
    await expect(issue('2025-07-09T06:00:00Z')).rejects.toThrow(/future/)
    await inStore(storeId, (tx) => setClosed(tx, storeId, '2025-06', true))
    await expect(issue('2025-06-20T06:00:00Z')).rejects.toThrow(/closed/)
    const ok = await issue('2025-07-01T06:00:00Z')
    expect(ok[0]?.number).toBe('INV/25-26/0002')
  })

  it('never hands out the same number twice under concurrent issuance', async () => {
    const { storeId, variantId } = await seedStore()
    const drafts: string[] = []
    for (let n = 1; n <= 10; n++) {
      const orderId = await seedOrder(storeId, variantId, n)
      const q = await inStore(storeId, (tx) => enqueueOrder(tx, storeId, orderId, 'manual'))
      drafts.push(q?.row.id as string)
    }
    const at = d('2025-06-01T10:00:00Z')
    const plans = await Promise.all(
      drafts.map((id) =>
        inStore(storeId, (tx) =>
          issueDrafts(tx, storeId, [{ id, invoiceDate: at }], { commit: true, now: at }),
        ),
      ),
    )
    const numbers = plans
      .flat()
      .map((p) => p.number)
      .sort()
    expect(new Set(numbers).size).toBe(10)
    expect(numbers[9]).toBe('INV/25-26/0010')
  })

  it('concurrent queueing of one order makes one draft', async () => {
    const { storeId, variantId } = await seedStore()
    const orderId = await seedOrder(storeId, variantId, 1)
    const rows = await Promise.all(
      Array.from({ length: 6 }, () =>
        inStore(storeId, (tx) => enqueueOrder(tx, storeId, orderId, 'paid')),
      ),
    )
    expect(new Set(rows.map((r) => r?.row.id)).size).toBe(1)
  })

  it('regenerates an unreported invoice with a buyer GSTIN, keeping number and date', async () => {
    const { storeId, variantId } = await seedStore()
    const orderId = await seedOrder(storeId, variantId, 1)
    const { row } = await issueOn(storeId, orderId, d('2025-06-01T10:00:00Z'))
    const updated = await inStore(storeId, (tx) =>
      regenerateDocument(tx, storeId, row.id, { buyerGstin: '27AAPFU0939F1ZV' }),
    )
    expect(updated).toMatchObject({
      number: row.number,
      buyerGstin: '27AAPFU0939F1ZV',
      pdfStatus: 'pending',
    })
    expect(updated.invoiceDate).toEqual(row.invoiceDate)
  })
})

describe('series', () => {
  it('domestic and export orders in one month draw from separate series, both reset on 1 April', async () => {
    const { storeId, variantId } = await seedStore()
    const dom1 = await seedOrder(storeId, variantId, 1)
    const exp1 = await seedOrder(storeId, variantId, 2, { country: 'AE', state: 'DU' })
    const dom2 = await seedOrder(storeId, variantId, 3)
    const exp2 = await seedOrder(storeId, variantId, 4, { country: 'AE', state: 'DU' })
    expect((await issueOn(storeId, dom1, d('2026-03-10T06:00:00Z'))).row.number).toBe(
      'INV/25-26/0001',
    )
    const e = await issueOn(storeId, exp1, d('2026-03-11T06:00:00Z'))
    expect(e.row).toMatchObject({ number: 'EXP/25-26/0001', seriesId: 'exp' })
    expect((await issueOn(storeId, dom2, d('2026-04-01T06:00:00Z'))).row.number).toBe(
      'INV/26-27/0001',
    )
    expect((await issueOn(storeId, exp2, d('2026-04-02T06:00:00Z'))).row.number).toBe(
      'EXP/26-27/0001',
    )
  })

  it('an export under LUT carries no IGST, the endorsement and place of supply 96, and goes to Table 6A', async () => {
    const { storeId, variantId } = await seedStore()
    await inStore(storeId, async (tx) => {
      const s = await loadSettings(tx, storeId)
      await saveSettings(tx, storeId, { ...s, lutNumber: 'AD0604260012345', lutFy: '2026-27' })
    })
    const orderId = await seedOrder(storeId, variantId, 1, { country: 'AE', state: 'DU' })
    await inStore(storeId, (tx) => enqueueOrder(tx, storeId, orderId, 'manual'))
    const [draft] = await owner.select().from(invoice).where(eq(invoice.orderId, orderId))
    await inStore(storeId, (tx) =>
      regenerateDocument(tx, storeId, draft?.id as string, {
        exportDetails: {
          portCode: 'INBOM4',
          shippingBillNumber: '1234567',
          shippingBillDate: '2026-09-11',
        },
      }),
    )
    const [plan] = await inStore(storeId, (tx) =>
      issueDrafts(
        tx,
        storeId,
        [{ id: draft?.id as string, invoiceDate: d('2026-09-12T06:00:00Z') }],
        {
          commit: true,
          now: d('2026-09-12T06:00:00Z'),
        },
      ),
    )
    const [row] = await owner
      .select()
      .from(invoice)
      .where(eq(invoice.id, plan?.id as string))
    const doc = DocumentSnapshotSchema.parse(row?.snapshot)
    expect(doc.totals).toMatchObject({ taxPaise: 0, totalPaise: 205_000 })
    expect(doc.placeOfSupply?.gstCode).toBe('96')
    expect(doc.exportSupply).toMatchObject({
      mode: 'lut',
      country: 'AE',
      lutNumber: 'AD0604260012345',
      shippingBillNumber: '1234567',
      endorsement:
        'SUPPLY MEANT FOR EXPORT UNDER LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX',
    })
    const out = await inStore(storeId, (tx) =>
      gstr1ForPeriod(tx, d('2026-08-31T18:30:00Z'), d('2026-09-30T18:30:00Z')),
    )
    expect(out.exp.split(NL)[1]).toBe(
      'WOPAY,EXP/26-27/0001,12-Sep-2026,2050.00,INBOM4,1234567,11-Sep-2026,0,2050.00,0.00',
    )
    expect(out.b2cs.split(NL)).toHaveLength(1)
  })
})

describe('cancellation, credit notes and GSTR-1', () => {
  it('cancels before the month is filed; the number is never reused', async () => {
    const { storeId, variantId } = await seedStore()
    const a = await seedOrder(storeId, variantId, 1)
    const b = await seedOrder(storeId, variantId, 2)
    const first = await issueOn(storeId, a, d('2025-06-01T10:00:00Z'))
    const cancelled = await inStore(storeId, (tx) => cancelInvoice(tx, first.row.id, 'Wrong buyer'))
    expect(cancelled).toMatchObject({ status: 'cancelled', number: 'INV/25-26/0001' })
    const second = await issueOn(storeId, b, d('2025-06-02T10:00:00Z'))
    expect(second.row.number).toBe('INV/25-26/0002')
    const again = await issueOn(storeId, a, d('2025-06-03T10:00:00Z'))
    expect(again.row.number).toBe('INV/25-26/0003')
  })

  it('refuses to cancel once GSTR-1 is marked filed, leaving the credit note path', async () => {
    const { storeId, variantId } = await seedStore()
    const orderId = await seedOrder(storeId, variantId, 1)
    const inv = await issueOn(storeId, orderId, d('2025-06-01T10:00:00Z'))
    await inStore(storeId, (tx) => markFiled(tx, storeId, '2025-06', true))
    await expect(inStore(storeId, (tx) => cancelInvoice(tx, inv.row.id, 'late'))).rejects.toThrow(
      /reported in GSTR-1 for 2025-06\. Issue a credit note instead/,
    )
    await expect(
      inStore(storeId, (tx) => regenerateDocument(tx, storeId, inv.row.id, { buyerGstin: null })),
    ).rejects.toThrow(/credit note/)
    const refundId = await seedRefund(storeId, orderId, 50_000)
    const note = await inStore(storeId, (tx) =>
      issueCreditNote(tx, storeId, refundId, { at: d('2025-07-05T10:00:00Z') }),
    )
    expect(note?.row.number).toBe('CN/25-26/0001')
    const doc = DocumentSnapshotSchema.parse(note?.row.snapshot)
    expect(doc.original?.number).toBe('INV/25-26/0001')
    expect(doc.totals.totalPaise).toBe(50_000)
  })

  it('stops credit notes after 30 November following the year of supply', async () => {
    const { storeId, variantId } = await seedStore()
    const orderId = await seedOrder(storeId, variantId, 1)
    await issueOn(storeId, orderId, d('2025-06-01T10:00:00Z'))
    const refundId = await seedRefund(storeId, orderId, 10_000)
    await expect(
      inStore(storeId, (tx) =>
        issueCreditNote(tx, storeId, refundId, { at: d('2026-12-01T10:00:00Z') }),
      ),
    ).rejects.toThrow(/section 34\(2\)/)
  })

  it('a pre-order refunded before dispatch gets a refund voucher, not a credit note', async () => {
    const { storeId, variantId } = await seedStore()
    const pre = await seedOrder(storeId, variantId, 1, { tags: ['pre-order'] })
    await inStore(storeId, (tx) => issueReceiptVoucher(tx, storeId, pre, d('2025-06-01T10:00:00Z')))
    const refundId = await seedRefund(storeId, pre, 205_000)
    expect(await inStore(storeId, (tx) => issueCreditNote(tx, storeId, refundId))).toBeNull()
    const rfv = await inStore(storeId, (tx) =>
      issueRefundVoucher(tx, storeId, refundId, d('2025-06-03T10:00:00Z')),
    )
    expect(rfv?.row.number).toBe('RFV/25-26/0001')
    expect(DocumentSnapshotSchema.parse(rfv?.row.snapshot).original?.number).toBe('RV/25-26/0001')
  })

  it('exports B2B, CDNR and Table 13 counts with cancelled numbers', async () => {
    const { storeId, variantId } = await seedStore()
    const a = await seedOrder(storeId, variantId, 1)
    const b = await seedOrder(storeId, variantId, 2)
    const c = await seedOrder(storeId, variantId, 3)
    await inStore(storeId, (tx) => enqueueOrder(tx, storeId, a, 'manual'))
    const [draftA] = await owner.select().from(invoice).where(eq(invoice.orderId, a))
    await inStore(storeId, (tx) =>
      regenerateDocument(tx, storeId, draftA?.id as string, { buyerGstin: '27AAPFU0939F1ZV' }),
    )
    await inStore(storeId, (tx) =>
      issueDrafts(
        tx,
        storeId,
        [{ id: draftA?.id as string, invoiceDate: d('2026-09-01T06:00:00Z') }],
        {
          commit: true,
          now: d('2026-09-01T06:00:00Z'),
        },
      ),
    )
    const second = await issueOn(storeId, b, d('2026-09-02T06:00:00Z'))
    await issueOn(storeId, c, d('2026-09-03T06:00:00Z'))
    await inStore(storeId, (tx) => cancelInvoice(tx, second.row.id, 'Duplicate'))
    const refundId = await seedRefund(storeId, a, 50_000)
    await inStore(storeId, (tx) =>
      issueCreditNote(tx, storeId, refundId, { at: d('2026-09-05T06:00:00Z') }),
    )
    const out = await inStore(storeId, (tx) =>
      gstr1ForPeriod(tx, d('2026-08-31T18:30:00Z'), d('2026-09-30T18:30:00Z')),
    )
    expect(out.b2b.split(NL).filter(Boolean)).toHaveLength(2)
    expect(out.cdnr.split(NL)[1]).toContain('CN/26-27/0001')
    expect(out.docs.split(NL)).toEqual([
      'Nature of Document,Sr. No. From,Sr. No. To,Total Number,Cancelled,Net Issued',
      'Invoices for outward supply,INV/26-27/0001,INV/26-27/0003,3,1,2',
      'Credit Note,CN/26-27/0001,CN/26-27/0001,1,0,1',
    ])
    expect(await inStore(storeId, (tx) => documentsForOrder(tx, a))).toHaveLength(2)
  })
})

describe('isolation', () => {
  it('a store cannot see another store invoices', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    const orderId = await seedOrder(a.storeId, a.variantId, 1)
    await inStore(a.storeId, (tx) => enqueueOrder(tx, a.storeId, orderId, 'manual'))
    const seen = await inStore(b.storeId, (tx) => tx.select().from(invoice))
    expect(seen).toHaveLength(0)
    const all = await owner.select().from(invoice).where(eq(invoice.storeId, a.storeId))
    expect(all).toHaveLength(1)
  })
})
