/** SOURCE OF TRUTH: readStoreProfile, saveStoreProfile, saveLocationDetails — WHAT: read and patch the store's own details (name, contact email and phone, business address, prices-include-GST switch) and create or edit a location's name and address, field by field / WHY: a store migration (the Shopify importer's Store settings step) writes only the fields it brings over, leaving GSTIN, rate, time zone, currency, stock and every other setting exactly as they were */
import { location, newId, store } from '@commerce/db'
import { cleanMoneyFormat } from '@commerce/money'
import { eq } from 'drizzle-orm'
import { lockStoreApps } from '../apps/locked'
import type { StoreContext } from '../context'
import { parseStoreTax, withStoreTax } from '../tax/settings'
import { emptyStoreAddress, type StoreAddress, StoreAddressSchema } from './general'

export type StoreProfile = {
  name: string
  currency: string
  timezone: string
  contactEmail: string
  contactPhone: string
  address: StoreAddress
  pricesIncludeGst: boolean
  /** Shopify-style price format (`Rs. {{amount}}`); null is the currency's own. */
  moneyFormat: string | null
}

export async function readStoreProfile(ctx: StoreContext): Promise<StoreProfile> {
  const [s] = await ctx.tx
    .select({
      name: store.name,
      currency: store.currency,
      timezone: store.timezone,
      contactEmail: store.contactEmail,
      contactPhone: store.contactPhone,
      address: store.address,
      apps: store.apps,
      moneyFormat: store.moneyFormat,
    })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  if (!s) throw new Error(`store ${ctx.storeId} not visible in context`)
  const address = StoreAddressSchema.safeParse(s.address ?? {})
  return {
    name: s.name,
    currency: s.currency,
    timezone: s.timezone,
    contactEmail: s.contactEmail ?? '',
    contactPhone: s.contactPhone ?? '',
    address: address.success ? address.data : emptyStoreAddress,
    pricesIncludeGst: parseStoreTax(s.apps).pricesIncludeGst,
    moneyFormat: s.moneyFormat,
  }
}

/** Only the fields present change; currency, time zone and the GST number are never touched. */
export type StoreProfilePatch = {
  name?: string | undefined
  contactEmail?: string | undefined
  contactPhone?: string | undefined
  address?: StoreAddress | undefined
  pricesIncludeGst?: boolean | undefined
  moneyFormat?: string | undefined
}

export async function saveStoreProfile(ctx: StoreContext, patch: StoreProfilePatch): Promise<void> {
  const [s] = await ctx.tx.select({ id: store.id }).from(store).where(eq(store.id, ctx.storeId))
  if (!s) throw new Error(`store ${ctx.storeId} not visible in context`)
  const set: Partial<typeof store.$inferInsert> = {}
  if (patch.name !== undefined) set.name = patch.name.trim().slice(0, 120)
  if (patch.contactEmail !== undefined) set.contactEmail = patch.contactEmail || null
  if (patch.contactPhone !== undefined) set.contactPhone = patch.contactPhone || null
  if (patch.address !== undefined) set.address = StoreAddressSchema.parse(patch.address)
  if (patch.moneyFormat !== undefined) set.moneyFormat = cleanMoneyFormat(patch.moneyFormat)
  if (patch.pricesIncludeGst !== undefined) {
    // Read under the row lock, so a concurrent app install is not written over (#1523).
    const apps = await lockStoreApps(ctx.tx, ctx.storeId)
    set.apps = withStoreTax(apps, {
      ...parseStoreTax(apps),
      pricesIncludeGst: patch.pricesIncludeGst,
    })
  }
  if (Object.keys(set).length === 0) return
  await ctx.tx.update(store).set(set).where(eq(store.id, ctx.storeId))
}

/** A location's name and address. Blank fields are stored as empty (null). */
export type LocationDetails = {
  name: string
  line1: string
  line2: string
  city: string
  /** Two-letter state code for India, the region code elsewhere. */
  stateCode: string
  /** Six digits for India; blank when unknown. */
  pincode: string
  /** Two-letter country code. */
  country: string
  phone: string
}

const orNull = (v: string) => (v.trim() ? v.trim() : null)

/**
 * Update a location's name and address (`id`), or add one. A new location holds stock
 * but neither sells online nor becomes the default: those stay the merchant's choice
 * (Settings › Locations), since they decide where orders reserve stock.
 */
export async function saveLocationDetails(
  ctx: StoreContext,
  id: string | null,
  details: LocationDetails,
): Promise<string> {
  const values = {
    name: details.name.trim().slice(0, 80),
    line1: orNull(details.line1),
    line2: orNull(details.line2),
    city: orNull(details.city),
    stateCode: orNull(details.stateCode.slice(0, 8)),
    pincode: /^\d{6}$/.test(details.pincode) ? details.pincode : null,
    country: details.country.trim().toUpperCase().slice(0, 2) || 'IN',
    phone: orNull(details.phone.slice(0, 20)),
  }
  if (id) {
    const rows = await ctx.tx
      .update(location)
      .set(values)
      .where(eq(location.id, id))
      .returning({ id: location.id })
    if (rows.length === 0) throw new Error(`location ${id} not found`)
    return id
  }
  const created = newId()
  await ctx.tx.insert(location).values({
    id: created,
    storeId: ctx.storeId,
    ...values,
    isDefault: false,
    fulfilsOnlineOrders: false,
  })
  return created
}
