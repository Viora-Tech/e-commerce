/** SOURCE OF TRUTH: updateLocation, LOCATION_BILLING_FOLLOWS_STATE
 * WHAT:  Edit an existing location's name, address and phone (Settings › Locations › Edit address).
 * WHY:   A location's state decides which GST number it may bill under (tax/registrations.ts
 *        refuses another state's GSTIN). So when the state changes, the "Bills under" link
 *        follows it (LOCATION_BILLING_FOLLOWS_STATE): a GSTIN from another state is unlinked,
 *        and an unset link picks the state's GSTIN when exactly one active number is registered
 *        there. Two or more numbers in the state stay unset for the merchant to pick.
 * WHERE: api router `inventory.updateLocation`. Runs inside `withStore`; RLS scopes it, and the
 *        update also filters on `storeId` so a pasted id from another store finds nothing.
 */
import { gstRegistration, location, type StoreTx } from '@commerce/db'
import { and, eq, isNull } from 'drizzle-orm'
import { gstinState } from '../tax/gstin'
import { INDIAN_STATE_NAMES } from '../tax/states'
import { InventoryError } from './levels'
import type { LocationUpdate } from './schemas'

/** The GSTIN a location should bill under once its state is `state`. */
async function billingFor(
  tx: StoreTx,
  state: string | null,
  current: string | null,
): Promise<string | null> {
  if (!state) return current
  const active = await tx
    .select({ id: gstRegistration.id, gstin: gstRegistration.gstin })
    .from(gstRegistration)
    .where(isNull(gstRegistration.cancelledAt))
  const inState = active.filter((r) => gstinState(r.gstin) === state)
  if (current && inState.some((r) => r.id === current)) return current
  return inState.length === 1 ? (inState[0]?.id ?? null) : null
}

export async function updateLocation(tx: StoreTx, storeId: string, input: LocationUpdate) {
  const state = input.stateCode?.trim().toUpperCase() || null
  if (state && !INDIAN_STATE_NAMES[state]) {
    throw new InventoryError('BAD_STATE', 'Pick a state from the list', { storeId })
  }
  const [loc] = await tx
    .select({ id: location.id, gstRegistrationId: location.gstRegistrationId })
    .from(location)
    .where(and(eq(location.id, input.id), eq(location.storeId, storeId)))
  if (!loc) throw new InventoryError('LOCATION_NOT_FOUND', 'Location not found', { storeId })
  const [row] = await tx
    .update(location)
    .set({
      name: input.name,
      line1: input.line1 || null,
      // The edit form has no second line; leaving it out keeps what is stored.
      ...(input.line2 === undefined ? {} : { line2: input.line2 || null }),
      city: input.city || null,
      stateCode: state,
      pincode: input.pincode || null,
      phone: input.phone || null,
      gstRegistrationId: await billingFor(tx, state, loc.gstRegistrationId),
    })
    .where(and(eq(location.id, loc.id), eq(location.storeId, storeId)))
    .returning()
  if (!row) throw new InventoryError('LOCATION_NOT_FOUND', 'Location not found', { storeId })
  return row
}
