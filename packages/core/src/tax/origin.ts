/** SOURCE OF TRUTH: resolveTaxOrigin, pickTaxOrigin, ORIGIN_FALLBACK, documentRegistration,
 *   listGstNumbers, SellerRegistration
 * WHAT:  Which GSTIN an order is billed from (its tax origin), and the seller a GST document
 *        prints for a registration.
 * WHY:   GST is charged by the registration of the state the goods leave from. Prices include
 *        GST, so the origin only decides CGST + SGST (same state as the shopper) or IGST
 *        (another state); the shopper pays the same either way. ORIGIN_FALLBACK, in order:
 *        1. the active GSTIN linked to the location the order's goods sell from
 *           (`inventory_level_one_sellable`; when lines sell from different locations, the
 *           one holding the most order value, the default location winning a tie);
 *        2. the store's default GSTIN;
 *        3. no GSTIN: the state in Settings › General (`store.address`), as before phase 3.
 *        A location without a linked GSTIN is never matched to one by state: billing is the
 *        merchant's explicit choice on Settings › Locations.
 * WHERE: placeOrder's createOrder step snapshots the result on the order
 *        (`order.gst_registration_id`, `order.tax_origin`); the GST invoices app reads the
 *        order's registration through `documentRegistration`.
 */
import {
  business,
  gstRegistration,
  inventoryLevel,
  location,
  type OrderTaxOrigin,
  type StoreTx,
  sellableLevel,
} from '@commerce/db'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { gstinState } from './gstin'
import { type LegalAddress, LegalAddressSchema } from './registration-schemas'
import { INDIAN_STATE_NAMES, stateCode } from './states'

export type { OrderTaxOrigin }

/** A GSTIN as origin selection needs it. */
export type OriginRegistration = { id: string; gstin: string }

/** One location the order's goods sell from, with the order value it holds. */
export type OriginLocation = {
  locationId: string
  locationName: string
  isDefault: boolean
  grossPaise: number
  /** The active GSTIN linked to the location; null when none is chosen or it is cancelled. */
  registration: OriginRegistration | null
}

const stateNameOf = (code: string | null) => (code ? (INDIAN_STATE_NAMES[code] ?? null) : null)

/** The location holding the most order value; the default location, then the id, break ties. */
function principalLocation(locations: readonly OriginLocation[]): OriginLocation | null {
  return (
    [...locations].sort(
      (a, b) =>
        b.grossPaise - a.grossPaise ||
        Number(b.isDefault) - Number(a.isDefault) ||
        a.locationId.localeCompare(b.locationId),
    )[0] ?? null
  )
}

/** ORIGIN_FALLBACK as a pure function, so every branch is testable without a database. */
export function pickTaxOrigin(input: {
  locations: readonly OriginLocation[]
  defaultRegistration: OriginRegistration | null
  /** `store.address.state`: a code or a full name. */
  storeState: string | null | undefined
}): OrderTaxOrigin {
  const principal = principalLocation(input.locations)
  const at = {
    locationId: principal?.locationId ?? null,
    locationName: principal?.locationName ?? null,
  }
  const registration = principal?.registration ?? input.defaultRegistration
  if (registration) {
    const code = gstinState(registration.gstin)
    return {
      source: principal?.registration ? 'location' : 'default_registration',
      ...at,
      gstRegistrationId: registration.id,
      gstin: registration.gstin,
      stateCode: code,
      stateName: stateNameOf(code),
    }
  }
  const code = stateCode(input.storeState)
  return {
    source: 'store_address',
    ...at,
    gstRegistrationId: null,
    gstin: null,
    stateCode: code,
    stateName: stateNameOf(code),
  }
}

export type OriginLine = { variantId: string; grossPaise: number }

/**
 * The tax origin of an order with these goods lines (gift cards excluded by the caller: they
 * are vouchers, not goods leaving a warehouse). Reads under the store's RLS.
 */
export async function resolveTaxOrigin(
  tx: StoreTx,
  input: { lines: readonly OriginLine[]; storeState: string | null | undefined },
): Promise<OrderTaxOrigin> {
  const ids = [...new Set(input.lines.map((l) => l.variantId))]
  const levels = ids.length
    ? await tx
        .select({
          variantId: inventoryLevel.variantId,
          locationId: location.id,
          locationName: location.name,
          isDefault: location.isDefault,
          registrationId: gstRegistration.id,
          gstin: gstRegistration.gstin,
          cancelledAt: gstRegistration.cancelledAt,
        })
        .from(inventoryLevel)
        .innerJoin(location, eq(location.id, inventoryLevel.locationId))
        .leftJoin(gstRegistration, eq(gstRegistration.id, location.gstRegistrationId))
        .where(and(inArray(inventoryLevel.variantId, ids), sellableLevel))
    : []
  const byLocation = new Map<string, OriginLocation>()
  for (const line of input.lines) {
    const level = levels.find((l) => l.variantId === line.variantId)
    if (!level) continue
    const known = byLocation.get(level.locationId)
    if (known) {
      known.grossPaise += line.grossPaise
      continue
    }
    byLocation.set(level.locationId, {
      locationId: level.locationId,
      locationName: level.locationName,
      isDefault: level.isDefault,
      grossPaise: line.grossPaise,
      registration:
        level.registrationId && level.gstin && !level.cancelledAt
          ? { id: level.registrationId, gstin: level.gstin }
          : null,
    })
  }
  const [fallback] = await tx
    .select({ id: gstRegistration.id, gstin: gstRegistration.gstin })
    .from(gstRegistration)
    .where(eq(gstRegistration.isDefault, true))
  return pickTaxOrigin({
    locations: [...byLocation.values()],
    defaultRegistration: fallback ?? null,
    storeState: input.storeState,
  })
}

/** Everything a GST document prints about the supplier, for one registration. */
export type SellerRegistration = {
  id: string
  gstin: string
  /** Two-letter state from the GSTIN, e.g. 'HR'. */
  stateCode: string | null
  /** The business's name as on its PAN. */
  legalName: string
  tradeName: string | null
  address: LegalAddress
  email: string | null
  phone: string | null
  /** Up to 5 characters; `{GST}` in a numbering series prints it. */
  invoicePrefix: string | null
  isDefault: boolean
  cancelled: boolean
}

const sellerColumns = {
  id: gstRegistration.id,
  gstin: gstRegistration.gstin,
  legalAddress: gstRegistration.legalAddress,
  tradeName: gstRegistration.tradeName,
  email: gstRegistration.email,
  phone: gstRegistration.phone,
  invoicePrefix: gstRegistration.invoicePrefix,
  isDefault: gstRegistration.isDefault,
  cancelledAt: gstRegistration.cancelledAt,
  legalName: business.legalName,
}

type SellerRow = {
  id: string
  gstin: string
  legalAddress: unknown
  tradeName: string | null
  email: string | null
  phone: string | null
  invoicePrefix: string | null
  isDefault: boolean
  cancelledAt: Date | null
  legalName: string
}

function toSeller(row: SellerRow): SellerRegistration {
  const address = LegalAddressSchema.safeParse(row.legalAddress ?? {})
  return {
    id: row.id,
    gstin: row.gstin,
    stateCode: gstinState(row.gstin),
    legalName: row.legalName,
    tradeName: row.tradeName,
    address: address.success ? address.data : LegalAddressSchema.parse({}),
    email: row.email,
    phone: row.phone,
    invoicePrefix: row.invoicePrefix,
    isDefault: row.isDefault,
    cancelled: row.cancelledAt !== null,
  }
}

/**
 * The registration a document is issued under: `preferredId` (the order's, or the original
 * invoice's for a credit note) when it can still issue, else the store's default, else null
 * (a store with no GST registration prints the GST invoices app's own seller block).
 * `allowCancelled` keeps a cancelled preferred GSTIN: a credit note names the GSTIN that
 * issued the invoice it corrects.
 */
export async function documentRegistration(
  tx: StoreTx,
  preferredId: string | null | undefined,
  opts: { allowCancelled?: boolean } = {},
): Promise<SellerRegistration | null> {
  if (preferredId) {
    const [row] = await tx
      .select(sellerColumns)
      .from(gstRegistration)
      .innerJoin(business, eq(business.id, gstRegistration.businessId))
      .where(eq(gstRegistration.id, preferredId))
    if (row && (opts.allowCancelled || row.cancelledAt === null)) return toSeller(row)
  }
  const [fallback] = await tx
    .select(sellerColumns)
    .from(gstRegistration)
    .innerJoin(business, eq(business.id, gstRegistration.businessId))
    .where(eq(gstRegistration.isDefault, true))
  return fallback ? toSeller(fallback) : null
}

/** A GST number as the GST invoices app's picker shows it. */
export type GstNumberOption = {
  id: string
  gstin: string
  stateCode: string | null
  stateName: string | null
  isDefault: boolean
  active: boolean
}

/** Every GST number of the store, default first, cancelled ones last (their returns still matter). */
export async function listGstNumbers(tx: StoreTx): Promise<GstNumberOption[]> {
  const rows = await tx
    .select({
      id: gstRegistration.id,
      gstin: gstRegistration.gstin,
      isDefault: gstRegistration.isDefault,
      cancelledAt: gstRegistration.cancelledAt,
    })
    .from(gstRegistration)
    .orderBy(
      desc(gstRegistration.isDefault),
      sql`${gstRegistration.cancelledAt} is not null`,
      asc(gstRegistration.createdAt),
    )
  return rows.map((r) => {
    const code = gstinState(r.gstin)
    return {
      id: r.id,
      gstin: r.gstin,
      stateCode: code,
      stateName: stateNameOf(code),
      isDefault: r.isDefault,
      active: r.cancelledAt === null,
    }
  })
}
