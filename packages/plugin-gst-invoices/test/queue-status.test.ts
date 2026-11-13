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
import { issueCreditNote } from '../src/credit-notes'
import { cancelInvoice, enqueueOrder, issueDrafts } from '../src/queue'
import { buyerPlace, nextReset, queueRows, queueStats, queueStatus } from '../src/queue-status'
import { invoice } from '../src/schema'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const d = (iso: string) => new Date(iso)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const base = {
  lines: [{ hsn: '620520', productId: 'p1' }],
  defaultHsn: '',
  hsnDigits: 4,
  buyerGstin: null,
  exported: false,
  buyerMissing: [],
}

describe('queue status rules', () => {
  it('is Ready for an ordinary order and Ready · B2B when the buyer has a GSTIN', () => {
    expect(queueStatus(base)).toEqual({ status: 'ready', fix: null })
    expect(queueStatus({ ...base, buyerGstin: '08AAACN1234Q1Z2' }).status).toBe('ready_b2b')
    expect(queueStatus({ ...base, exported: true }).status).toBe('ready_export')
  })

  it('flags a line with no HSN and points at its product', () => {
    const r = queueStatus({
      ...base,
      lines: [
        { hsn: '620520', productId: 'p1' },
        { hsn: null, productId: 'p2' },
      ],
    })
    expect(r).toEqual({ status: 'hsn_missing', fix: { kind: 'product', productId: 'p2' } })
    // A deleted product: fix it on the order.
    expect(queueStatus({ ...base, lines: [{ hsn: '', productId: null }] }).fix).toEqual({
      kind: 'order',
    })
  })

  it('takes the default HSN from settings as a fix for lines without one', () => {
    expect(
      queueStatus({ ...base, defaultHsn: '6205', lines: [{ hsn: null, productId: 'p1' }] }).status,
    ).toBe('ready')
  })

  it('asks for buyer details on a large unregistered sale, after HSN', () => {
    expect(queueStatus({ ...base, buyerMissing: ['state'] })).toEqual({
      status: 'buyer_details',
      fix: { kind: 'order' },
    })
    expect(
      queueStatus({ ...base, buyerMissing: ['state'], lines: [{ hsn: null, productId: 'p1' }] })
        .status,
    ).toBe('hsn_missing')
  })

  it('resets numbering on the next 1 April, IST', () => {
    expect(nextReset(d('2026-11-13T10:00:00Z')).toISOString()).toBe('2027-03-31T18:30:00.000Z')
    expect(nextReset(d('2027-03-31T19:00:00Z')).toISOString()).toBe('2028-03-31T18:30:00.000Z')
  })
})

describe('queue rows and stats', () => {
  beforeEach(async () => {
    await resetDb(owner)
  })

  async function seed() {
    const [s] = await owner
      .insert(store)
      .values({
        slug: 'waimers',
        name: 'Waimers',
        gstin: '06AAPFU0939F1ZZ',
        address: { line1: '14 Sector 29', city: 'Gurugram', state: 'HR', pincode: '122001' },
      })
      .returning()
    const storeId = s?.id as string
    const [p] = await owner
      .insert(product)
      .values({ storeId, handle: 'kurta', title: 'Kurta' })
      .returning()
    const [v] = await owner
      .insert(variant)
      .values({
        storeId,
        productId: p?.id as string,
        title: 'M',
        sku: 'KRT-M',
        pricePaise: 100_000,
      })
      .returning()
    return { storeId, productId: p?.id as string, variantId: v?.id as string }
  }

  async function seedOrder(storeId: string, variantId: string, n: number, gstin?: string) {
    const [a] = await owner
      .insert(address)
      .values({
        storeId,
        name: 'Priya N',
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
        subtotalPaise: 100_000,
        totalPaise: 100_000,
        email: 'priya@example.com',
        buyerGstin: gstin ?? null,
      })
      .returning()
    await owner.insert(orderLine).values({
      storeId,
      orderId: o?.id as string,
      variantId,
      title: 'Kurta',
      variantTitle: 'M',
      quantity: 1,
      unitPricePaise: 100_000,
      gstRatePercent: 12,
    })
    return o?.id as string
  }

  const inStore = <T>(storeId: string, fn: Parameters<typeof withStore<T>>[2]) =>
    withStore(app, storeId, fn)

  it('shows HSN missing until the product gets a code, with taxable value and GST', async () => {
    const { storeId, productId, variantId } = await seed()
    const orderId = await seedOrder(storeId, variantId, 1049)
    await inStore(storeId, (tx) => enqueueOrder(tx, storeId, orderId, 'manual'))
    const [before] = await inStore(storeId, (tx) => queueRows(tx, storeId, {}))
    expect(before?.status).toBe('hsn_missing')
    expect(before?.fix).toEqual({ kind: 'product', productId })
    expect(before?.row.taxablePaise).toBeGreaterThan(0)
    expect(before && buyerPlace(before.doc)).toBe('Mumbai, Maharashtra')

    await owner.update(product).set({ hsCode: '620520' }).where(eq(product.id, productId))
    const [after] = await inStore(storeId, (tx) => queueRows(tx, storeId, {}))
    expect(after?.status).toBe('ready')
  })

  it('marks a buyer with a GSTIN Ready · B2B', async () => {
    const { storeId, productId, variantId } = await seed()
    await owner.update(product).set({ hsCode: '620520' }).where(eq(product.id, productId))
    const orderId = await seedOrder(storeId, variantId, 1044, '27AAPFU0939F1ZV')
    await inStore(storeId, (tx) => enqueueOrder(tx, storeId, orderId, 'manual'))
    const [row] = await inStore(storeId, (tx) => queueRows(tx, storeId, {}))
    expect(row?.status).toBe('ready_b2b')
  })

  it('counts this month: issued (not cancelled), taxable, credit notes and the next number', async () => {
    const { storeId, productId, variantId } = await seed()
    await owner.update(product).set({ hsCode: '620520' }).where(eq(product.id, productId))
    const now = d('2026-11-13T10:00:00Z')
    const issue = async (n: number, at: Date) => {
      const orderId = await seedOrder(storeId, variantId, n)
      return inStore(storeId, async (tx) => {
        const q = await enqueueOrder(tx, storeId, orderId, 'manual', at)
        await issueDrafts(tx, storeId, [{ id: q?.row.id as string, invoiceDate: at }], {
          commit: true,
          now,
        })
        const [row] = await tx
          .select()
          .from(invoice)
          .where(eq(invoice.id, q?.row.id as string))
        return { orderId, row: row as typeof invoice.$inferSelect }
      })
    }
    await issue(1, d('2026-10-20T10:00:00Z')) // last month: not counted
    const a = await issue(2, d('2026-11-02T10:00:00Z'))
    const b = await issue(3, d('2026-11-05T10:00:00Z'))
    await inStore(storeId, (tx) => cancelInvoice(tx, b.row.id, 'typo'))

    const [pay] = await owner
      .insert(payment)
      .values({
        storeId,
        orderId: a.orderId,
        provider: 'razorpay',
        providerRef: 'x',
        status: 'captured',
        amountPaise: 100_000,
      })
      .returning()
    const [r] = await owner
      .insert(refund)
      .values({
        storeId,
        orderId: a.orderId,
        paymentId: pay?.id as string,
        amountPaise: 30_000,
        status: 'processed',
        reason: 'Damaged',
      })
      .returning()
    const note = await inStore(storeId, (tx) =>
      issueCreditNote(tx, storeId, r?.id as string, { at: d('2026-11-10T10:00:00Z') }),
    )
    expect(note).not.toBeNull()

    const stats = await inStore(storeId, (tx) => queueStats(tx, storeId, undefined, null, now))
    expect(stats.issued).toEqual({ count: 1, taxablePaise: a.row.taxablePaise })
    expect(stats.creditNotes.count).toBe(1)
    expect(stats.creditNotes.totalPaise).toBe(
      Math.abs(DocumentSnapshotSchema.parse(note?.row.snapshot).totals.totalPaise),
    )
    // Three numbers taken this financial year (the cancelled one stays used): the 4th is next.
    expect(stats.next?.number).toMatch(/0004$/)
    expect(stats.next?.resetsAt?.toISOString()).toBe('2027-03-31T18:30:00.000Z')
  })
})
