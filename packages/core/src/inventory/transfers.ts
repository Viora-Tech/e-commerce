import { location, newId, type StoreTx, transfer, transferLine } from '@commerce/db'
import { asc, eq, inArray, sql } from 'drizzle-orm'
import { adjustIncoming, adjustStock, InventoryError } from './levels'
import type { TransferInput } from './schemas'

async function nextNumber(tx: StoreTx): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`coalesce(max(${transfer.number}), 0) + 1`.mapWith(Number) })
    .from(transfer)
  return row?.n ?? 1
}

async function load(tx: StoreTx, storeId: string, id: string) {
  const [t] = await tx.select().from(transfer).where(eq(transfer.id, id)).for('update')
  if (!t) throw new InventoryError('TRANSFER_NOT_FOUND', 'Transfer not found', { storeId })
  const lines = await tx
    .select()
    .from(transferLine)
    .where(eq(transferLine.transferId, id))
    .orderBy(asc(transferLine.id))
  return { t, lines }
}

async function assertLocations(tx: StoreTx, storeId: string, ids: string[]) {
  const found = await tx.select({ id: location.id }).from(location).where(inArray(location.id, ids))
  if (found.length !== new Set(ids).size) {
    throw new InventoryError('LOCATION_NOT_FOUND', 'Location not found', { storeId })
  }
}

/** Create or edit a draft transfer. */
export async function saveTransfer(
  tx: StoreTx,
  storeId: string,
  input: TransferInput,
): Promise<string> {
  await assertLocations(tx, storeId, [input.fromLocationId, input.toLocationId])
  const fields = {
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
    note: input.note || null,
  }
  let id = input.id
  if (!id) {
    id = newId()
    await tx
      .insert(transfer)
      .values({ id, storeId, number: await nextNumber(tx), status: 'draft', ...fields })
  } else {
    const { t } = await load(tx, storeId, id)
    if (t.status !== 'draft') {
      throw new InventoryError('TRANSFER_LOCKED', 'Only a draft transfer can be edited', {
        storeId,
      })
    }
    await tx.update(transfer).set(fields).where(eq(transfer.id, id))
    await tx.delete(transferLine).where(eq(transferLine.transferId, id))
  }
  const transferId = id
  await tx
    .insert(transferLine)
    .values(input.lines.map((l) => ({ id: newId(), storeId, transferId, ...l })))
  return transferId
}

/**
 * Ship: stock leaves the origin now (it is physically on the move) and shows as
 * incoming at the destination until received. Fails if the origin is short.
 */
export async function shipTransfer(tx: StoreTx, storeId: string, id: string): Promise<void> {
  const { t, lines } = await load(tx, storeId, id)
  if (t.status !== 'draft') {
    throw new InventoryError('TRANSFER_NOT_DRAFT', 'This transfer has already shipped', {
      storeId,
    })
  }
  for (const line of lines) {
    await adjustStock(tx, {
      storeId,
      variantId: line.variantId,
      locationId: t.fromLocationId,
      delta: -line.quantity,
      reason: 'transfer',
      note: `Transfer #${t.number} out`,
    })
    await adjustIncoming(tx, storeId, line.variantId, t.toLocationId, line.quantity)
  }
  await tx
    .update(transfer)
    .set({ status: 'in_transit', shippedAt: new Date() })
    .where(eq(transfer.id, t.id))
}

/** Receive at the destination: incoming becomes on-hand there. */
export async function receiveTransfer(tx: StoreTx, storeId: string, id: string): Promise<void> {
  const { t, lines } = await load(tx, storeId, id)
  if (t.status !== 'in_transit') {
    throw new InventoryError('TRANSFER_NOT_IN_TRANSIT', 'Only a shipped transfer can be received', {
      storeId,
    })
  }
  for (const line of lines) {
    await adjustIncoming(tx, storeId, line.variantId, t.toLocationId, -line.quantity)
    await adjustStock(tx, {
      storeId,
      variantId: line.variantId,
      locationId: t.toLocationId,
      delta: line.quantity,
      reason: 'transfer',
      note: `Transfer #${t.number} in`,
    })
  }
  await tx
    .update(transfer)
    .set({ status: 'received', receivedAt: new Date() })
    .where(eq(transfer.id, t.id))
}

export async function deleteTransfer(tx: StoreTx, storeId: string, id: string): Promise<void> {
  const { t } = await load(tx, storeId, id)
  if (t.status !== 'draft') {
    throw new InventoryError('TRANSFER_NOT_DRAFT', 'Only a draft transfer can be deleted', {
      storeId,
    })
  }
  await tx.delete(transfer).where(eq(transfer.id, t.id))
}
