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
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { issueCreditNote } from '../src/issue'
import { enqueueOrder, issueDrafts } from '../src/queue'
import { invoice } from '../src/schema'
import { issueReceiptVoucher, issueRefundVoucher } from '../src/vouchers'

/*
 * GST documents for a deposit pre-order (balance collected later):
 * deposit → receipt voucher for the deposit (rule 50); dispatch → one tax
 * invoice for the full value that adjusts the advance; cancelled with the
 * deposit refunded → refund voucher (rule 51) against the receipt voucher.
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

const TOTAL = 205_000
const DEPOSIT = 45_000

async function seedDepositPreorder(slug = 'waimers') {
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
      number: 1,
      status: 'open',
      paymentStatus: 'partially_paid',
      checkoutPaidAt: new Date(),
      paymentMethod: 'razorpay',
      shippingAddressId: a?.id,
      subtotalPaise: 200_000,
      shippingPaise: 5_000,
      totalPaise: TOTAL,
      email: 'aarav@example.com',
      tags: ['pre-order'],
      depositPaise: 40_000,
      balanceDuePaise: TOTAL - DEPOSIT,
    })
    .returning()
  if (!o) throw new Error('seed')
  await owner.insert(orderLine).values({
    storeId: s.id,
    orderId: o.id,
    variantId: v?.id as string,
    title: 'Kurta',
    variantTitle: 'M',
    quantity: 2,
    unitPricePaise: 100_000,
    gstRatePercent: 12,
    hsCode: '620520',
    preorder: true,
  })
  const [dep] = await owner
    .insert(payment)
    .values({
      storeId: s.id,
      orderId: o.id,
      provider: 'razorpay',
      providerRef: 'order_dep',
      status: 'captured',
      amountPaise: DEPOSIT,
    })
    .returning()
  return { storeId: s.id, orderId: o.id, depositPaymentId: dep?.id as string }
}

const inStore = <T>(storeId: string, fn: Parameters<typeof withStore<T>>[2]) =>
  withStore(app, storeId, fn)

describe('deposit pre-order GST documents', () => {
  it('receipt voucher for the deposit, then one full tax invoice adjusting it', async () => {
    const { storeId, orderId } = await seedDepositPreorder()
    const rv = await inStore(storeId, (tx) =>
      issueReceiptVoucher(tx, storeId, orderId, d('2026-09-20T06:00:00Z')),
    )
    expect(rv?.row.number).toBe('RV/26-27/0001')
    expect(rv?.row.totalPaise).toBe(DEPOSIT)
    const voucher = DocumentSnapshotSchema.parse(rv?.row.snapshot)
    expect(voucher.totals.taxPaise).toBe(0)
    expect(voucher.advance).toBeNull()

    // Balance captured later; it rides on the tax invoice, not a second voucher.
    await owner.insert(payment).values({
      storeId,
      orderId,
      provider: 'razorpay',
      providerRef: 'order_bal',
      status: 'captured',
      amountPaise: TOTAL - DEPOSIT,
      purpose: 'balance',
      multiCapture: true,
    })
    await owner.update(order).set({ balanceDuePaise: 0, balancePaidAt: d('2026-10-01T06:00:00Z') })
    // Paid again (a replayed hook): still one voucher.
    const again = await inStore(storeId, (tx) => issueReceiptVoucher(tx, storeId, orderId))
    expect(again?.created).toBe(false)

    const q = await inStore(storeId, (tx) =>
      enqueueOrder(tx, storeId, orderId, 'fulfilled', d('2026-10-03T06:00:00Z')),
    )
    const [plan] = await inStore(storeId, (tx) =>
      issueDrafts(
        tx,
        storeId,
        [{ id: q?.row.id as string, invoiceDate: d('2026-10-03T06:00:00Z') }],
        { commit: true, now: d('2026-10-03T07:00:00Z') },
      ),
    )
    expect(plan?.number).toBe('INV/26-27/0001')
    const invoiceRow = (await owner.select().from(invoice)).find((r) => r.kind === 'tax_invoice')
    const inv = DocumentSnapshotSchema.parse(invoiceRow?.snapshot)
    expect(inv.totals.totalPaise).toBe(TOTAL)
    expect(inv.totals.taxPaise).toBeGreaterThan(0)
    expect(inv.advance).toEqual({
      number: 'RV/26-27/0001',
      issuedAt: d('2026-09-20T06:00:00Z').toISOString(),
      amountPaise: DEPOSIT,
    })
  })

  it('cancelled with the deposit refunded: a refund voucher, not a credit note', async () => {
    const { storeId, orderId, depositPaymentId } = await seedDepositPreorder()
    await inStore(storeId, (tx) =>
      issueReceiptVoucher(tx, storeId, orderId, d('2026-09-20T06:00:00Z')),
    )
    const [r] = await owner
      .insert(refund)
      .values({
        storeId,
        orderId,
        paymentId: depositPaymentId,
        amountPaise: DEPOSIT,
        status: 'processed',
        reason: 'Pre-order cancelled: balance not paid in time',
      })
      .returning()
    const refundId = r?.id as string
    expect(await inStore(storeId, (tx) => issueCreditNote(tx, storeId, refundId))).toBeNull()
    const rfv = await inStore(storeId, (tx) =>
      issueRefundVoucher(tx, storeId, refundId, d('2026-10-12T06:00:00Z')),
    )
    expect(rfv?.row.number).toBe('RFV/26-27/0001')
    expect(rfv?.row.totalPaise).toBe(DEPOSIT)
    expect(DocumentSnapshotSchema.parse(rfv?.row.snapshot).original?.number).toBe('RV/26-27/0001')
  })

  it("isolated: another store's voucher numbering and documents are untouched", async () => {
    const a = await seedDepositPreorder('a')
    const b = await seedDepositPreorder('b')
    await inStore(a.storeId, (tx) => issueReceiptVoucher(tx, a.storeId, a.orderId))
    // Store B cannot issue for A's order, and its own series starts at 1.
    await expect(
      inStore(b.storeId, (tx) => issueReceiptVoucher(tx, b.storeId, a.orderId)),
    ).rejects.toThrow()
    const rvB = await inStore(b.storeId, (tx) => issueReceiptVoucher(tx, b.storeId, b.orderId))
    expect(rvB?.row.number?.endsWith('0001')).toBe(true)
  })
})
