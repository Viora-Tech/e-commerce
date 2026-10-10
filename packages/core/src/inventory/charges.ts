/** SOURCE OF TRUTH: purchase charges (freight, customs, clearing, bank) on a purchase order or
 * an inbound shipment — WHAT: add, edit and remove a charge, with the defaults by kind
 * (split method, recoverable) and the checks a split must pass, then recost the group so
 * landed costs and stock already received follow. WHY: charges are the inputs of landed
 * cost; every change to one goes through here so nothing is split onto another store's
 * lines and a late bill revalues what is still on the shelf.
 */
import { inboundShipment, newId, purchaseCharge, purchaseOrder, type StoreTx } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { lockCostingGroup, reachableLineIds, recost } from './costing'
import { convertToPaise, defaultRecoverable, defaultSplitMethod } from './landed-cost'
import { InventoryError } from './levels'
import type { PurchaseChargeInput, PurchaseChargeUpdate } from './schemas'

type Owner = { purchaseOrderId: string } | { inboundShipmentId: string }

/** The charge's owner, read under RLS: a pasted id from another store is "not found". */
async function assertOwner(tx: StoreTx, storeId: string, owner: Owner) {
  if ('purchaseOrderId' in owner) {
    const [po] = await tx
      .select({ status: purchaseOrder.status })
      .from(purchaseOrder)
      .where(eq(purchaseOrder.id, owner.purchaseOrderId))
    if (!po) throw new InventoryError('PO_NOT_FOUND', 'Purchase order not found', { storeId })
    if (po.status === 'cancelled') {
      throw new InventoryError('PO_CANCELLED', 'This purchase order is cancelled', { storeId })
    }
    return
  }
  const [s] = await tx
    .select({ id: inboundShipment.id })
    .from(inboundShipment)
    .where(eq(inboundShipment.id, owner.inboundShipmentId))
  if (!s) throw new InventoryError('SHIPMENT_NOT_FOUND', 'Inbound shipment not found', { storeId })
}

/** Defaults by kind, INR at rate 1, and split lines that this charge can actually reach. */
async function chargeFields(
  tx: StoreTx,
  storeId: string,
  owner: Owner,
  input: Omit<PurchaseChargeUpdate, 'id'>,
) {
  const fxRate = input.currency === 'INR' ? '1' : input.fxRate
  const splitMethod = input.splitMethod ?? defaultSplitMethod(input.kind)
  const reach = await reachableLineIds(tx, owner)
  const splitLineIds = splitMethod === 'specific_lines' ? (input.splitLineIds ?? []) : null
  const manualSplits = splitMethod === 'manual' ? (input.manualSplits ?? []) : null
  const named = [...(splitLineIds ?? []), ...(manualSplits ?? []).map((s) => s.lineId)]
  if (named.some((id) => !reach.has(id))) {
    throw new InventoryError('CHARGE_LINE_NOT_FOUND', 'One of the lines is not on this order', {
      storeId,
    })
  }
  if (manualSplits) {
    const expected = convertToPaise(input.amountMinor, input.currency, fxRate)
    const got = manualSplits.reduce((n, s) => n + s.amountPaise, 0)
    if (got !== expected) {
      throw new InventoryError(
        'CHARGE_SPLIT_MISMATCH',
        'The amounts per line must add up to the charge',
        { storeId },
      )
    }
  }
  return {
    kind: input.kind,
    amountMinor: input.amountMinor,
    currency: input.currency,
    fxRate,
    gstPaise: input.gstPaise,
    recoverable: input.recoverable ?? defaultRecoverable(input.kind),
    splitMethod,
    splitLineIds,
    manualSplits,
    payee: input.payee || null,
    note: input.note || null,
    incurredAt: input.incurredAt ?? null,
    updatedAt: new Date(),
  }
}

export async function addPurchaseCharge(
  tx: StoreTx,
  storeId: string,
  input: PurchaseChargeInput,
): Promise<string> {
  const owner: Owner = input.purchaseOrderId
    ? { purchaseOrderId: input.purchaseOrderId }
    : { inboundShipmentId: input.inboundShipmentId as string }
  await assertOwner(tx, storeId, owner)
  const group = await lockCostingGroup(tx, storeId, owner)
  const id = newId()
  await tx.insert(purchaseCharge).values({
    id,
    storeId,
    purchaseOrderId: 'purchaseOrderId' in owner ? owner.purchaseOrderId : null,
    inboundShipmentId: 'inboundShipmentId' in owner ? owner.inboundShipmentId : null,
    ...(await chargeFields(tx, storeId, owner, input)),
  })
  await recost(tx, storeId, group)
  return id
}

async function loadCharge(tx: StoreTx, storeId: string, id: string) {
  const [c] = await tx.select().from(purchaseCharge).where(eq(purchaseCharge.id, id))
  if (!c) throw new InventoryError('CHARGE_NOT_FOUND', 'Charge not found', { storeId })
  const owner: Owner = c.purchaseOrderId
    ? { purchaseOrderId: c.purchaseOrderId }
    : { inboundShipmentId: c.inboundShipmentId as string }
  return { charge: c, owner }
}

/** Edit a charge in place. On received stock the difference revalues what is still on hand. */
export async function updatePurchaseCharge(
  tx: StoreTx,
  storeId: string,
  input: PurchaseChargeUpdate,
): Promise<void> {
  const { owner } = await loadCharge(tx, storeId, input.id)
  await assertOwner(tx, storeId, owner)
  const group = await lockCostingGroup(tx, storeId, owner)
  await tx
    .update(purchaseCharge)
    .set(await chargeFields(tx, storeId, owner, input))
    .where(eq(purchaseCharge.id, input.id))
  await recost(tx, storeId, group)
}

export async function removePurchaseCharge(
  tx: StoreTx,
  storeId: string,
  id: string,
): Promise<void> {
  const { owner } = await loadCharge(tx, storeId, id)
  const group = await lockCostingGroup(tx, storeId, owner)
  await tx.delete(purchaseCharge).where(eq(purchaseCharge.id, id))
  await recost(tx, storeId, group)
}
