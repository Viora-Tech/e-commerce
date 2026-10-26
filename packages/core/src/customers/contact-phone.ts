/** SOURCE OF TRUTH: contact phone from an order — WHAT: `suggestContactPhone` finds the mobile on a customer's latest order or saved address when their contact phone is empty, `adoptContactPhone` saves it (encrypted, unproven) when staff click "Use it" / WHY: imported Shopify customers and guest checkouts often have a phone only on their address, so WhatsApp and SMS consent cannot be asked; staff copy it one customer at a time, never in bulk and never silently */
import { address, customer, customerAddress, order } from '@commerce/db'
import { and, desc, eq, sql } from 'drizzle-orm'
import { normaliseMobile } from '../accounts/schemas'
import type { StoreContext } from '../context'
import { type PrivacyActor, recordPrivacyEvent } from '../privacy/audit'
import { recordCustomerChange } from './changes'
import { customerWithPhone } from './create'
import { decryptCustomerPhone, encryptCustomerPhone } from './phone-crypto'

/** Where the suggested number was found. */
export type ContactPhoneSource = 'order' | 'address'

export type ContactPhoneSuggestion = {
  /** Ten digit Indian mobile, as `createCustomer` stores it. */
  phone: string
  source: ContactPhoneSource
  /** Another customer of the store already has this number; it is not offered then. */
  takenBy: string | null
}

export type AdoptContactPhoneResult =
  | { ok: true; phone: string; source: ContactPhoneSource }
  | { ok: false; reason: 'not_found' | 'has_phone' | 'none' }
  | { ok: false; reason: 'duplicate'; existingId: string }

/** The first number that is a valid mobile, with where it came from. */
function firstMobile(
  candidates: readonly [string | null | undefined, ContactPhoneSource][],
): { phone: string; source: ContactPhoneSource } | null {
  for (const [raw, source] of candidates) {
    const phone = raw ? normaliseMobile(raw) : null
    if (phone) return { phone, source }
  }
  return null
}

/**
 * The mobile staff could save as the customer's contact phone, or null when they already have
 * one or none of their records holds a valid mobile. Looks at the latest order (its phone, then
 * its shipping address), then the default saved address, then the address snapshot the profile
 * shows. Reads only; nothing is written.
 */
export async function suggestContactPhone(
  ctx: StoreContext,
  customerId: string,
  secret: string,
): Promise<ContactPhoneSuggestion | null> {
  const [row] = await ctx.tx
    .select({ phone: customer.phone, defaultAddress: customer.defaultAddress })
    .from(customer)
    .where(eq(customer.id, customerId))
  if (!row || decryptCustomerPhone(row.phone, secret)) return null
  const [latest] = await ctx.tx
    .select({ phone: order.phone, shipPhone: address.phone })
    .from(order)
    .leftJoin(address, eq(address.id, order.shippingAddressId))
    .where(and(eq(order.customerId, customerId), sql`${order.status} <> 'draft'`))
    .orderBy(desc(order.placedAt))
    .limit(1)
  const [saved] = await ctx.tx
    .select({ phone: customerAddress.phone })
    .from(customerAddress)
    .where(eq(customerAddress.customerId, customerId))
    .orderBy(desc(customerAddress.isDefault), desc(customerAddress.updatedAt))
    .limit(1)
  const found = firstMobile([
    [latest?.phone, 'order'],
    [latest?.shipPhone, 'order'],
    [saved?.phone, 'address'],
    [row.defaultAddress?.phone, 'address'],
  ])
  if (!found) return null
  const takenBy = await customerWithPhone(ctx, found.phone, secret, customerId)
  return { ...found, takenBy }
}

/**
 * Save the suggested mobile as the customer's contact phone: one customer, on a staff click.
 * The number is worked out again here (never taken from the browser), refused when the customer
 * already has a phone or another customer has this one, stored encrypted and unproven (phone
 * sign-in trusts only proven numbers), and recorded in the outbox and the privacy audit trail.
 * Marketing consent is left alone: a phone on an order is not a yes to WhatsApp or SMS.
 */
export async function adoptContactPhone(
  ctx: StoreContext,
  customerId: string,
  meta: { secret: string; actor: PrivacyActor },
): Promise<AdoptContactPhoneResult> {
  const [exists] = await ctx.tx
    .select({ phone: customer.phone })
    .from(customer)
    .where(eq(customer.id, customerId))
  if (!exists) return { ok: false, reason: 'not_found' }
  if (decryptCustomerPhone(exists.phone, meta.secret)) return { ok: false, reason: 'has_phone' }
  const suggestion = await suggestContactPhone(ctx, customerId, meta.secret)
  if (!suggestion) return { ok: false, reason: 'none' }
  if (suggestion.takenBy) {
    return { ok: false, reason: 'duplicate', existingId: suggestion.takenBy }
  }
  const phone = encryptCustomerPhone(suggestion.phone, meta.secret)
  await ctx.tx
    .update(customer)
    .set({
      phone: phone.cipher,
      phoneIndex: phone.index,
      phoneVerifiedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(customer.id, customerId))
  await recordCustomerChange(ctx.tx, ctx.storeId, customerId, 'updated')
  await recordPrivacyEvent(ctx, {
    action: 'contact.phone_added',
    actor: meta.actor,
    customerId,
    detail: { field: 'phone', source: suggestion.source },
  })
  return { ok: true, phone: suggestion.phone, source: suggestion.source }
}
