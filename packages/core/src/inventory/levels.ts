import {
  inventoryAdjustment,
  inventoryLevel,
  location,
  newId,
  type StoreTx,
  variant,
} from '@commerce/db'
import { and, asc, eq, sql } from 'drizzle-orm'
import type { InventoryReason } from '../catalog/schemas'
import { CommerceError } from '../errors'
import type { LocationInput } from './schemas'
import { NegativeStockError, nextOnHand } from './stock'

export class InventoryError extends CommerceError {}

/** The store's default location (the one that sells online), created on first use. */
export async function defaultLocationId(tx: StoreTx, storeId: string): Promise<string> {
  const rows = await tx.execute<{ id: string }>(
    sql`select ensure_default_location(${storeId}) as id`,
  )
  const id = rows[0]?.id
  if (!id) throw new InventoryError('NO_LOCATION', 'Could not resolve a location', { storeId })
  return id
}

export async function listLocations(tx: StoreTx, storeId: string) {
  await defaultLocationId(tx, storeId)
  return tx
    .select()
    .from(location)
    .where(eq(location.active, true))
    .orderBy(sql`${location.isDefault} desc`, asc(location.name))
}

/** A second (or later) location. It holds stock but does not sell online. */
export async function createLocation(tx: StoreTx, storeId: string, input: LocationInput) {
  await defaultLocationId(tx, storeId)
  const [row] = await tx
    .insert(location)
    .values({
      id: newId(),
      storeId,
      name: input.name,
      line1: input.line1 || null,
      line2: input.line2 || null,
      city: input.city || null,
      stateCode: input.stateCode || null,
      pincode: input.pincode || null,
      phone: input.phone || null,
      isDefault: false,
      fulfilsOnlineOrders: false,
    })
    .returning()
  if (!row) throw new InventoryError('LOCATION_CREATE', 'Location was not created', { storeId })
  return row
}

async function levelFor(tx: StoreTx, storeId: string, variantId: string, locationId: string) {
  const [row] = await tx
    .select()
    .from(inventoryLevel)
    .where(and(eq(inventoryLevel.variantId, variantId), eq(inventoryLevel.locationId, locationId)))
    .for('update')
  if (row) return row
  const [created] = await tx
    .insert(inventoryLevel)
    .values({ id: newId(), storeId, variantId, locationId, onHand: 0 })
    .onConflictDoNothing()
    .returning()
  if (created) return created
  const [again] = await tx
    .select()
    .from(inventoryLevel)
    .where(and(eq(inventoryLevel.variantId, variantId), eq(inventoryLevel.locationId, locationId)))
    .for('update')
  if (!again) throw new InventoryError('LEVEL_MISSING', 'Inventory row vanished', { storeId })
  return again
}

export type AdjustStockInput = {
  storeId: string
  variantId: string
  /** Defaults to the store's default location. */
  locationId?: string | undefined
  delta: number
  reason: InventoryReason
  note?: string | undefined
}

/**
 * Change on-hand stock at one location and log why. Tracked variants never go
 * below zero; variants that sell regardless of stock may.
 */
export async function adjustStock(tx: StoreTx, input: AdjustStockInput): Promise<number> {
  const locationId = input.locationId ?? (await defaultLocationId(tx, input.storeId))
  const level = await levelFor(tx, input.storeId, input.variantId, locationId)
  if (input.delta === 0) return level.onHand
  const [v] = await tx
    .select({ trackInventory: variant.trackInventory })
    .from(variant)
    .where(eq(variant.id, input.variantId))
  let next: number
  try {
    next = nextOnHand(level.onHand, input.delta, v ? !v.trackInventory : false)
  } catch (err) {
    if (err instanceof NegativeStockError) {
      throw new InventoryError('NEGATIVE_STOCK', 'Stock cannot go below zero', {
        storeId: input.storeId,
        cause: err,
      })
    }
    throw err
  }
  await tx.update(inventoryLevel).set({ onHand: next }).where(eq(inventoryLevel.id, level.id))
  await tx.insert(inventoryAdjustment).values({
    id: newId(),
    storeId: input.storeId,
    variantId: input.variantId,
    locationId,
    delta: input.delta,
    reason: input.reason,
    note: input.note ?? null,
  })
  return next
}

/** Set on-hand to an absolute count, logged as the difference. */
export async function setStock(
  tx: StoreTx,
  input: Omit<AdjustStockInput, 'delta'> & { onHand: number },
): Promise<number> {
  const locationId = input.locationId ?? (await defaultLocationId(tx, input.storeId))
  const level = await levelFor(tx, input.storeId, input.variantId, locationId)
  return adjustStock(tx, { ...input, locationId, delta: input.onHand - level.onHand })
}

/** Move the incoming count (purchase orders, transfers). Never below zero. */
export async function adjustIncoming(
  tx: StoreTx,
  storeId: string,
  variantId: string,
  locationId: string,
  delta: number,
): Promise<void> {
  if (delta === 0) return
  const level = await levelFor(tx, storeId, variantId, locationId)
  await tx
    .update(inventoryLevel)
    .set({ incoming: sql`greatest(0, ${inventoryLevel.incoming} + ${delta})` })
    .where(eq(inventoryLevel.id, level.id))
}
