import {
  applyTracking,
  type CreateShipmentOptions,
  cancelBlock,
  cancelShipment,
  createShipmentForOrder,
  decryptShippingSettings,
  estimateForStore,
  FulfillmentOnHold,
  mergeMaskedSecrets,
  orderNumberLabel,
  parseShippingSettings,
  primaryShippingProvider,
  type RateLimitRule,
  readShippingLabel,
  recordProviderActivity,
  ShipmentNotCancellable,
  type ShippingRegistry,
  type ShippingSettings,
  shipmentInManifest,
  shipmentLabelUrl,
  shippingProviderById,
  TrackingEditRefused,
  updateShipmentTracking,
} from '@commerce/core'
import { getRegistries } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import { location, shipment, shipmentPickup, store } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { CourierError, describeCourierFailureForStaff, isValidPincode } from '@commerce/shipping'
import { ORPCError } from '@orpc/server'
import { and, desc, eq } from 'drizzle-orm'

export async function updateStoreShipping(tx: StoreTx, storeId: string, shipping: unknown) {
  const [s] = await tx.update(store).set({ shipping }).where(eq(store.id, storeId)).returning()
  return s ?? null
}

/**
 * The settings to save with an honest ship-from PIN code (audit #66). The parser fills 110001
 * when none was saved, and saving wrote that placeholder back, so a store that never set its
 * PIN looked set (Store health, Dispatch). Unless the merchant set it, the default warehouse's
 * PIN code is used, else none is saved.
 */
export async function withOrigin<P extends { originPincode: string }, S extends { policy: P }>(
  tx: StoreTx,
  settings: S,
  set: boolean,
): Promise<S | (Omit<S, 'policy'> & { policy: Omit<P, 'originPincode'> })> {
  if (set) return settings
  const [home] = await tx
    .select({ pincode: location.pincode })
    .from(location)
    .where(and(eq(location.isDefault, true), eq(location.active, true)))
  const pincode = home?.pincode?.trim()
  if (pincode && isValidPincode(pincode)) {
    return { ...settings, policy: { ...settings.policy, originPincode: pincode } }
  }
  const { originPincode: _placeholder, ...policy } = settings.policy
  return { ...settings, policy }
}

/**
 * A booking made in a courier's own panel names the app it was booked in; that app must be
 * connected, so the worker's tracking poll can follow the AWB (#1490).
 */
export async function assertCourierConnected(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  providerId: string,
): Promise<void> {
  const settings = await loadShippingSettings(tx, storeId)
  if (!shippingProviderById(registry, settings, secret, providerId)) {
    throw new ORPCError('BAD_REQUEST', { message: 'That courier app is not connected.' })
  }
}

export async function loadShippingSettings(
  tx: StoreTx,
  storeId: string,
): Promise<ShippingSettings> {
  const [s] = await tx.select({ shipping: store.shipping }).from(store).where(eq(store.id, storeId))
  return parseShippingSettings(s?.shipping)
}

/** The order's latest shipment (a re-ship after RTO is newer than the parcel that came back). */
async function getShipmentForOrder(tx: StoreTx, orderId: string) {
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
  const kept = mergeMaskedSecrets(stored ?? {}, rawFields)
  if (!kept.ok)
    return {
      ok: false,
      message:
        'To change where this connects, type the secret again (it is not reused for a new address).',
    }
  const merged = kept.merged

  const built = registry.create(providerId, merged)
  if (!built.ok) return { ok: false, message: built.errors.join(', ') }

  const pincode = merged.originPincode?.trim()
  if (!pincode || !isValidPincode(pincode)) {
    return { ok: false, message: 'Enter a valid 6-digit origin PIN code first.' }
  }

  /* An export-only courier (DHL Express, FedEx) has no answer for an Indian PIN code, so its
     own read-only check (a token or a rate lookup abroad) stands in for the serviceability one. */
  if (built.provider.coverage === 'international') {
    const check = await built.provider.verifyCredentials()
    return check.ok ? { ok: true, message: check.message } : { ok: false, message: check.message }
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
    // The PIN code lookup did not use the credentials (DTDC), so prove them separately.
    if (factory.serviceabilityWithoutCredentials) {
      const check = await built.provider.verifyCredentials()
      if (!check.ok) return { ok: false, message: check.message }
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
  if (err instanceof FulfillmentOnHold) {
    throw new ORPCError('PRECONDITION_FAILED', { message: err.message })
  }
  if (err instanceof ShipmentNotCancellable) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: err.message,
      data: { block: err.block },
    })
  }
  if (err instanceof CourierError) {
    const detail = describeCourierFailureForStaff(err)
    logger.warn('courier booking failed', { ...err, detail }) // kind, provider, status, reason
    /* A refusal the admin explains with facts (the pickup location name sent) carries them. */
    if (err.detail) {
      throw new ORPCError('BAD_REQUEST', {
        message: detail,
        data: { ...err.detail, provider: err.provider },
      })
    }
    throw new ORPCError('BAD_REQUEST', { message: detail })
  }
  throw err
}

/** Book one order (or one of its parcels) with the courier the merchant picked; without a
 *  pick, the store's first courier, as before the Create shipment flow. */
export async function bookShipment(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  orderId: string,
  choice: CreateShipmentOptions & { providerId?: string | undefined } = {},
) {
  const { providerId, ...options } = choice
  const settings = await loadShippingSettings(tx, storeId)
  const provider = providerId
    ? shippingProviderById(registry, settings, secret, providerId)
    : primaryShippingProvider(registry, settings, secret)
  if (!provider)
    throw new ORPCError('PRECONDITION_FAILED', {
      message: providerId
        ? `Courier ${providerId} is no longer connected. Pick another one.`
        : 'Enable a courier in Settings › Shipping first.',
    })
  const row = await createShipmentForOrder({ storeId, tx }, provider, orderId, options).catch(
    courierToRpc,
  )
  await noteShipmentBooked(tx, storeId, provider.id, orderId)
  return row
}

/** "Booked shipment for #1187" as the courier app's last activity on the Installed apps list. */
export async function noteShipmentBooked(
  tx: StoreTx,
  storeId: string,
  providerId: string,
  orderId: string,
): Promise<void> {
  const label = await orderNumberLabel(tx, orderId)
  await recordProviderActivity(
    tx,
    storeId,
    getRegistries().owners,
    'shipping',
    providerId,
    label ? `Booked shipment for ${label}` : 'Booked a shipment',
  )
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

/** Whether the courier app declares a cancel over its API. */
const courierCancels = (registry: ShippingRegistry, providerId: string): boolean =>
  registry.get(providerId)?.capabilities.includes('cancel') ?? false

/**
 * Cancel a booked label with its courier: refused before pickup or manifest is over
 * (`cancelBlock`), the order timeline names who did it, and the parcel can be booked again.
 */
export async function cancelStoreShipment(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  shipmentId: string,
  author: string | null = null,
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
  return cancelShipment({ storeId, tx }, provider, shipmentId, {
    author,
    courierCancels: courierCancels(registry, row.provider),
  }).catch(courierToRpc)
}

/**
 * One booked shipment as its details view shows it: the row with the label link the admin may
 * open (never a courier link that needs the key), the courier's name, the pickup it was put on,
 * and whether it can still be cancelled (and why not).
 */
async function describeShipment(
  tx: StoreTx,
  registry: ShippingRegistry,
  row: typeof shipment.$inferSelect,
) {
  const [pickup] = row.pickupId
    ? await tx
        .select({
          date: shipmentPickup.scheduledFor,
          timeFrom: shipmentPickup.timeFrom,
          status: shipmentPickup.status,
        })
        .from(shipmentPickup)
        .where(eq(shipmentPickup.id, row.pickupId))
    : []
  const inManifest = row.status === 'created' ? await shipmentInManifest(tx, row.id) : false
  return {
    ...row,
    labelUrl: shipmentLabelUrl(row),
    providerLabel: registry.get(row.provider)?.label ?? row.provider,
    /* Entered by hand (no courier app behind it): its tracking number and courier can be corrected. */
    canEditTracking: !registry.get(row.provider) && row.status !== 'cancelled',
    pickup: pickup ?? null,
    /* Not on a pickup yet, still at the store, and the courier takes requests: offer one. */
    canRequestPickup:
      !row.pickupId &&
      row.status === 'created' &&
      (registry.get(row.provider)?.capabilities.includes('pickup') ?? false),
    cancelBlock: cancelBlock(row, {
      inManifest,
      courierCancels: courierCancels(registry, row.provider),
    }),
  }
}

export type ShipmentDetails = Awaited<ReturnType<typeof describeShipment>>

/** The order's latest shipment as its details view shows it; null when it has none. */
export async function shipmentDetailsForOrder(
  tx: StoreTx,
  registry: ShippingRegistry,
  orderId: string,
): Promise<ShipmentDetails | null> {
  const row = await getShipmentForOrder(tx, orderId)
  return row ? describeShipment(tx, registry, row) : null
}

/** One shipment by id as its details view shows it. */
export async function shipmentDetails(
  tx: StoreTx,
  registry: ShippingRegistry,
  shipmentId: string,
): Promise<ShipmentDetails> {
  const [row] = await tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new ORPCError('NOT_FOUND', { message: 'Shipment not found.' })
  return describeShipment(tx, registry, row)
}

/**
 * "Edit tracking" on a shipment entered by hand: a new tracking number, courier or link. A
 * shipment a courier app booked keeps the courier's own AWB. Returns the details view again.
 */
export async function editShipmentTracking(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  shipmentId: string,
  input: { waybill: string; courier?: string | undefined; trackingUrl?: string | undefined },
  author: string,
): Promise<ShipmentDetails> {
  const [row] = await tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new ORPCError('NOT_FOUND', { message: 'Shipment not found.' })
  if (registry.get(row.provider)) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: 'The courier set this tracking number; cancel and book again to change it.',
    })
  }
  const r = await updateShipmentTracking({ storeId, tx }, shipmentId, input, author).catch(
    (err: unknown) => {
      if (err instanceof TrackingEditRefused) {
        throw new ORPCError('BAD_REQUEST', { message: err.message })
      }
      throw err
    },
  )
  return describeShipment(tx, registry, r.shipment)
}

/**
 * The label PDF behind the admin's `/api/shipments/<id>/label`: the copy kept in the store's
 * private storage (Blue Dart, DTDC, DHL Express, FedEx), else the courier's own, fetched here
 * server-side with the store's saved key (Delhivery's packing slip, including rows booked before
 * this route existed). Null when neither has one.
 */
export async function shipmentLabelFile(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  shipmentId: string,
): Promise<Uint8Array | null> {
  const [row] = await tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) return null
  const stored = await readShippingLabel({ storeId, tx }, shipmentId).catch(() => null)
  if (stored) return stored
  const provider = shippingProviderById(
    registry,
    await loadShippingSettings(tx, storeId),
    secret,
    row.provider,
  )
  if (!provider?.getLabel) return null
  const label = await provider.getLabel(row.waybill).catch(courierToRpc)
  return label.body
}
