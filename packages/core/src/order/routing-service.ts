/** SOURCE OF TRUTH: routeAndReserve, loadRoutingLocations
 * WHAT:  Route an order's goods to warehouses (order/routing.ts) and hold the stock there.
 * WHY:   Routing reads availability and reservation writes it; both happen under row locks on
 *        the variants' inventory rows, so two checkouts for the last unit queue instead of both
 *        winning. A parcel's units are reserved at its location: within stock normally, past it
 *        for a needs-transfer parcel (the merchant moves stock in) or a pre-order on hold
 *        (within the pre-order limit, counted at that location as before).
 * WHERE: placeOrder's reserveStock step and convertDraft. Their compensation gives back the
 *        returned `reserved` units with `releaseReserved`.
 */
import {
  gstRegistration,
  inventoryLevel,
  location,
  newId,
  type StoreTx,
  store,
  variant,
} from '@commerce/db'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CannotShipToState, OutOfStock } from '../errors'
import { defaultLocationId } from '../inventory/levels'
import { watchStockCrossings } from '../inventory/stock-events'
import { parseShippingSettings } from '../shipping/settings'
import { gstinState } from '../tax/gstin'
import { stateCode } from '../tax/states'
import { type RoutedParcel, type RoutingLocation, routeOrder } from './routing'

export type RouteLineInput = {
  key: string
  variantId: string
  quantity: number
  /** Gift cards are vouchers: never routed, never a parcel. */
  giftCard: boolean
  /** Pre-order rules for the line; null when it may not sell past stock. */
  preorder: { enabled: boolean; limit: number | null } | null
}

/** Units held at one location for the order, to give back if the order is undone. */
export type ReservedUnits = { variantId: string; locationId: string; quantity: number }

type Level = { id: string; variantId: string; locationId: string; onHand: number; reserved: number }

/**
 * Every location that ships online orders, with what it bills under, ready for routing. A store
 * whose merchant switched every location off still sells from its default location.
 */
export async function loadRoutingLocations(
  tx: StoreTx,
  storeId: string,
): Promise<Omit<RoutingLocation, 'available'>[]> {
  const columns = {
    id: location.id,
    stateCode: location.stateCode,
    priority: location.priority,
    isDefault: location.isDefault,
    gstin: gstRegistration.gstin,
    registrationType: gstRegistration.registrationType,
  }
  let rows = await tx
    .select(columns)
    .from(location)
    .leftJoin(
      gstRegistration,
      and(eq(gstRegistration.id, location.gstRegistrationId), isNull(gstRegistration.cancelledAt)),
    )
    .where(and(eq(location.fulfilsOnlineOrders, true), eq(location.active, true)))
    .orderBy(asc(location.priority), asc(location.id))
  if (rows.length === 0) {
    const home = await defaultLocationId(tx, storeId)
    rows = await tx
      .select(columns)
      .from(location)
      .leftJoin(
        gstRegistration,
        and(
          eq(gstRegistration.id, location.gstRegistrationId),
          isNull(gstRegistration.cancelledAt),
        ),
      )
      .where(eq(location.id, home))
  }
  // A location with no GSTIN of its own bills under the default one (tax/origin.ts).
  const [fallback] = await tx
    .select({ gstin: gstRegistration.gstin, registrationType: gstRegistration.registrationType })
    .from(gstRegistration)
    .where(and(eq(gstRegistration.isDefault, true), isNull(gstRegistration.cancelledAt)))
  return rows.map((r) => {
    const gstin = r.gstin ?? fallback?.gstin ?? null
    const type = r.gstin ? r.registrationType : fallback?.registrationType
    return {
      id: r.id,
      stateCode: stateCode(r.stateCode),
      gstStateCode: gstin ? gstinState(gstin) : null,
      priority: r.priority,
      isDefault: r.isDefault,
      composition: type === 'composition',
    }
  })
}

/** Read the inventory rows of these variants at these locations, locked in id order. */
async function readLevels(
  tx: StoreTx,
  variantIds: readonly string[],
  locationIds: readonly string[],
  lock: boolean,
): Promise<Level[]> {
  if (variantIds.length === 0 || locationIds.length === 0) return []
  const query = tx
    .select({
      id: inventoryLevel.id,
      variantId: inventoryLevel.variantId,
      locationId: inventoryLevel.locationId,
      onHand: inventoryLevel.onHand,
      reserved: inventoryLevel.reserved,
    })
    .from(inventoryLevel)
    .where(
      and(
        inArray(inventoryLevel.variantId, [...variantIds]),
        inArray(inventoryLevel.locationId, [...locationIds]),
      ),
    )
    .orderBy(asc(inventoryLevel.id))
  // A preview reads without locking; placing an order locks so checkouts queue.
  const rows = lock ? await query.for('update') : await query
  return rows.flatMap((r) => (r.locationId ? [{ ...r, locationId: r.locationId }] : []))
}

/** Add `quantity` to what a location holds for orders, creating its inventory row if needed. */
async function holdAt(ctx: StoreContext, units: ReservedUnits): Promise<void> {
  await ctx.tx
    .insert(inventoryLevel)
    .values({
      id: newId(),
      storeId: ctx.storeId,
      variantId: units.variantId,
      locationId: units.locationId,
      onHand: 0,
      reserved: units.quantity,
    })
    .onConflictDoUpdate({
      target: [inventoryLevel.variantId, inventoryLevel.locationId],
      set: { reserved: sql`${inventoryLevel.reserved} + ${units.quantity}` },
    })
}

/** Undo `routeAndReserve`: give back what it held. */
export async function releaseReserved(
  ctx: StoreContext,
  reserved: readonly ReservedUnits[],
): Promise<void> {
  for (const r of reserved) {
    await ctx.tx
      .update(inventoryLevel)
      .set({ reserved: sql`greatest(0, ${inventoryLevel.reserved} - ${r.quantity})` })
      .where(
        and(eq(inventoryLevel.variantId, r.variantId), eq(inventoryLevel.locationId, r.locationId)),
      )
  }
}

type RouteInput = { lines: readonly RouteLineInput[]; buyerState: string | null }

/** Load what routing needs and route (order/routing.ts); `lock` holds the stock rows. */
async function planRoute(ctx: StoreContext, input: RouteInput, lock: boolean) {
  const goods = input.lines.filter((l) => !l.giftCard && l.quantity > 0)
  const variantIds = [...new Set(goods.map((l) => l.variantId))]
  const trackedRows = await ctx.tx
    .select({ id: variant.id, trackInventory: variant.trackInventory })
    .from(variant)
    .where(inArray(variant.id, variantIds))
  // A variant that vanished is treated as tracked, so it comes back out of stock.
  const tracked = (id: string) => trackedRows.find((v) => v.id === id)?.trackInventory ?? true
  const [s] = await ctx.tx
    .select({ shipping: store.shipping })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const { maxParcels } = parseShippingSettings(s?.shipping).routing

  const places = await loadRoutingLocations(ctx.tx, ctx.storeId)
  const levels = await readLevels(
    ctx.tx,
    variantIds.filter(tracked),
    places.map((p) => p.id),
    lock,
  )
  const levelAt = (variantId: string, locationId: string) =>
    levels.find((l) => l.variantId === variantId && l.locationId === locationId)
  const buyerState = stateCode(input.buyerState)
  const result = routeOrder({
    lines: goods.map((l) => ({
      key: l.key,
      variantId: l.variantId,
      quantity: l.quantity,
      tracked: tracked(l.variantId),
      preorder: l.preorder?.enabled ?? false,
    })),
    locations: places.map((p) => ({
      ...p,
      available: new Map(
        levels
          .filter((l) => l.locationId === p.id)
          .map((l) => [l.variantId, l.onHand - l.reserved]),
      ),
    })),
    buyerState,
    maxParcels,
  })
  return { goods, tracked, levelAt, result, buyerState }
}

/**
 * Where an order with these lines would ship from, without holding anything: what checkout
 * shows before the order is placed ("Ships in 2 parcels"). Placing it routes again under locks,
 * so stock that moves in between can change the answer.
 */
export async function previewRoute(ctx: StoreContext, input: RouteInput) {
  if (!input.lines.some((l) => !l.giftCard && l.quantity > 0)) {
    return { kind: 'routed' as const, parcels: [] }
  }
  return (await planRoute(ctx, input, false)).result
}

/**
 * Route the order's goods and hold their stock. Throws OutOfStock when the store cannot cover a
 * line, and CannotShipToState when no warehouse may ship to the buyer's state. Gift card lines
 * are left out.
 */
export async function routeAndReserve(
  ctx: StoreContext,
  input: RouteInput,
): Promise<{ parcels: RoutedParcel[]; reserved: ReservedUnits[] }> {
  // Selling stock may cross to low or out: Automations triggers, once per crossing.
  const variantIds = input.lines.filter((l) => !l.giftCard).map((l) => l.variantId)
  return watchStockCrossings(ctx.tx, ctx.storeId, variantIds, () => reserveRoute(ctx, input))
}

async function reserveRoute(
  ctx: StoreContext,
  input: RouteInput,
): Promise<{ parcels: RoutedParcel[]; reserved: ReservedUnits[] }> {
  if (!input.lines.some((l) => !l.giftCard && l.quantity > 0)) {
    return { parcels: [], reserved: [] }
  }
  const { goods, tracked, levelAt, result, buyerState } = await planRoute(ctx, input, true)
  if (result.kind === 'no_location') throw new CannotShipToState(buyerState, ctx.storeId)
  if (result.kind === 'out_of_stock') throw new OutOfStock(result.variantId, ctx.storeId)

  const byKey = new Map(goods.map((l) => [l.key, l]))
  const reserved: ReservedUnits[] = []
  for (const parcel of result.parcels) {
    for (const part of parcel.lines) {
      const line = byKey.get(part.key)
      if (!line || !tracked(line.variantId)) continue
      const level = levelAt(line.variantId, parcel.locationId)
      const free = level ? level.onHand - level.reserved : 0
      if (parcel.status === 'on_hold') {
        // A pre-order sells past stock up to its limit; the shortfall it leaves is what counts.
        const limit = line.preorder?.limit ?? null
        const shortfall = Math.max(0, part.quantity - Math.max(0, free))
        const sold = level ? Math.max(0, level.reserved - level.onHand) : 0
        if (limit !== null && sold + shortfall > limit) {
          throw new OutOfStock(line.variantId, ctx.storeId)
        }
      } else if (!parcel.needsTransfer && free < part.quantity) {
        throw new OutOfStock(line.variantId, ctx.storeId)
      }
      const units = {
        variantId: line.variantId,
        locationId: parcel.locationId,
        quantity: part.quantity,
      }
      await holdAt(ctx, units)
      if (level) level.reserved += part.quantity
      reserved.push(units)
    }
  }
  return { parcels: result.parcels, reserved }
}
