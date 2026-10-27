import { type CustomerAddress, customer, customerAddress, type StoreTx } from '@commerce/db'
import { and, asc, desc, eq, ne } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { AddressInputSchema, type AddressLabel, fieldErrors, type ParsedAddress } from './schemas'

export type SavedAddress = {
  id: string
  name: string
  line1: string
  line2: string | null
  city: string
  stateCode: string
  pincode: string
  phone: string
  /** Home, Office or Other; null when the shopper never tagged it. */
  label: AddressLabel | null
  /** The default shipping address. */
  isDefault: boolean
  /** The default billing address; when no row has it, billing follows the shipping default. */
  isDefaultBilling: boolean
  /** Company billed at this address, for GST invoices. */
  businessName: string | null
  gstin: string | null
}

export type AddressResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> }

const columns = {
  id: customerAddress.id,
  name: customerAddress.name,
  line1: customerAddress.line1,
  line2: customerAddress.line2,
  city: customerAddress.city,
  stateCode: customerAddress.stateCode,
  pincode: customerAddress.pincode,
  phone: customerAddress.phone,
  label: customerAddress.label,
  isDefault: customerAddress.isDefault,
  isDefaultBilling: customerAddress.isDefaultBilling,
  businessName: customerAddress.businessName,
  gstin: customerAddress.gstin,
}

/**
 * Whether the customer is visible in this transaction. Inside `withStore`, RLS
 * hides other stores' customers, so an id from another store reads as absent.
 */
export async function customerExists(tx: StoreTx, customerId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: customer.id })
    .from(customer)
    .where(eq(customer.id, customerId))
  return Boolean(row)
}

/** A customer's address book, default first, then newest. */
export async function listAddresses(
  ctx: StoreContext,
  customerId: string,
): Promise<SavedAddress[]> {
  return ctx.tx
    .select(columns)
    .from(customerAddress)
    .where(eq(customerAddress.customerId, customerId))
    .orderBy(
      desc(customerAddress.isDefault),
      desc(customerAddress.createdAt),
      asc(customerAddress.id),
    )
}

/** Keep `customer.default_address` (what the admin profile card shows) in step with the book. */
async function syncDefaultSnapshot(ctx: StoreContext, customerId: string): Promise<void> {
  const [d] = await ctx.tx
    .select(columns)
    .from(customerAddress)
    .where(and(eq(customerAddress.customerId, customerId), eq(customerAddress.isDefault, true)))
  if (!d) return
  const snapshot: CustomerAddress = {
    name: d.name,
    line1: d.line1,
    line2: d.line2,
    city: d.city,
    stateCode: d.stateCode,
    pincode: d.pincode,
    country: 'IN',
    phone: d.phone,
  }
  await ctx.tx
    .update(customer)
    .set({ defaultAddress: snapshot, updatedAt: new Date() })
    .where(eq(customer.id, customerId))
}

async function clearDefault(ctx: StoreContext, customerId: string, except?: string): Promise<void> {
  await ctx.tx
    .update(customerAddress)
    .set({ isDefault: false })
    .where(
      and(
        eq(customerAddress.customerId, customerId),
        eq(customerAddress.isDefault, true),
        except ? ne(customerAddress.id, except) : undefined,
      ),
    )
}

async function clearDefaultBilling(
  ctx: StoreContext,
  customerId: string,
  except?: string,
): Promise<void> {
  await ctx.tx
    .update(customerAddress)
    .set({ isDefaultBilling: false })
    .where(
      and(
        eq(customerAddress.customerId, customerId),
        eq(customerAddress.isDefaultBilling, true),
        except ? ne(customerAddress.id, except) : undefined,
      ),
    )
}

async function countAddresses(ctx: StoreContext, customerId: string): Promise<number> {
  const rows = await ctx.tx
    .select({ id: customerAddress.id })
    .from(customerAddress)
    .where(eq(customerAddress.customerId, customerId))
  return rows.length
}

/** Most addresses a shopper can keep; Shopify has no hard limit but a runaway form should. */
export const MAX_ADDRESSES = 20

/** Add an address. The first one becomes the default whatever the form said. */
export async function createAddress(
  ctx: StoreContext,
  customerId: string,
  raw: unknown,
): Promise<AddressResult> {
  const parsed = AddressInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }
  const count = await countAddresses(ctx, customerId)
  if (count >= MAX_ADDRESSES) return { ok: false, errors: { form: 'Address book is full' } }
  const isDefault = count === 0 || parsed.data.isDefault === true
  const isDefaultBilling = parsed.data.isDefaultBilling === true
  if (isDefault) await clearDefault(ctx, customerId)
  if (isDefaultBilling) await clearDefaultBilling(ctx, customerId)
  const [row] = await ctx.tx
    .insert(customerAddress)
    .values({
      storeId: ctx.storeId,
      customerId,
      ...toRow(parsed.data),
      isDefault,
      isDefaultBilling,
    })
    .returning({ id: customerAddress.id })
  if (isDefault) await syncDefaultSnapshot(ctx, customerId)
  return { ok: true, id: row?.id as string }
}

function toRow(a: ParsedAddress) {
  return {
    name: a.name,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    stateCode: a.stateCode,
    pincode: a.pincode,
    phone: a.phone,
    // An edit that does not mention the tag keeps it (the account form has no tag field).
    ...(a.label === undefined ? {} : { label: a.label }),
    // Same for the billing details: the storefront's form does not show them.
    ...(a.businessName === undefined ? {} : { businessName: a.businessName }),
    ...(a.gstin === undefined ? {} : { gstin: a.gstin }),
  }
}

/**
 * Edit an address the customer owns. Unsetting the shipping default is ignored: pick another
 * instead. The billing default can be switched off (billing then follows the shipping default);
 * left out, it stays as it was.
 */
export async function updateAddress(
  ctx: StoreContext,
  customerId: string,
  addressId: string,
  raw: unknown,
): Promise<AddressResult> {
  const parsed = AddressInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }
  const owned = and(eq(customerAddress.id, addressId), eq(customerAddress.customerId, customerId))
  const [existing] = await ctx.tx.select(columns).from(customerAddress).where(owned)
  if (!existing) return { ok: false, errors: { form: 'Address not found' } }
  const isDefault = existing.isDefault || parsed.data.isDefault === true
  const isDefaultBilling = parsed.data.isDefaultBilling ?? existing.isDefaultBilling
  if (isDefault) await clearDefault(ctx, customerId, addressId)
  if (isDefaultBilling) await clearDefaultBilling(ctx, customerId, addressId)
  await ctx.tx
    .update(customerAddress)
    .set({ ...toRow(parsed.data), isDefault, isDefaultBilling, updatedAt: new Date() })
    .where(owned)
  if (isDefault) await syncDefaultSnapshot(ctx, customerId)
  return { ok: true, id: addressId }
}

export async function setDefaultAddress(
  ctx: StoreContext,
  customerId: string,
  addressId: string,
): Promise<boolean> {
  const owned = and(eq(customerAddress.id, addressId), eq(customerAddress.customerId, customerId))
  const [existing] = await ctx.tx
    .select({ id: customerAddress.id })
    .from(customerAddress)
    .where(owned)
  if (!existing) return false
  await clearDefault(ctx, customerId, addressId)
  await ctx.tx.update(customerAddress).set({ isDefault: true, updatedAt: new Date() }).where(owned)
  await syncDefaultSnapshot(ctx, customerId)
  return true
}

/** Make one saved address the customer's default billing address. */
export async function setDefaultBillingAddress(
  ctx: StoreContext,
  customerId: string,
  addressId: string,
): Promise<boolean> {
  const owned = and(eq(customerAddress.id, addressId), eq(customerAddress.customerId, customerId))
  const [existing] = await ctx.tx
    .select({ id: customerAddress.id })
    .from(customerAddress)
    .where(owned)
  if (!existing) return false
  await clearDefaultBilling(ctx, customerId, addressId)
  await ctx.tx
    .update(customerAddress)
    .set({ isDefaultBilling: true, updatedAt: new Date() })
    .where(owned)
  return true
}

/**
 * Delete an address; when it was the shipping default, the newest remaining one takes over.
 * A deleted billing default leaves billing to follow the shipping default.
 */
export async function deleteAddress(
  ctx: StoreContext,
  customerId: string,
  addressId: string,
): Promise<boolean> {
  const owned = and(eq(customerAddress.id, addressId), eq(customerAddress.customerId, customerId))
  const [gone] = await ctx.tx
    .delete(customerAddress)
    .where(owned)
    .returning({ isDefault: customerAddress.isDefault })
  if (!gone) return false
  if (gone.isDefault) {
    const [next] = await listAddresses(ctx, customerId)
    if (next) await setDefaultAddress(ctx, customerId, next.id)
    else {
      await ctx.tx
        .update(customer)
        .set({ defaultAddress: null, updatedAt: new Date() })
        .where(eq(customer.id, customerId))
    }
  }
  return true
}

/**
 * Save the address a signed-in shopper just checked out with, unless an identical
 * one is already in the book. Invalid input is skipped silently: checkout has
 * already validated what it needs, and saving is a convenience.
 */
export async function rememberCheckoutAddress(
  ctx: StoreContext,
  customerId: string,
  raw: unknown,
): Promise<void> {
  const parsed = AddressInputSchema.safeParse(raw)
  if (!parsed.success) return
  const a = parsed.data
  const book = await listAddresses(ctx, customerId)
  const same = book.some(
    (b) =>
      b.line1.toLowerCase() === a.line1.toLowerCase() &&
      (b.line2 ?? '').toLowerCase() === (a.line2 ?? '').toLowerCase() &&
      b.pincode === a.pincode &&
      b.name.toLowerCase() === a.name.toLowerCase(),
  )
  if (same || book.length >= MAX_ADDRESSES) return
  await createAddress(ctx, customerId, { ...(raw as object), isDefault: book.length === 0 })
}
