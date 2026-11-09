/** SOURCE OF TRUTH: "Recalculate GST from products" on an issued tax invoice — WHAT the guard (issued, unfiled tax invoice only), the order-line refresh and the rebuild under the same number / WHY an order keeps the GST it was placed with, so a product whose Charge GST or rate was fixed later needs this to correct an invoice that is not yet in GSTR-1 */
import { refreshOrderLineGst } from '@commerce/core/refresh-gst'
import type { StoreTx } from '@commerce/db'
import { getDocument, InvoiceError, regenerateDocument } from './issue'
import type { invoice } from './schema'

type Row = Pick<typeof invoice.$inferSelect, 'kind' | 'status' | 'reportedPeriod' | 'number'>

/** Why this document cannot take its products' GST now, or null when it can. */
function gstRefreshBlock(row: Row): InvoiceError | null {
  if (row.kind !== 'tax_invoice') {
    return new InvoiceError('invalid', 'Only a tax invoice can be recalculated')
  }
  if (row.status !== 'issued') {
    return new InvoiceError(
      'invalid',
      row.status === 'cancelled'
        ? `${row.number} is cancelled`
        : 'A queued invoice takes the products as they are when it is issued',
    )
  }
  if (row.reportedPeriod) {
    return new InvoiceError(
      'locked',
      `${row.number} is reported in GSTR-1 for ${row.reportedPeriod}; issue a credit note instead`,
    )
  }
  return null
}

/**
 * The order's lines take their products' GST rate and HSN as they are now, and the invoice is
 * rebuilt under the same number and date (its PDF goes back to pending, so it renders again).
 * Checked before anything is written, so a filed or cancelled invoice leaves the order alone.
 */
export async function refreshInvoiceGst(tx: StoreTx, storeId: string, invoiceId: string) {
  const row = await getDocument(tx, invoiceId)
  if (!row) throw new InvoiceError('not_found', `invoice ${invoiceId} not found`)
  const block = gstRefreshBlock(row)
  if (block) throw block
  const changedLines = await refreshOrderLineGst(tx, row.orderId)
  const updated = await regenerateDocument(tx, storeId, row.id)
  return { row: updated, changedLines }
}
