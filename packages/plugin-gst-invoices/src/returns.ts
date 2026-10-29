import { CommerceError } from '@commerce/core/errors'
import { order, type StoreTx } from '@commerce/db'
import {
  buildGstr1Json,
  buildGstr3b,
  type GstReturnWarning,
  type Gstr1Json,
  type Gstr1Totals,
  type Gstr3b,
  gstReturnChecks,
  gstr1Totals,
  hsnNetQuantities,
} from '@commerce/invoices'
import { inArray } from 'drizzle-orm'
import { loadSettings } from './issue'
import { getPeriod, periodRange } from './periods'
import { documentIssuer } from './registration'
import { gstr1Inputs } from './reports'

export type GstReturn = {
  gstin: string
  legalName: string
  period: string
  /** When this GSTIN's GSTR-1 for the month was marked filed in the app. */
  filedAt: Date | null
  gstr1: Gstr1Json
  totals: Gstr1Totals[]
  gstr3b: Gstr3b
  warnings: GstReturnWarning[]
}

/** Raised when the picked registration has no GSTIN to file under. */
export class GstReturnError extends CommerceError {
  constructor(message: string, storeId: string) {
    super('gst_return_no_gstin', message, { storeId })
  }
}

/**
 * One GSTIN's returns for a `YYYY-MM` month: the GSTR-1 JSON for the portal's upload, its
 * per-table totals, the GSTR-3B outward tables worked out from it, and what to check first.
 */
export async function gstReturn(
  tx: StoreTx,
  storeId: string,
  period: string,
  gstRegistrationId: string | null,
): Promise<GstReturn> {
  const issuer = await documentIssuer(tx, gstRegistrationId)
  const settings = issuer ? null : await loadSettings(tx, storeId)
  const gstin = (issuer?.gstin ?? settings?.seller.gstin ?? '').trim().toUpperCase()
  if (!gstin) throw new GstReturnError('Add the store’s GSTIN before preparing a return', storeId)
  const legalName = issuer?.legalName ?? settings?.seller.legalName ?? ''

  const { from, to } = periodRange(period)
  const inputs = await gstr1Inputs(tx, from, to, gstRegistrationId)
  const filing = await getPeriod(tx, storeId, period, gstRegistrationId)
  const invoices = inputs.invoices.map((i) => i.invoice)
  const creditNotes = inputs.creditNotes.map((n) => n.note)
  const gstr1 = buildGstr1Json({
    gstin,
    period,
    invoices,
    creditNotes,
    documents: inputs.documents,
  })

  // An order that named a business but gave no GSTIN is reported as a sale to a consumer.
  const unregistered = inputs.invoices.filter((i) => !i.invoice.buyerGstin)
  const orderIds = [...new Set(unregistered.map((i) => i.row.orderId))]
  const businesses = orderIds.length
    ? await tx
        .select({ id: order.id, business: order.buyerBusinessName })
        .from(order)
        .where(inArray(order.id, orderIds))
    : []
  const businessOrders = new Set(businesses.filter((b) => b.business?.trim()).map((b) => b.id))

  const filedAt = filing?.gstr1FiledAt ?? null
  const warnings = gstReturnChecks({
    invoices,
    creditNotes,
    gstr1,
    businessWithoutGstin: unregistered
      .filter((i) => businessOrders.has(i.row.orderId))
      .map((i) => i.invoice.number),
    cancelled: inputs.inPeriod
      .filter((r) => r.status === 'cancelled' && r.number)
      .map((r) => ({
        number: r.number ?? '',
        afterFiling: Boolean(filedAt && r.cancelledAt && r.cancelledAt > filedAt),
      })),
    orphanCreditNotes: inputs.orphans.map((r) => r.number ?? ''),
    hsnNetQuantities: hsnNetQuantities(invoices, creditNotes),
  })

  return {
    gstin,
    legalName,
    period,
    filedAt,
    gstr1,
    totals: gstr1Totals(gstr1),
    gstr3b: buildGstr3b(gstr1),
    warnings,
  }
}
