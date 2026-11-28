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
  labelOnDemand,
  mergeLabelSheet,
  type ShippingRegistry,
  shipmentLabelUrl,
  shippingLabelReader,
  shippingProviderById,
  storedLabelUrl,
} from '@commerce/core'
import { catalogueApp } from '@commerce/core/app-catalogue'
import type { StoreTx } from '@commerce/db'
import { order, shipment } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { and, eq, inArray } from 'drizzle-orm'
import { fetchPublicLabel } from './label-link'
import { loadShippingSettings } from './shipping.service'

/** A courier's words with any link taken out (a label link can carry a signed token). */
const stripUrls = (text: string) => text.replace(/https?:\/\/\S+/gi, '[link]').slice(0, 300)

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
  const found = await tx
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
  /* Read-time, as the single Print label sees it: a courier that hands its label over on demand
     (RapidShyp, often saved with no link) goes to `getLabel` instead of being skipped. */
  const rows = found.map((r) => ({
    ...r,
    labelUrl: shipmentLabelUrl(r),
    // The courier's name for the skip list; an app no longer connected still reads by name.
    courier: registry.get(r.provider)?.label ?? catalogueApp(r.provider)?.name ?? r.provider,
  }))
  const savedLink = new Map(found.map((r) => [r.id, r.labelUrl]))

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
      const saved = savedLink.get(row.id)
      // An on-demand courier's own public link, kept from booking, is the fallback.
      const fallback = saved?.startsWith('https://') && !isKeyedLabelUrl(saved) ? saved : null
      try {
        return (await provider.getLabel(row.waybill)).body
      } catch (error) {
        if (fallback && labelOnDemand(row.provider)) return fetchPublicLabel(fallback)
        throw error
      }
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
      courier: byId.get(id)?.courier,
    })
  }
  /* Why each label was left out, for support: courier, shipment id, reason and the courier's
     words. No label links (they can carry a courier's signed token) and no customer data. */
  for (const s of skipped) {
    logger.warn('label sheet skipped a label', {
      storeId,
      courier: s.courier ?? null,
      shipmentId: s.shipmentId,
      reason: s.reason,
      message: s.detail ? stripUrls(s.detail) : null,
    })
  }
  return { pdf, printed: files.filter((f) => !bad.has(f.id)).length, skipped }
}
