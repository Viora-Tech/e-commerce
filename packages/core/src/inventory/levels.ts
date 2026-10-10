import {
  inventoryAdjustment,
  inventoryLevel,
  location,
  newId,
  type StoreTx,
  variant,
} from '@commerce/db'
import { and, asc, eq, inArray, type SQL, sql } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { InventoryReason } from '../catalog/schemas'
import { CommerceError } from '../errors'
import { insertOutboxEvent } from '../outbox/write'
import type { LocationInput } from './schemas'
import { availableOf, NegativeStockError, nextOnHand } from './stock'

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

/**
 * Throws unless every location belongs to this store. Foreign keys are checked
 * without row-level security, so a pasted id from another store would pass them.
 */
export async function assertLocations(tx: StoreTx, storeId: string, ids: string[]) {
  const wanted = new Set(ids)
  const found = await tx
    .select({ id: location.id })
    .from(location)
    .where(inArray(location.id, [...wanted]))
  if (found.length !== wanted.size) {
    throw new InventoryError('LOCATION_NOT_FOUND', 'Location not found', { storeId })
  }
}

/** Throws unless every variant belongs to this store (see `assertLocations`). */
export async function assertVariants(tx: StoreTx, storeId: string, ids: string[]) {
  const wanted = new Set(ids)
  if (wanted.size === 0) return
  const found = await tx
    .select({ id: variant.id })
    .from(variant)
    .where(inArray(variant.id, [...wanted]))
  if (found.length !== wanted.size) {
    throw new InventoryError('VARIANT_NOT_FOUND', 'One of the products was not found', { storeId })
  }
}

/** The next per-store document number. The advisory lock makes two creates at once queue. */
export async function nextDocumentNumber(
  tx: StoreTx,
  storeId: string,
  kind: 'purchase_order' | 'transfer' | 'inbound_shipment',
  max: SQL<number>,
  from: PgTable,
): Promise<number> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${kind}_number:${storeId}`}, 0))`,
  )
  const [row] = await tx
    .select({ n: sql<number>`coalesce(${max}, 0) + 1`.mapWith(Number) })
    .from(from)
  return row?.n ?? 1
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
  // Available (on-hand minus reserved) crossed from nothing to something: this
  // is the moment a sold-out variant becomes buyable again. Written in the
  // same transaction as the stock change, so a rollback rolls the event back
  // with it (the outbox pattern) — the back-in-stock app picks it up from here.
  const wasAvailable = availableOf({ onHand: level.onHand, reserved: level.reserved })
  const isAvailable = availableOf({ onHand: next, reserved: level.reserved })
  if (wasAvailable <= 0 && isAvailable > 0) {
    await insertOutboxEvent(tx, input.storeId, 'inventory.restocked', {
      variantId: input.variantId,
      locationId,
    })
  }
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
