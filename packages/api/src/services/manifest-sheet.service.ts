/** SOURCE OF TRUTH: printManifestSheet
 * WHAT:  the printed pickup manifest for parcels waiting on a courier pickup: one section per
 *        courier pickup, reusing the manifest on file for exactly those shipments (made with the
 *        pickup) or recording a new one, then drawn as one A4 PDF.
 * WHY:   staff hand the pickup executive a signed list of what was collected (Shipments › To be
 *        picked up, "Print manifest"). Our own record, not a courier API call.
 * WHERE: `shipments.manifestSheet` (routers/shipments-print.ts); rules in core manifest-sheet.ts,
 *        drawing in core manifest-pdf.ts.
 */
import {
  findManifestFor,
  groupManifestRows,
  MANIFEST_SHEET_MAX,
  type ManifestSection,
  renderManifestSheet,
  type ShippingRegistry,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { address, customer, order, shipment, shipmentManifest, shipmentPickup } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm'
import { storeName } from './shipments-operations.service'

export type ManifestSheetInput = {
  /** The ticked rows; left out, every parcel in To be picked up (booked, on a pickup). */
  shipmentIds?: string[] | undefined
  /** Only this courier's parcels (a courier app's page). */
  provider?: string | undefined
}

/** "18 Nov 2026, 3:05 pm" in India time, for the Printed line. */
const printedAt = (now: Date) =>
  now.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

/**
 * The manifest PDF for the chosen parcels (or all of To be picked up). Rows are read with the
 * caller's store in the filter (and under RLS), so another store's ids print nothing; cancelled
 * labels are left out. `created` counts the manifests recorded by this print (0 on a reprint).
 */
export async function printManifestSheet(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  input: ManifestSheetInput,
): Promise<{ pdf: Uint8Array; manifests: number; shipments: number; created: number }> {
  const chosen = input.shipmentIds && input.shipmentIds.length > 0 ? input.shipmentIds : null
  const rows = await tx
    .select({
      id: shipment.id,
      provider: shipment.provider,
      carrier: shipment.carrier,
      pickupId: shipment.pickupId,
      waybill: shipment.waybill,
      weightGrams: shipment.weightGrams,
      paymentMode: shipment.paymentMode,
      codAmountPaise: shipment.codAmountPaise,
      pickupLocationName: shipment.pickupLocationName,
      orderNumber: order.number,
      orderPaymentMethod: order.paymentMethod,
      orderTotalPaise: order.totalPaise,
      shipToName: sql<string | null>`coalesce(${address.name}, ${customer.name})`,
      city: address.city,
      pincode: address.pincode,
      pickupDate: shipmentPickup.scheduledFor,
      pickupPlace: shipmentPickup.pickupLocationName,
    })
    .from(shipment)
    .innerJoin(order, eq(order.id, shipment.orderId))
    .leftJoin(address, eq(address.id, order.shippingAddressId))
    .leftJoin(customer, eq(customer.id, order.customerId))
    .leftJoin(shipmentPickup, eq(shipmentPickup.id, shipment.pickupId))
    .where(
      and(
        eq(shipment.storeId, storeId),
        chosen
          ? and(inArray(shipment.id, chosen), ne(shipment.status, 'cancelled'))
          : and(eq(shipment.status, 'created'), isNotNull(shipment.pickupId)),
        input.provider ? eq(shipment.provider, input.provider) : undefined,
      ),
    )
    .orderBy(asc(shipmentPickup.scheduledFor), asc(shipment.createdAt))
    .limit(MANIFEST_SHEET_MAX)
  if (rows.length === 0) {
    throw new ORPCError('NOT_FOUND', {
      message: 'No parcels waiting for a pickup to put on a manifest.',
    })
  }

  const manifests = await tx
    .select()
    .from(shipmentManifest)
    .where(eq(shipmentManifest.storeId, storeId))
    .orderBy(desc(shipmentManifest.createdAt))

  const sections: ManifestSection[] = []
  let created = 0
  for (const group of groupManifestRows(rows)) {
    const ids = group.rows.map((r) => r.id)
    let manifest = findManifestFor(manifests, group.provider, ids)
    if (!manifest) {
      const [row] = await tx
        .insert(shipmentManifest)
        .values({ storeId, provider: group.provider, pickupId: group.pickupId, shipmentIds: ids })
        .returning()
      if (!row) throw new Error('could not record the manifest')
      manifests.unshift(row)
      manifest = row
      created += 1
    }
    const first = group.rows[0] as (typeof rows)[number]
    const label = registry.get(group.provider)?.label ?? group.provider
    // An aggregator's booking ("Shiprocket") is collected by its carrier ("Blue Dart").
    const carriers = new Set(group.rows.map((r) => r.carrier?.trim() || null))
    const carrier = carriers.size === 1 ? [...carriers][0] : null
    sections.push({
      manifestId: manifest.id,
      courier: carrier && carrier !== label ? `${label} (${carrier})` : label,
      pickupDate: first.pickupDate,
      pickupPlace: first.pickupPlace ?? first.pickupLocationName,
      lines: group.rows.map((r) => {
        // As booked; an older label without it follows the order's own method.
        const cod = r.paymentMode ? r.paymentMode === 'cod' : r.orderPaymentMethod === 'cod'
        return {
          waybill: r.waybill,
          orderNumber: r.orderNumber,
          shipToName: r.shipToName,
          city: r.city,
          pincode: r.pincode,
          weightGrams: r.weightGrams,
          cod,
          codPaise: cod ? (r.codAmountPaise ?? r.orderTotalPaise) : 0,
        }
      }),
    })
  }

  const pdf = await renderManifestSheet(sections, {
    storeName: await storeName(tx, storeId),
    printedAt: printedAt(new Date()),
  })
  return { pdf, manifests: sections.length, shipments: rows.length, created }
}
