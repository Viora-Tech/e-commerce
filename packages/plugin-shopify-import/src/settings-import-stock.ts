/**
 * Store settings › purchase orders and transfers: the writes (`settings-plan-stock.ts` plans
 * them). Each goes through the same services the admin uses, so numbering, line checks and
 * landed cost are ours; only Shopify's status is then set, without moving on-hand stock (it
 * came over with the products). What is still on the way becomes incoming: an ordered purchase
 * order through `markOrdered`, a shipped transfer at its destination.
 */
import {
  adjustIncoming,
  cancelPurchaseOrder,
  closePurchaseOrder,
  savePurchaseOrder,
  saveSupplier,
  saveTransfer,
} from '@commerce/core'
import { purchaseOrder, type StoreTx, supplier, transfer } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import { findMapping, saveMapping } from './runtime'
import { ImportError } from './service'
import { SETTINGS_MAPPINGS } from './settings-plan'
import type { PurchaseOrderWrite, StockLocationRef, TransferWrite } from './settings-plan-stock'

/** Our location: matched when planned, or made by the Locations part earlier in this import. */
async function locationOf(tx: StoreTx, ref: StockLocationRef): Promise<string> {
  const id = ref.id ?? (await findMapping(tx, SETTINGS_MAPPINGS.locations, ref.sourceId))
  if (!id) throw new ImportError('A location of this record was not brought over')
  return id
}

/** The supplier with this name (one record per name, audit #76), made when there is none. */
async function supplierOf(
  tx: StoreTx,
  storeId: string,
  s: PurchaseOrderWrite['supplier'],
): Promise<string> {
  if (s.id) return s.id
  const [found] = await tx
    .select({ id: supplier.id })
    .from(supplier)
    .where(sql`lower(trim(${supplier.name})) = ${s.name.trim().toLowerCase()}`)
  if (found) return found.id
  return saveSupplier(tx, storeId, { name: s.name, country: 'IN', currency: 'INR' })
}

export async function importPurchaseOrder(
  tx: StoreTx,
  storeId: string,
  w: PurchaseOrderWrite,
): Promise<void> {
  const sent = w.status === 'ordered' || w.status === 'closed'
  const id = await savePurchaseOrder(tx, storeId, {
    supplierId: await supplierOf(tx, storeId, w.supplier),
    supplierName: w.supplier.name,
    name: w.name,
    locationId: await locationOf(tx, w.location),
    currency: w.currency,
    fxRate: '1',
    note: `Imported from Shopify (${w.name})`,
    lines: w.lines,
    markOrdered: sent,
  })
  if (sent && w.orderedAt) {
    await tx
      .update(purchaseOrder)
      .set({ orderedAt: new Date(w.orderedAt) })
      .where(eq(purchaseOrder.id, id))
  }
  // Archived on Shopify: closed once ordered (nothing more incoming), else called off.
  if (w.status === 'closed') await closePurchaseOrder(tx, storeId, id)
  if (w.status === 'cancelled') await cancelPurchaseOrder(tx, storeId, id)
  await saveMapping(tx, storeId, SETTINGS_MAPPINGS.purchaseOrders, w.sourceId, id)
}

export async function importTransfer(
  tx: StoreTx,
  storeId: string,
  w: TransferWrite,
): Promise<void> {
  const toLocationId = await locationOf(tx, w.to)
  const id = await saveTransfer(tx, storeId, {
    fromLocationId: await locationOf(tx, w.from),
    toLocationId,
    note: w.note,
    lines: w.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
  })
  if (w.status !== 'draft') {
    // Not `shipTransfer`/`receiveTransfer`: Shopify already moved the stock these record.
    const at = w.shippedAt ? new Date(w.shippedAt) : new Date()
    await tx
      .update(transfer)
      .set({
        status: w.status,
        shippedAt: at,
        ...(w.status === 'received' ? { receivedAt: at } : {}),
      })
      .where(eq(transfer.id, id))
    if (w.status === 'in_transit') {
      for (const l of w.lines) {
        await adjustIncoming(tx, storeId, l.variantId, toLocationId, l.quantity)
      }
    }
  }
  await saveMapping(tx, storeId, SETTINGS_MAPPINGS.transfers, w.sourceId, id)
}
