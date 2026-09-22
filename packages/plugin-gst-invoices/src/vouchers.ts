import { refund, type StoreTx } from '@commerce/db'
import { buildVoucher, DocumentSnapshotSchema } from '@commerce/invoices'
import { eq, sql } from 'drizzle-orm'
import {
  existing,
  type InvoiceRow,
  insertDocument,
  loadSettings,
  orderSnapshot,
  seriesContextOf,
  takeNumber,
} from './issue'
import { assertPeriodOpen } from './periods'
import { invoice } from './schema'

/**
 * Receipt voucher (rule 50) for a paid pre-order: money arrived before the
 * goods, so the tax invoice waits for dispatch. Idempotent per order.
 */
export async function issueReceiptVoucher(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  at: Date = new Date(),
): Promise<{ row: InvoiceRow; created: boolean } | null> {
  const prior = await existing(tx, orderId, 'receipt_voucher')
  if (prior) return { row: prior, created: false }
  const settings = await loadSettings(tx, storeId)
  if (!settings.documents.receipt_voucher.enabled) return null
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`gst-invoices:rv:${orderId}`}))`)
  const again = await existing(tx, orderId, 'receipt_voucher')
  if (again) return { row: again, created: false }
  await assertPeriodOpen(tx, storeId, at)
  const base = await orderSnapshot(tx, storeId, orderId, 'tax_invoice', null, at, settings, null)
  const n = await takeNumber(tx, storeId, 'receipt_voucher', at, settings, seriesContextOf(base))
  const doc = buildVoucher({
    base,
    kind: 'receipt_voucher',
    number: n.number,
    issuedAt: at,
    amountPaise: base.totals.totalPaise,
  })
  const row = await insertDocument(tx, storeId, doc, {
    seq: n.seq,
    fyStartYear: n.fyStartYear,
    seriesId: n.seriesId,
  })
  return row ? { row, created: true } : null
}

/**
 * Refund voucher (rule 51) when an advance comes back before any supply: a
 * pre-order cancelled before dispatch has a receipt voucher and no invoice,
 * so there is nothing for a credit note to reverse. Idempotent per refund.
 */
export async function issueRefundVoucher(
  tx: StoreTx,
  storeId: string,
  refundId: string,
  at: Date = new Date(),
): Promise<{ row: InvoiceRow; created: boolean } | null> {
  const [prior] = await tx.select().from(invoice).where(eq(invoice.refundId, refundId))
  if (prior) return { row: prior, created: false }
  const [r] = await tx.select().from(refund).where(eq(refund.id, refundId))
  if (!r || r.status === 'failed') return null
  const receipt = await existing(tx, r.orderId, 'receipt_voucher')
  const invoiced = await existing(tx, r.orderId, 'tax_invoice')
  if (!receipt || invoiced?.status === 'issued') return null
  const settings = await loadSettings(tx, storeId)
  if (!settings.documents.refund_voucher.enabled) return null
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`gst-invoices:refund:${refundId}`}))`,
  )
  await assertPeriodOpen(tx, storeId, at)
  const base = DocumentSnapshotSchema.parse(receipt.snapshot)
  const n = await takeNumber(tx, storeId, 'refund_voucher', at, settings, seriesContextOf(base))
  const doc = buildVoucher({
    base,
    kind: 'refund_voucher',
    number: n.number,
    issuedAt: at,
    amountPaise: Math.min(r.amountPaise, base.totals.totalPaise),
    original: { number: receipt.number ?? '', issuedAt: receipt.issuedAt.toISOString() },
    reason: r.reason,
  })
  const row = await insertDocument(tx, storeId, doc, {
    refundId,
    seq: n.seq,
    fyStartYear: n.fyStartYear,
    seriesId: n.seriesId,
  })
  return row ? { row, created: true } : null
}
