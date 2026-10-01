/** SOURCE OF TRUTH: orderIssuer, sellerFor, gstToken, sameRegistration
 * WHAT:  Which GST registration (GSTIN) issues an order's documents, the seller block it
 *        prints, and the text `{GST}` puts in a document number.
 * WHY:   Numbering (rule 46(b)), returns and the supplier on an invoice are all per GSTIN. An
 *        order is billed from the GSTIN snapshotted at checkout (`order.gst_registration_id`,
 *        @commerce/core tax/origin.ts), else the store's default. A store with no
 *        registration keeps printing the app's own seller block, as before phase 2, and so
 *        does a registration whose GSTIN is the one in that block (single-GSTIN stores print
 *        exactly what they printed before).
 * WHERE: issue.ts, queue.ts, vouchers.ts (issuing); periods.ts and reports.ts (scoping).
 */
import { documentRegistration, type SellerRegistration } from '@commerce/core'
import { order, type StoreTx } from '@commerce/db'
import { type InvoiceSettings, type Party, placeOf, sellerParty } from '@commerce/invoices'
import { eq, isNull, type SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

/** The registration issuing a document; null in a store without any GST registration. */
export type Issuer = SellerRegistration | null

/**
 * The registration an order's documents are issued under: `preferredId` (a queued draft's own)
 * while it can still issue, else the order's checkout GSTIN, else the store's default.
 */
export async function orderIssuer(
  tx: StoreTx,
  orderId: string,
  preferredId?: string | null,
): Promise<Issuer> {
  if (preferredId) {
    const preferred = await documentRegistration(tx, preferredId)
    if (preferred?.id === preferredId) return preferred
  }
  const [o] = await tx
    .select({ gstRegistrationId: order.gstRegistrationId })
    .from(order)
    .where(eq(order.id, orderId))
  return documentRegistration(tx, o?.gstRegistrationId ?? null)
}

/** The registration that issued a stored document (cancelled or not): what its corrections cite. */
export async function documentIssuer(
  tx: StoreTx,
  gstRegistrationId: string | null,
): Promise<Issuer> {
  if (!gstRegistrationId) return null
  return documentRegistration(tx, gstRegistrationId, { allowCancelled: true })
}

/** The supplier block a document prints for its issuer. */
export function sellerFor(settings: InvoiceSettings, issuer: Issuer, storeName: string): Party {
  if (!issuer || settings.seller.gstin === issuer.gstin) {
    return sellerParty(settings.seller, storeName)
  }
  const a = issuer.address
  return sellerParty(
    {
      legalName: issuer.legalName,
      gstin: issuer.gstin,
      stateCode: issuer.stateCode ?? '',
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      pincode: a.pincode,
      email: issuer.email ?? settings.seller.email,
      phone: issuer.phone ?? settings.seller.phone,
    },
    storeName,
  )
}

/**
 * What `{GST}` prints: the registration's invoice prefix (Settings › Business and GST), else
 * its state letters (`HR`), else the seller block's state; blank when nothing is known.
 */
export function gstToken(issuer: Issuer, settings: InvoiceSettings): string {
  return (
    issuer?.invoicePrefix ||
    issuer?.stateCode ||
    placeOf(settings.seller.stateCode)?.code ||
    ''
  ).toUpperCase()
}

/** Rows of one GSTIN; null is the store without a registration. */
export function sameRegistration(column: PgColumn, id: string | null): SQL {
  return id ? eq(column, id) : isNull(column)
}
