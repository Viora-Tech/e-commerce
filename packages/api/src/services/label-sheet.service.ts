/** SOURCE OF TRUTH: printLabelSheet
 * WHAT:  a batch's shipping labels as one PDF in the merchant's paper (4 × 6 thermal, A4
 *        four-up, or each courier's own size), with the labels that could not be printed named.
 * WHY:   after bulk booking, "Print 10 labels" opened ten courier tabs in ten sizes. One file is
 *        one print dialog.
 * WHERE: `shipments.labelSheet` (routers/shipments.ts), called by the bulk result's Print card
 *        and Shipments › Booked's selection bar.
 */
import {
  collectLabelFiles,
  isKeyedLabelUrl,
  type LabelRow,
  type LabelSheetFormat,
  type LabelSheetSkip,
  mergeLabelSheet,
  type ShippingRegistry,
  shippingLabelReader,
  shippingProviderById,
  storedLabelUrl,
} from '@commerce/core'
import { readCapped, safeFetch } from '@commerce/core/safe-fetch'
import type { StoreTx } from '@commerce/db'
import { order, shipment } from '@commerce/db'
import { and, eq, inArray } from 'drizzle-orm'
import { loadShippingSettings } from './shipping.service'

/** One courier label's file at most (a label PDF is tens of KB). */
const LABEL_MAX_BYTES = 10 * 1024 * 1024
const LABEL_FETCH_TIMEOUT_MS = 15_000
/** A courier's public label link (Shiprocket, Xpressbees…), fetched with the SSRF guard. */
async function fetchPublicLabel(url: string): Promise<Uint8Array | null> {
  const res = await safeFetch(url, { timeoutMs: LABEL_FETCH_TIMEOUT_MS })
  if (!res.ok) {
    await res.body?.cancel()
    throw new Error(`Label link answered ${res.status}`)
  }
  const bytes = await readCapped(res, LABEL_MAX_BYTES)
  if (!bytes) throw new Error('Label file too large')
  return bytes
}

/**
 * The batch's labels as one PDF. Shipments are read with the caller's store in the filter (and
 * under RLS), so another store's id is skipped as `not_found`. Each label comes the way the
 * single "Print label" gets it: the copy in the store's private storage, else the courier's own
 * behind its API key (`getLabel`), else the courier's public link. `pdf` is null when none of
 * them could be printed.
 */
export async function printLabelSheet(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  ids: string[],
  format: LabelSheetFormat,
): Promise<{ pdf: Uint8Array | null; printed: number; skipped: LabelSheetSkip[] }> {
  const rows = await tx
    .select({
      id: shipment.id,
      orderNumber: order.number,
      status: shipment.status,
      provider: shipment.provider,
      waybill: shipment.waybill,
      labelUrl: shipment.labelUrl,
    })
    .from(shipment)
    .leftJoin(order, eq(order.id, shipment.orderId))
    .where(and(eq(shipment.storeId, storeId), inArray(shipment.id, ids)))

  const readStored = await shippingLabelReader({ storeId, tx })
  let settings: Awaited<ReturnType<typeof loadShippingSettings>> | undefined
  const read = async (row: LabelRow): Promise<Uint8Array | null> => {
    const url = row.labelUrl as string
    if (url === storedLabelUrl(row.id) || isKeyedLabelUrl(url)) {
      const stored = await readStored(row.id).catch(() => null)
      if (stored) return stored
      settings ??= await loadShippingSettings(tx, storeId)
      const provider = shippingProviderById(registry, settings, secret, row.provider)
      if (!provider?.getLabel) return null
      return (await provider.getLabel(row.waybill)).body
    }
    return fetchPublicLabel(url)
  }

  const { files, skipped } = await collectLabelFiles(ids, rows, read)
  const { pdf, unreadable } = await mergeLabelSheet(files, format)
  const bad = new Set(unreadable)
  const byId = new Map(rows.map((r) => [r.id, r]))
  for (const id of unreadable) {
    skipped.push({
      shipmentId: id,
      orderNumber: byId.get(id)?.orderNumber ?? null,
      reason: 'unreadable',
    })
  }
  return { pdf, printed: files.filter((f) => !bad.has(f.id)).length, skipped }
}
