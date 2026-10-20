/** SOURCE OF TRUTH: saveShipmentDocuments
 * WHAT:  turns the PDFs a courier hands back at booking (DHL Express and FedEx: label and
 *        commercial invoice as base64) into one printable file in the store's storage, whose
 *        address becomes the shipment's `labelUrl`.
 * WHY:   every other courier answers with a link, and the admin opens `labelUrl` as one. One
 *        file keeps "Print label" a single click for an export too: label first, then the
 *        invoice copies customs wants with the parcel.
 * WHERE: `createShipmentForOrder` (shipments.ts), only when the result carries `documents`.
 */
import { randomBytes } from 'node:crypto'
import { settingsSecret } from '@commerce/config'
import type { ShipmentDocument } from '@commerce/shipping'
import type { StorageProvider } from '@commerce/storage'
import { PDFDocument } from 'pdf-lib'
import type { StoreContext } from '../context'
import { storageForStore } from '../media/settings'
import { registriesForStore } from '../plugins/registries'

const ORDER: Record<ShipmentDocument['kind'], number> = {
  label: 0,
  commercial_invoice: 1,
  other: 2,
}

/** Every page of every document, label first, as one PDF. A document that is not a PDF is skipped. */
async function joinShipmentPdfs(documents: ShipmentDocument[]): Promise<Uint8Array | null> {
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
  return out.save()
}

/**
 * Store the courier's documents as one PDF and return its address, or null when there was
 * nothing printable. The key carries random bytes: the label holds a home address, and the
 * address is shared only with whoever can open the shipment, as couriers' own label links are.
 */
export async function saveShipmentDocuments(
  ctx: StoreContext,
  documents: ShipmentDocument[],
  storage?: StorageProvider,
): Promise<string | null> {
  const pdf = await joinShipmentPdfs(documents)
  if (!pdf) return null
  const target =
    storage ??
    (await storageForStore(
      ctx.tx,
      ctx.storeId,
      (
        await registriesForStore(ctx.tx, ctx.storeId)
      ).storage,
      settingsSecret(),
    ))
  const key = `stores/${ctx.storeId}/shipping-labels/${randomBytes(16).toString('hex')}.pdf`
  await target.put({ key, body: pdf, contentType: 'application/pdf' })
  return target.publicUrl(key)
}
