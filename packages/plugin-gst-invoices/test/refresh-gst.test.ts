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
import { markFiled } from '../src/periods'
import { cancelInvoice, enqueueOrder, issueDrafts } from '../src/queue'
import { refreshInvoiceGst } from '../src/refresh-gst'
import { invoice } from '../src/schema'

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

/** Order #2419's shape: the product had no GST when it sold, so the order recorded 0%. */
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
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Pad', gstRatePercent: 0 })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Default', pricePaise: 118_000 })
    .returning()
  if (!v) throw new Error('seed')
  const [a] = await owner
    .insert(address)
    .values({
      storeId: s.id,
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
      storeId: s.id,
      number: 2419,
      status: 'open',
      paymentStatus: 'paid',
      checkoutPaidAt: new Date(),
      paymentMethod: 'razorpay',
      shippingAddressId: a?.id,
      subtotalPaise: 118_000,
      totalPaise: 118_000,
      taxPaise: 0,
      taxBreakdown: { ratePercent: 0, interState: true, byRate: [] },
      email: 'aarav@example.com',
    })
    .returning()
  if (!o) throw new Error('seed')
  await owner.insert(orderLine).values({
    storeId: s.id,
    orderId: o.id,
    variantId: v.id,
    title: 'Pad',
    variantTitle: 'Default',
    quantity: 1,
    unitPricePaise: 118_000,
    gstRatePercent: 0,
  })
  const at = d('2026-11-02T10:00:00Z')
  const inv = await withStore(app, s.id, async (tx) => {
    const q = await enqueueOrder(tx, s.id, o.id, 'manual', at)
    if (!q) throw new Error('not queued')
    await issueDrafts(tx, s.id, [{ id: q.row.id, invoiceDate: at }], { commit: true, now: at })
    const [row] = await tx.select().from(invoice).where(eq(invoice.id, q.row.id))
    return row as typeof invoice.$inferSelect
  })
  return { storeId: s.id, productId: p.id, orderId: o.id, inv }
}

const taxOf = (r: typeof invoice.$inferSelect) => r.cgstPaise + r.sgstPaise + r.igstPaise

describe('recalculate GST from products', () => {
  it('rebuilds an issued invoice at the rate the product has now, under the same number', async () => {
    const { storeId, productId, orderId, inv } = await seed()
    expect(taxOf(inv)).toBe(0)
    await owner.update(product).set({ gstRatePercent: 18 }).where(eq(product.id, productId))

    const { row, changedLines } = await withStore(app, storeId, (tx) =>
      refreshInvoiceGst(tx, storeId, inv.id),
    )

    expect(changedLines).toBe(1)
    expect(row.number).toBe(inv.number)
    expect(row.invoiceDate).toEqual(inv.invoiceDate)
    expect(row.pdfStatus).toBe('pending')
    expect(row.totalPaise).toBe(inv.totalPaise)
    // 1,180 incl. 18% interstate: 180 IGST on a 1,000 taxable value.
    expect(row.igstPaise).toBe(18_000)
    const [line] = await owner.select().from(orderLine).where(eq(orderLine.orderId, orderId))
    expect(line?.gstRatePercent).toBe(18)
  })

  it('changes nothing when the lines already match the products', async () => {
    const { storeId, inv } = await seed()
    const { row, changedLines } = await withStore(app, storeId, (tx) =>
      refreshInvoiceGst(tx, storeId, inv.id),
    )
    expect(changedLines).toBe(0)
    expect(taxOf(row)).toBe(0)
  })

  it('refuses an invoice reported in GSTR-1 and leaves the order lines alone', async () => {
    const { storeId, productId, orderId, inv } = await seed()
    await withStore(app, storeId, (tx) => markFiled(tx, storeId, '2026-11', true, null))
    await owner.update(product).set({ gstRatePercent: 18 }).where(eq(product.id, productId))
    await expect(
      withStore(app, storeId, (tx) => refreshInvoiceGst(tx, storeId, inv.id)),
    ).rejects.toMatchObject({ code: 'locked' })
    const [line] = await owner.select().from(orderLine).where(eq(orderLine.orderId, orderId))
    expect(line?.gstRatePercent).toBe(0)
  })

  it('refuses a cancelled invoice', async () => {
    const { storeId, inv } = await seed()
    await withStore(app, storeId, (tx) => cancelInvoice(tx, inv.id, 'Wrong buyer'))
    await expect(
      withStore(app, storeId, (tx) => refreshInvoiceGst(tx, storeId, inv.id)),
    ).rejects.toMatchObject({ code: 'invalid' })
  })
})
