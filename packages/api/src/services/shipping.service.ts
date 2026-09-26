import {
  applyTracking,
  cancelShipment,
  createShipmentForOrder,
  decryptShippingSettings,
  estimateForStore,
  isMaskedSecret,
  parseShippingSettings,
  primaryShippingProvider,
  type RateLimitRule,
  type ShippingRegistry,
  type ShippingSettings,
  shippingProviderById,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { shipment, store } from '@commerce/db'
import { CourierError, describeCourierFailure, isValidPincode } from '@commerce/shipping'
import { ORPCError } from '@orpc/server'
import { desc, eq } from 'drizzle-orm'

export async function updateStoreShipping(tx: StoreTx, storeId: string, shipping: unknown) {
  const [s] = await tx.update(store).set({ shipping }).where(eq(store.id, storeId)).returning()
  return s ?? null
}

export async function loadShippingSettings(
  tx: StoreTx,
  storeId: string,
): Promise<ShippingSettings> {
  const [s] = await tx.select({ shipping: store.shipping }).from(store).where(eq(store.id, storeId))
  return parseShippingSettings(s?.shipping)
}

/** The order's latest shipment (a re-ship after RTO is newer than the parcel that came back). */
export async function getShipmentForOrder(tx: StoreTx, orderId: string) {
  const [row] = await tx
    .select()
    .from(shipment)
    .where(eq(shipment.orderId, orderId))
    .orderBy(desc(shipment.createdAt))
  return row ?? null
}

/** The merchant's own "try a PIN" panel: the same composition the storefront uses. */
export async function tryEstimate(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  pincode: string,
) {
  const settings = await loadShippingSettings(tx, storeId)
  return estimateForStore({ registry, settings, secret, pincode })
}

/** Ask the store's primary courier whether its saved credentials work. */
export async function verifyShippingCredentials(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
) {
  const provider = primaryShippingProvider(
    registry,
    await loadShippingSettings(tx, storeId),
    secret,
  )
  if (!provider) return { ok: false, message: 'No courier is enabled.' }
  return provider.verifyCredentials()
}

/** Five attempts every five minutes: generous for a merchant retyping a typo'd token,
 *  tight enough to stop a credential-guessing loop against a real courier account. */
export const TEST_CONNECTION_RULE: RateLimitRule = { limit: 5, windowMs: 5 * 60_000 }

/** The app's own words for why a test connection failed. The courier's raw error never reaches the UI. */
function describeConnectionError(label: string, error: unknown): string {
  if (error instanceof CourierError) {
    if (error.kind === 'auth')
      return `${label} didn't accept this token. Generate a fresh one from ${label} One → Settings → API Setup and paste it in within 5 minutes - it's only shown once.`
    if (error.kind === 'timeout')
      return `${label} did not answer in time. Check your internet connection and try again.`
    if (error.kind === 'rate_limited')
      return `${label} is rate limiting requests right now. Wait a minute and try again.`
    if (error.kind === 'unavailable')
      return `Could not reach ${label} right now. Try again in a moment.`
    return `${label} sent back something we didn't expect. Try again in a moment.`
  }
  return error instanceof Error ? error.message : `Could not test the ${label} connection.`
}

/**
 * The Connect page's "Test connection" button. Takes the form's current field
 * values - a masked secret (••••1234) means "use what's already saved" - so
 * the merchant can test before saving. Validates them with the courier's own
 * factory, then makes exactly one harmless read-only call (a serviceability
 * lookup for the origin PIN, against itself) to prove the token and account
 * actually work. Never books a shipment, never logs or returns the token.
 */
export type PickupLocationOption = {
  name: string
  city?: string | undefined
  pincode?: string | undefined
}

type ListsPickupLocations = {
  listPickupLocations(): Promise<
    Array<{ name: string; city?: string | undefined; pincode?: string | undefined }>
  >
}

function hasListPickupLocations(provider: unknown): provider is ListsPickupLocations {
  return (
    typeof provider === 'object' &&
    provider !== null &&
    typeof (provider as ListsPickupLocations).listPickupLocations === 'function'
  )
}

export async function testShippingConnection(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  providerId: string,
  rawFields: Record<string, string>,
): Promise<
  | { ok: true; message: string; pickupLocations?: PickupLocationOption[] }
  | { ok: false; message: string }
> {
  const factory = registry.get(providerId)
  if (!factory) return { ok: false, message: 'This courier is not available.' }

  const stored = decryptShippingSettings(await loadShippingSettings(tx, storeId), secret).providers[
    providerId
  ]
  const merged = Object.fromEntries(
    Object.entries(rawFields).map(([key, value]) => [
      key,
      isMaskedSecret(value) && stored?.[key] ? stored[key] : value,
    ]),
  )

  const built = registry.create(providerId, merged)
  if (!built.ok) return { ok: false, message: built.errors.join(', ') }

  const pincode = merged.originPincode?.trim()
  if (!pincode || !isValidPincode(pincode)) {
    return { ok: false, message: 'Enter a valid 6-digit origin PIN code first.' }
  }

  try {
    const result = await built.provider.checkServiceability({
      originPincode: pincode,
      destinationPincode: pincode,
    })
    if (!result.serviceable) {
      return {
        ok: false,
        message: `${factory.label} accepted the token, but does not currently serve PIN ${pincode}. Double check the origin PIN code.`,
      }
    }
    // A cheap bonus lookup: only RapidShyp exposes this today (Fetch Pickup Location API), and
    // failing to fetch it never fails the connection test itself - the Connect page just keeps
    // the free-text field instead of showing a dropdown.
    let pickupLocations: PickupLocationOption[] | undefined
    if (hasListPickupLocations(built.provider)) {
      pickupLocations = await built.provider.listPickupLocations().catch(() => undefined)
    }
    return {
      ok: true,
      message: `Connected - ${factory.label} serves ${pincode}.`,
      ...(pickupLocations?.length ? { pickupLocations } : {}),
    }
  } catch (error) {
    return { ok: false, message: describeConnectionError(factory.label, error) }
  }
}

/** Courier failures become BAD_REQUEST with the app's wording; the courier's never reaches the UI raw. */
const courierToRpc = (err: unknown): never => {
  if (err instanceof CourierError) {
    const detail = err.kind === 'rejected' ? err.message : describeCourierFailure(err)
    throw new ORPCError('BAD_REQUEST', { message: detail })
  }
  throw err
}

export async function bookShipment(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  orderId: string,
) {
  const provider = primaryShippingProvider(
    registry,
    await loadShippingSettings(tx, storeId),
    secret,
  )
  if (!provider)
    throw new ORPCError('PRECONDITION_FAILED', {
      message: 'Enable a courier in Settings › Shipping first.',
    })
  return createShipmentForOrder({ storeId, tx }, provider, orderId).catch(courierToRpc)
}

export async function refreshShipmentTracking(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  shipmentId: string,
) {
  const [row] = await tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new ORPCError('NOT_FOUND')
  const provider = shippingProviderById(
    registry,
    await loadShippingSettings(tx, storeId),
    secret,
    row.provider,
  )
  if (!provider) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: `Courier ${row.provider} is no longer enabled.`,
    })
  }
  const tracking = await provider.track(row.waybill).catch(courierToRpc)
  return applyTracking({ storeId, tx }, shipmentId, tracking)
}

export async function cancelStoreShipment(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  shipmentId: string,
) {
  const [row] = await tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new ORPCError('NOT_FOUND')
  const provider = shippingProviderById(
    registry,
    await loadShippingSettings(tx, storeId),
    secret,
    row.provider,
  )
  if (!provider) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: `Courier ${row.provider} is no longer enabled.`,
    })
  }
  return cancelShipment({ storeId, tx }, provider, shipmentId).catch(courierToRpc)
}
