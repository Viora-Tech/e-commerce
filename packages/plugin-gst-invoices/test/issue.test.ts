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
import { gstr1ForPeriod } from '../src/reports'
import { invoice, invoiceSequence } from '../src/schema'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

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

async function seedOrder(storeId: string, variantId: string, n: number, state = 'MH') {
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Aarav Mehta',
      line1: 'Carter Road',
      city: 'Mumbai',
      stateCode: state,
      pincode: '400050',
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

describe('issueDocument', () => {
  it('prefills the seller from Settings > General before anything is saved', async () => {
    const { storeId } = await seedStore()
    const s = await inStore(storeId, (tx) => loadSettings(tx, storeId))
    expect(s.seller).toMatchObject({
      legalName: 'Waimers',
      gstin: '06AAPFU0939F1ZZ',
      stateCode: 'HR',
    })
  })

  it('issues once per order and kind, with the GST split for the delivery state', async () => {
    const { storeId, variantId } = await seedStore()
    const orderId = await seedOrder(storeId, variantId, 1)
    const at = new Date('2025-06-01T10:00:00Z')
    const first = await inStore(storeId, (tx) =>
      issueDocument(tx, storeId, orderId, 'tax_invoice', { at }),
    )
    const again = await inStore(storeId, (tx) =>
      issueDocument(tx, storeId, orderId, 'tax_invoice', { at }),
    )
    expect(first.created).toBe(true)
    expect(again).toMatchObject({ created: false, row: { id: first.row.id } })
    expect(first.row.number).toBe('INV/25-26/0001')
    const doc = DocumentSnapshotSchema.parse(first.row.snapshot)
    expect(doc.placeOfSupply?.gstCode).toBe('27')
    expect(doc.interState).toBe(true)
    expect(doc.lines[0]).toMatchObject({ hsn: '6205', sku: 'KRT-M', ratePercent: 12 })
    expect(doc.totals.totalPaise).toBe(205_000)
    expect(first.row.igstPaise).toBe(doc.totals.igstPaise)
  })

  it('never hands out the same number twice under concurrent issuance', async () => {
    const { storeId, variantId } = await seedStore()
    const orders = []
    for (let n = 1; n <= 10; n++) orders.push(await seedOrder(storeId, variantId, n))
    const at = new Date('2025-06-01T10:00:00Z')
    const rows = await Promise.all(
      orders.map((orderId) =>
        inStore(storeId, (tx) => issueDocument(tx, storeId, orderId, 'tax_invoice', { at })),
      ),
    )
    const seqs = rows.map((r) => r.row.seq).sort((a, b) => (a ?? 0) - (b ?? 0))
    expect(seqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(new Set(rows.map((r) => r.row.number)).size).toBe(10)
  })

  it('concurrent retries for one order still make one invoice and burn one number', async () => {
    const { storeId, variantId } = await seedStore()
    const orderId = await seedOrder(storeId, variantId, 1)
    const rows = await Promise.all(
      Array.from({ length: 6 }, () =>
        inStore(storeId, (tx) => issueDocument(tx, storeId, orderId, 'tax_invoice')),
      ),
    )
    expect(new Set(rows.map((r) => r.row.id)).size).toBe(1)
    const [seq] = await owner.select().from(invoiceSequence)
    expect(seq?.next).toBe(2)
  })

  it('restarts the count on 1 April IST', async () => {
    const { storeId, variantId } = await seedStore()
    const a = await seedOrder(storeId, variantId, 1)
    const b = await seedOrder(storeId, variantId, 2)
    const march = await inStore(storeId, (tx) =>
      issueDocument(tx, storeId, a, 'tax_invoice', { at: new Date('2026-03-31T18:29:00Z') }),
    )
    const april = await inStore(storeId, (tx) =>
      issueDocument(tx, storeId, b, 'tax_invoice', { at: new Date('2026-03-31T18:31:00Z') }),
    )
    expect(march.row.number).toBe('INV/25-26/0001')
    expect(april.row.number).toBe('INV/26-27/0001')
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

  it('regenerates with a buyer GSTIN, keeping number and date', async () => {
    const { storeId, variantId } = await seedStore()
    const orderId = await seedOrder(storeId, variantId, 1)
    const { row } = await inStore(storeId, (tx) =>
      issueDocument(tx, storeId, orderId, 'tax_invoice'),
    )
    const updated = await inStore(storeId, (tx) =>
      regenerateDocument(tx, storeId, row.id, { buyerGstin: '27AAPFU0939F1ZV' }),
    )
    expect(updated).toMatchObject({
      number: row.number,
      buyerGstin: '27AAPFU0939F1ZV',
      pdfStatus: 'pending',
    })
    expect(updated.issuedAt).toEqual(row.issuedAt)
  })
})

describe('credit notes and GSTR-1', () => {
  it('issues one credit note per refund against the invoice and exports both', async () => {
    const { storeId, variantId } = await seedStore()
    const orderId = await seedOrder(storeId, variantId, 1)
    const at = new Date('2025-06-01T10:00:00Z')
    const inv = await inStore(storeId, (tx) =>
      issueDocument(tx, storeId, orderId, 'tax_invoice', { at, buyerGstin: '27AAPFU0939F1ZV' }),
    )
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
        amountPaise: 50_000,
        status: 'processed',
        reason: 'Damaged',
      })
      .returning()
    const refundId = r?.id as string
    const note = await inStore(storeId, (tx) =>
      issueCreditNote(tx, storeId, refundId, { at: new Date('2025-06-05T10:00:00Z') }),
    )
    const again = await inStore(storeId, (tx) => issueCreditNote(tx, storeId, refundId))
    expect(note?.row.number).toBe('CN/25-26/0001')
    expect(again?.row.id).toBe(note?.row.id)
    const doc = DocumentSnapshotSchema.parse(note?.row.snapshot)
    expect(doc.original).toEqual({
      number: inv.row.number,
      issuedAt: inv.row.issuedAt.toISOString(),
    })
    expect(doc.totals.totalPaise).toBe(50_000)
    expect(await inStore(storeId, (tx) => documentsForOrder(tx, orderId))).toHaveLength(2)

    const out = await inStore(storeId, (tx) =>
      gstr1ForPeriod(tx, new Date('2025-05-31T18:30:00Z'), new Date('2025-06-30T18:30:00Z')),
    )
    expect(out.b2b.split('\n')).toHaveLength(2)
    expect(out.cdnr.split('\n')[1]).toContain('CN/25-26/0001')
  })

  it('skips the credit note when the order was never invoiced', async () => {
    const { storeId, variantId } = await seedStore()
    const orderId = await seedOrder(storeId, variantId, 1)
    const [p] = await owner
      .insert(payment)
      .values({
        storeId,
        orderId,
        provider: 'cod',
        providerRef: 'x',
        status: 'captured',
        amountPaise: 1,
      })
      .returning()
    const [r] = await owner
      .insert(refund)
      .values({ storeId, orderId, paymentId: p?.id as string, amountPaise: 1, status: 'manual' })
      .returning()
    expect(await inStore(storeId, (tx) => issueCreditNote(tx, storeId, r?.id as string))).toBeNull()
  })
})

describe('isolation', () => {
  it('a store cannot see another store invoices', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    const orderId = await seedOrder(a.storeId, a.variantId, 1)
    await inStore(a.storeId, (tx) => issueDocument(tx, a.storeId, orderId, 'tax_invoice'))
    const seen = await inStore(b.storeId, (tx) => tx.select().from(invoice))
    expect(seen).toHaveLength(0)
    const all = await owner.select().from(invoice).where(eq(invoice.storeId, a.storeId))
    expect(all).toHaveLength(1)
  })
})
