/** SOURCE OF TRUTH: shipmentDocumentsAsLabel
 * WHAT:  turns the PDFs a courier hands back at booking (DHL Express and FedEx: label and
 *        commercial invoice as base64) into one printable label document.
 * WHY:   one file keeps "Print label" a single click for an export too: label first, then the
 *        invoice copies customs wants with the parcel. The result is stored like any other
 *        courier-supplied label (`storeShippingLabel` in label-store.ts: private storage, opened
 *        through the admin's own download route).
 * WHERE: `createShipmentForOrder` (shipments.ts), only when the result carries `documents`.
 */
import type { ShipmentDocument, ShippingLabelDocument } from '@commerce/shipping'
import { PDFDocument } from 'pdf-lib'

const ORDER: Record<ShipmentDocument['kind'], number> = {
  label: 0,
  commercial_invoice: 1,
  other: 2,
}

/**
 * Every page of every document, label first, as one PDF; null when nothing was printable.
 * A document that is not a PDF is skipped rather than losing the others.
 */
export async function shipmentDocumentsAsLabel(
  documents: ShipmentDocument[],
): Promise<ShippingLabelDocument | null> {
  const sorted = [...documents].sort((a, b) => ORDER[a.kind] - ORDER[b.kind])
  const out = await PDFDocument.create()
  for (const doc of sorted) {
    try {
      const src = await PDFDocument.load(Buffer.from(doc.pdfBase64, 'base64'))
      const pages = await out.copyPages(src, src.getPageIndices())
      for (const page of pages) out.addPage(page)
    } catch {
      // A courier document that does not parse is left out rather than losing the others.
    }
  }
  if (out.getPageCount() === 0) return null
  return { contentType: 'application/pdf', body: await out.save() }
}
