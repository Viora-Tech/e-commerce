/** SOURCE OF TRUTH: listBusinessGst, addRegistration, setDefaultRegistration, cancelRegistration,
 *   linkLocationRegistration, adoptStoreGstin, defaultRegistrationGstin, GstRegistrationError,
 *   PAN_MUST_MATCH_BUSINESS, ONE_DEFAULT_REGISTRATION
 * WHAT:  The rules for businesses (one PAN each) and their GST registrations (one GSTIN per
 *        state), and which GSTIN each location bills under.
 * WHY:   GST is registered per PAN per state, so a GSTIN's characters 3-12 must be its
 *        business's PAN (PAN_MUST_MATCH_BUSINESS). `store.gstin` predates registrations and is
 *        still read by invoices and checkout; it mirrors the one default registration
 *        (ONE_DEFAULT_REGISTRATION) and is written here only through `mirrorStoreGstin`.
 *        Which GSTIN an order bills from: tax/origin.ts; numbering per GSTIN: the GST invoices app.
 * WHERE: api router `businessGst`; Taxes & GST and General saves call `adoptStoreGstin`.
 *        Every call runs inside `withStore`, so RLS scopes each statement to the store.
 */
import { business, gstRegistration, location, newId, type StoreTx, store } from '@commerce/db'
import { and, asc, desc, eq, isNull, ne, sql } from 'drizzle-orm'
import { CommerceError } from '../errors'
import { listLocations } from '../inventory/levels'
import { parseShippingSettings } from '../shipping/settings'
import { gstinState, panFromGstin, validateGstin } from './gstin'
import {
  type BusinessInput,
  BusinessInputSchema,
  type BusinessUpdate,
  BusinessUpdateSchema,
  type GstRegistrationErrorCode,
  LegalAddressSchema,
  type LocationRegistration,
  type RegistrationInput,
  RegistrationInputSchema,
  type RegistrationUpdate,
  RegistrationUpdateSchema,
} from './registration-schemas'
import type {
  Business,
  BusinessGstView,
  GstRegistrationRow,
  GstRegistrationView,
} from './registration-views'
import { INDIAN_STATE_NAMES } from './states'

export class GstRegistrationError extends CommerceError {
  declare readonly code: GstRegistrationErrorCode
  constructor(code: GstRegistrationErrorCode, message: string, storeId?: string) {
    super(code, message, { storeId })
  }
}

export type {
  Business,
  BusinessGstView,
  GstRegistrationRow,
  GstRegistrationView,
  LocationBillingView,
} from './registration-views'

const PAN_MISMATCH_MESSAGE = 'This GST number belongs to a different PAN. Is it another business?'

const stateNameOf = (code: string | null) => (code ? (INDIAN_STATE_NAMES[code] ?? null) : null)

function present(row: GstRegistrationRow): GstRegistrationView {
  const state = gstinState(row.gstin) ?? ''
  const address = LegalAddressSchema.safeParse(row.legalAddress ?? {})
  return {
    ...row,
    legalAddress: address.success ? address.data : LegalAddressSchema.parse({}),
    state,
    stateName: stateNameOf(state) ?? state,
    active: row.cancelledAt === null,
  }
}

/** Optional text columns: blank is stored as null. */
const orNull = (v: string | undefined) => (v ? v : null)

async function listBusinesses(tx: StoreTx): Promise<Business[]> {
  return tx.select().from(business).orderBy(desc(business.isPrimary), asc(business.createdAt))
}

async function listRegistrations(tx: StoreTx): Promise<GstRegistrationView[]> {
  const rows = await tx
    .select()
    .from(gstRegistration)
    .orderBy(
      desc(gstRegistration.isDefault),
      sql`${gstRegistration.cancelledAt} is not null`,
      asc(gstRegistration.createdAt),
    )
  return rows.map(present)
}

/** Settings › Business and GST in one read: businesses, GST numbers, and each location's GSTIN. */
export async function listBusinessGst(tx: StoreTx, storeId: string): Promise<BusinessGstView> {
  const [businesses, registrations, locations] = [
    await listBusinesses(tx),
    await listRegistrations(tx),
    (await listLocations(tx, storeId)).sort(
      (a, b) => a.priority - b.priority || Number(b.isDefault) - Number(a.isDefault),
    ),
  ]
  const [s] = await tx.select({ shipping: store.shipping }).from(store).where(eq(store.id, storeId))
  const registeredStates = new Set(registrations.filter((r) => r.active).map((r) => r.state))
  return {
    businesses,
    registrations,
    locations: locations.map((l) => {
      const stateCode = l.stateCode?.trim().toUpperCase() || null
      return {
        id: l.id,
        name: l.name,
        line1: l.line1,
        line2: l.line2,
        city: l.city,
        pincode: l.pincode,
        stateCode,
        stateName: stateNameOf(stateCode),
        isDefault: l.isDefault,
        gstRegistrationId: l.gstRegistrationId,
        stateUnregistered: stateCode !== null && !registeredStates.has(stateCode),
        phone: l.phone,
        courierPickup: l.courierPickup ?? null,
        fulfilsOnlineOrders: l.fulfilsOnlineOrders,
        priority: l.priority,
      }
    }),
    maxParcels: parseShippingSettings(s?.shipping).routing.maxParcels,
  }
}

async function businessById(tx: StoreTx, storeId: string, id: string): Promise<Business> {
  const [row] = await tx.select().from(business).where(eq(business.id, id))
  if (!row) throw new GstRegistrationError('NOT_FOUND', 'Business not found', storeId)
  return row
}

async function registrationById(tx: StoreTx, storeId: string, id: string) {
  const [row] = await tx.select().from(gstRegistration).where(eq(gstRegistration.id, id))
  if (!row) throw new GstRegistrationError('NOT_FOUND', 'GST number not found', storeId)
  return row
}

async function primaryBusiness(tx: StoreTx): Promise<Business | null> {
  const [row] = await tx.select().from(business).where(eq(business.isPrimary, true))
  return row ?? null
}

async function insertBusiness(
  tx: StoreTx,
  storeId: string,
  input: { legalName: string; tradeName: string; pan: string },
): Promise<Business> {
  const [taken] = await tx
    .select({ id: business.id })
    .from(business)
    .where(eq(business.pan, input.pan))
  if (taken) {
    throw new GstRegistrationError(
      'DUPLICATE_PAN',
      'A business with this PAN is already added.',
      storeId,
    )
  }
  const isPrimary = (await primaryBusiness(tx)) === null
  const [row] = await tx
    .insert(business)
    .values({
      id: newId(),
      storeId,
      legalName: input.legalName,
      tradeName: orNull(input.tradeName),
      pan: input.pan,
      isPrimary,
    })
    .returning()
  if (!row) throw new GstRegistrationError('NOT_FOUND', 'Business was not created', storeId)
  return row
}

/** A business (one PAN). The store's first business becomes its main one. */
export async function createBusiness(
  tx: StoreTx,
  storeId: string,
  raw: BusinessInput,
): Promise<Business> {
  return insertBusiness(tx, storeId, BusinessInputSchema.parse(raw))
}

/** Names can always change; the PAN only while the business has no GST numbers. */
export async function updateBusiness(
  tx: StoreTx,
  storeId: string,
  raw: BusinessUpdate,
): Promise<Business> {
  const input = BusinessUpdateSchema.parse(raw)
  const current = await businessById(tx, storeId, input.id)
  if (input.pan !== current.pan) {
    const [hasRegistration] = await tx
      .select({ id: gstRegistration.id })
      .from(gstRegistration)
      .where(eq(gstRegistration.businessId, current.id))
      .limit(1)
    if (hasRegistration) {
      throw new GstRegistrationError(
        'PAN_LOCKED',
        'This business already has GST numbers, so its PAN cannot change.',
        storeId,
      )
    }
    const [taken] = await tx
      .select({ id: business.id })
      .from(business)
      .where(and(eq(business.pan, input.pan), ne(business.id, current.id)))
    if (taken) {
      throw new GstRegistrationError(
        'DUPLICATE_PAN',
        'A business with this PAN is already added.',
        storeId,
      )
    }
  }
  const [row] = await tx
    .update(business)
    .set({ legalName: input.legalName, tradeName: orNull(input.tradeName), pan: input.pan })
    .where(eq(business.id, current.id))
    .returning()
  if (!row) throw new GstRegistrationError('NOT_FOUND', 'Business not found', storeId)
  return row
}

/** The default registration's GSTIN; null while the store has none (store.gstin is then free). */
export async function defaultRegistrationGstin(tx: StoreTx): Promise<string | null> {
  const [row] = await tx
    .select({ gstin: gstRegistration.gstin })
    .from(gstRegistration)
    .where(eq(gstRegistration.isDefault, true))
  return row?.gstin ?? null
}

/** `store.gstin` := the default registration's GSTIN, or null without one. The only writer. */
async function mirrorStoreGstin(tx: StoreTx, storeId: string): Promise<void> {
  await tx
    .update(store)
    .set({ gstin: await defaultRegistrationGstin(tx) })
    .where(eq(store.id, storeId))
}

/** Makes an active registration the default one (ONE_DEFAULT_REGISTRATION). */
export async function setDefaultRegistration(
  tx: StoreTx,
  storeId: string,
  id: string,
): Promise<GstRegistrationView> {
  const row = await registrationById(tx, storeId, id)
  if (row.cancelledAt) {
    throw new GstRegistrationError(
      'CANCELLED',
      'This GST number is cancelled. Pick another one.',
      storeId,
    )
  }
  // Clear first: the partial unique index allows one default row at any moment.
  await tx
    .update(gstRegistration)
    .set({ isDefault: false })
    .where(and(eq(gstRegistration.isDefault, true), ne(gstRegistration.id, id)))
  const [updated] = await tx
    .update(gstRegistration)
    .set({ isDefault: true })
    .where(eq(gstRegistration.id, id))
    .returning()
  await mirrorStoreGstin(tx, storeId)
  return present(updated ?? row)
}

async function storeName(tx: StoreTx, storeId: string): Promise<string> {
  const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
  return s?.name ?? ''
}

/**
 * Adds a GSTIN (PAN_MUST_MATCH_BUSINESS). Without a business id it goes to the main business,
 * created from the GSTIN's PAN when the store has none yet. A cancelled number added again is
 * brought back. The store's first GSTIN, or one added with `makeDefault`, becomes the default.
 */
export async function addRegistration(
  tx: StoreTx,
  storeId: string,
  raw: RegistrationInput,
): Promise<GstRegistrationView> {
  const parsed = RegistrationInputSchema.safeParse(raw)
  if (!parsed.success) {
    throw new GstRegistrationError(
      'INVALID_GSTIN',
      parsed.error.issues[0]?.message ?? 'Check the GST number',
      storeId,
    )
  }
  const input = parsed.data
  const check = validateGstin(input.gstin)
  if (!check.ok) throw new GstRegistrationError('INVALID_GSTIN', 'Check the GST number', storeId)
  const gstin = check.gstin
  const pan = panFromGstin(gstin)

  const owner = input.businessId
    ? await businessById(tx, storeId, input.businessId)
    : ((await primaryBusiness(tx)) ??
      (await insertBusiness(tx, storeId, {
        legalName: input.legalName || (await storeName(tx, storeId)),
        tradeName: '',
        pan,
      })))
  if (owner.pan !== pan)
    throw new GstRegistrationError('PAN_MISMATCH', PAN_MISMATCH_MESSAGE, storeId)

  const fields = {
    businessId: owner.id,
    registrationType: input.registrationType,
    legalAddress: input.legalAddress,
    tradeName: orNull(input.tradeName),
    email: orNull(input.email),
    phone: orNull(input.phone),
    invoicePrefix: orNull(input.invoicePrefix),
    effectiveFrom: orNull(input.effectiveFrom),
  }
  const [existing] = await tx.select().from(gstRegistration).where(eq(gstRegistration.gstin, gstin))
  if (existing && !existing.cancelledAt) {
    throw new GstRegistrationError('DUPLICATE_GSTIN', 'This GST number is already added.', storeId)
  }
  const [row] = existing
    ? await tx
        .update(gstRegistration)
        .set({ ...fields, cancelledAt: null })
        .where(eq(gstRegistration.id, existing.id))
        .returning()
    : await tx
        .insert(gstRegistration)
        .values({ id: newId(), storeId, gstin, ...fields })
        .returning()
  if (!row) throw new GstRegistrationError('NOT_FOUND', 'GST number was not added', storeId)

  const [currentDefault] = await tx
    .select({ id: gstRegistration.id })
    .from(gstRegistration)
    .where(eq(gstRegistration.isDefault, true))
  if (input.makeDefault || !currentDefault) return setDefaultRegistration(tx, storeId, row.id)
  return present(row)
}

/** Everything but the GSTIN (a new number is a new registration). */
export async function updateRegistration(
  tx: StoreTx,
  storeId: string,
  raw: RegistrationUpdate,
): Promise<GstRegistrationView> {
  const input = RegistrationUpdateSchema.parse(raw)
  await registrationById(tx, storeId, input.id)
  const [row] = await tx
    .update(gstRegistration)
    .set({
      registrationType: input.registrationType,
      legalAddress: input.legalAddress,
      tradeName: orNull(input.tradeName),
      email: orNull(input.email),
      phone: orNull(input.phone),
      invoicePrefix: orNull(input.invoicePrefix),
      effectiveFrom: orNull(input.effectiveFrom),
    })
    .where(eq(gstRegistration.id, input.id))
    .returning()
  if (!row) throw new GstRegistrationError('NOT_FOUND', 'GST number not found', storeId)
  return present(row)
}

/**
 * Marks a GSTIN cancelled (the row stays, old invoices name it). Locations billing under it are
 * unlinked. When it was the default, the oldest active GSTIN of the main business (else any
 * business) takes over; with none left, `store.gstin` is cleared.
 */
export async function cancelRegistration(
  tx: StoreTx,
  storeId: string,
  id: string,
): Promise<GstRegistrationView> {
  const row = await registrationById(tx, storeId, id)
  if (row.cancelledAt) return present(row)
  const [cancelled] = await tx
    .update(gstRegistration)
    .set({ cancelledAt: new Date(), isDefault: false })
    .where(eq(gstRegistration.id, id))
    .returning()
  await tx
    .update(location)
    .set({ gstRegistrationId: null })
    .where(eq(location.gstRegistrationId, id))
  if (row.isDefault) {
    const [next] = await tx
      .select({ id: gstRegistration.id })
      .from(gstRegistration)
      .innerJoin(business, eq(business.id, gstRegistration.businessId))
      .where(isNull(gstRegistration.cancelledAt))
      .orderBy(desc(business.isPrimary), asc(gstRegistration.createdAt))
      .limit(1)
    if (next) await setDefaultRegistration(tx, storeId, next.id)
    else await mirrorStoreGstin(tx, storeId)
  }
  return present(cancelled ?? row)
}

/**
 * Which GSTIN a location bills under. A location with a state may only use a GSTIN registered
 * in that state: goods leave from there, so that state's registration issues the invoice.
 */
export async function linkLocationRegistration(
  tx: StoreTx,
  storeId: string,
  input: LocationRegistration,
): Promise<void> {
  const [loc] = await tx
    .select({ id: location.id, stateCode: location.stateCode })
    .from(location)
    .where(eq(location.id, input.locationId))
  if (!loc) throw new GstRegistrationError('NOT_FOUND', 'Location not found', storeId)
  if (input.gstRegistrationId) {
    const reg = await registrationById(tx, storeId, input.gstRegistrationId)
    if (reg.cancelledAt) {
      throw new GstRegistrationError(
        'CANCELLED',
        'This GST number is cancelled. Pick another one.',
        storeId,
      )
    }
    const regState = gstinState(reg.gstin)
    const locState = loc.stateCode?.trim().toUpperCase() || null
    if (locState && regState && locState !== regState) {
      const locName = stateNameOf(locState) ?? locState
      throw new GstRegistrationError(
        'STATE_MISMATCH',
        `This GST number is for ${stateNameOf(regState) ?? regState}. A location in ${locName} needs a ${locName} GST number.`,
        storeId,
      )
    }
  }
  await tx
    .update(location)
    .set({ gstRegistrationId: input.gstRegistrationId })
    .where(eq(location.id, loc.id))
}

/**
 * For the pages that wrote `store.gstin` before registrations existed (Taxes & GST, General).
 * Without a default registration, a GSTIN saved there becomes the store's first registration.
 * With one, Business and GST owns the number: the same GSTIN passes, a different one is refused.
 */
export async function adoptStoreGstin(
  tx: StoreTx,
  storeId: string,
  gstin: string | null,
  legalName = '',
): Promise<void> {
  const value = gstin?.trim().toUpperCase() ?? ''
  const current = await defaultRegistrationGstin(tx)
  if (current) {
    if (current === value) return
    throw new GstRegistrationError(
      'MANAGED_ELSEWHERE',
      'Your GST numbers are managed in Settings › Taxes & GST › GST numbers. Change them there.',
      storeId,
    )
  }
  if (!value) return
  await addRegistration(tx, storeId, { gstin: value, legalName, makeDefault: true })
}
