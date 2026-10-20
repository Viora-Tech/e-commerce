/** SOURCE OF TRUTH: storeShippingLabel, readShippingLabel — WHAT: courier label PDFs kept in the store's private storage / WHY: Blue Dart and DTDC hand back the file, not a link */
import type { ShippingLabelDocument } from '@commerce/shipping'
import type { StoreContext } from '../context'
import { documentStorage } from '../inventory/documents'

/**
 * Labels a courier handed back as a PDF (`CreateShipmentResult.labelDocument`: Blue Dart, DTDC)
 * rather than as a public link. The file goes to the store's private storage, and the shipment's
 * `labelUrl` points at the admin's own download route, which checks the member's session and
 * store before streaming it (apps/admin/src/app/api/shipments/[id]/label/route.ts).
 */

const labelKey = (storeId: string, shipmentId: string) =>
  `stores/${storeId}/private/shipping-labels/${shipmentId}.pdf`

/** Where the admin downloads a stored label. Relative: it is only ever opened from the admin. */
const storedLabelUrl = (shipmentId: string) => `/api/shipments/${shipmentId}/label`

/**
 * Keep the label; the URL to put on the shipment, or null when storage failed. Never throws:
 * the courier has already booked the parcel, so a storage hiccup must not roll the shipment
 * back (the waybill would exist at the courier with no row here).
 */
export async function storeShippingLabel(
  ctx: StoreContext,
  shipmentId: string,
  label: ShippingLabelDocument,
): Promise<string | null> {
  try {
    const storage = await documentStorage(ctx.tx, ctx.storeId)
    await storage.put({
      key: labelKey(ctx.storeId, shipmentId),
      body: label.body,
      contentType: label.contentType,
    })
    return storedLabelUrl(shipmentId)
  } catch {
    return null
  }
}

/** The stored label's bytes, or null when this shipment has none on file. */
export async function readShippingLabel(
  ctx: StoreContext,
  shipmentId: string,
): Promise<Uint8Array | null> {
  const storage = await documentStorage(ctx.tx, ctx.storeId)
  return storage.get(labelKey(ctx.storeId, shipmentId))
}
