/** SOURCE OF TRUTH: upsertCheckoutCustomer
 * WHAT:  Who placed a checkout order: one customer per email per store (or per phone when the
 *        email is optional and blank), the shipping address snapshot, GSTIN and consent.
 * WHY:   Split from place-order.ts (#973); createOrder calls it inside the checkout transaction.
 */
import { address, customer } from '@commerce/db'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { abroadRegion, checkoutCountry, isAbroad } from '../checkout/address-abroad'
import type { CheckoutContact } from '../checkout/settings'
import type { StoreContext } from '../context'
import { recordCustomerChange } from '../customers/changes'
import { encryptCustomerPhone, phoneBlindIndex } from '../customers/phone-crypto'
import { setMarketingConsents } from '../privacy/marketing-consent'
import type { CheckoutDetails } from './place-order-types'

/**
 * The checkout's customer and shipping address: the customer upserted by email (or by phone when
 * the email is blank), the address snapshot inserted, the GSTIN kept, marketing consent granted.
 */
export async function upsertCheckoutCustomer(
  ctx: StoreContext,
  checkout: CheckoutDetails,
  contact: CheckoutContact | null,
  secret: string | undefined,
): Promise<{ customerId: string | null; shippingAddressId: string | null }> {
  const co = { ...checkout, phone: contact?.phone ?? checkout.phone }
  const email = contact ? (contact.email ?? '') : co.email.trim().toLowerCase()
  // Abroad, `stateCode` holds the region's code (as Shopify imports keep it); `province` its name.
  const country = checkoutCountry(co.address.countryCode)
  const province = isAbroad(country)
    ? (abroadRegion(country, co.address.stateCode)?.name ?? null)
    : null
  const defaultAddress = {
    name: co.name,
    line1: co.address.line1,
    line2: co.address.line2 ?? null,
    city: co.address.city,
    stateCode: co.address.stateCode,
    pincode: co.address.pincode,
    country,
    phone: co.phone,
  }
  /* One customer per email per store; a repeat order refreshes name, phone and address.
   * `customer.phone` is encrypted when the caller passed `secret`; the address
   * snapshot below (`address` table, `defaultAddress`) stays plaintext — see
   * `docs/security/data-protection.md`. */
  const customerPhone = secret ? encryptCustomerPhone(co.phone, secret).cipher : co.phone
  const customerPhoneIndex = secret ? phoneBlindIndex(co.phone, secret) : null
  const [cu] = !email
    ? await upsertCustomerByPhone(ctx, {
        phone: customerPhone,
        phoneIndex: customerPhoneIndex,
        name: co.name,
        defaultAddress,
      })
    : await ctx.tx
        .insert(customer)
        .values({
          storeId: ctx.storeId,
          email,
          phone: customerPhone,
          phoneIndex: customerPhoneIndex,
          name: co.name,
          defaultAddress,
        })
        .onConflictDoUpdate({
          target: [customer.storeId, customer.email],
          // Whoever types this email at checkout proved nothing: a phone proven by a
          // sign-in code stays (phone sign-in trusts it), otherwise the typed one is
          // stored unproven (`accounts/phone-proof.ts`).
          set: {
            phone: sql`case when ${customer.phoneVerifiedAt} is null then excluded.phone else ${customer.phone} end`,
            phoneIndex: sql`case when ${customer.phoneVerifiedAt} is null then excluded.phone_index else ${customer.phoneIndex} end`,
            name: co.name,
            defaultAddress,
            updatedAt: new Date(),
          },
        })
        .returning({ id: customer.id })
  const [ad] = await ctx.tx
    .insert(address)
    .values({
      storeId: ctx.storeId,
      name: co.name,
      line1: co.address.line1,
      line2: co.address.line2 ?? null,
      city: co.address.city,
      stateCode: co.address.stateCode,
      pincode: co.address.pincode,
      country,
      province,
      phone: co.phone,
    })
    .returning({ id: address.id })
  const customerId = cu?.id ?? null
  const shippingAddressId = ad?.id ?? null
  // A business buyer's validated GSTIN (and name) is kept on the customer for next time; a
  // checkout without them never clears what is saved.
  if (customerId && contact?.gstin) {
    await ctx.tx
      .update(customer)
      .set({
        gstin: contact.gstin,
        businessName: sql`coalesce(${contact.businessName}, ${customer.businessName})`,
      })
      .where(eq(customer.id, customerId))
  }
  // Created or updated (the upsert does not say which); app consumers upsert either way.
  if (customerId) await recordCustomerChange(ctx.tx, ctx.storeId, customerId, 'updated')
  if (customerId && (co.marketing?.email || co.marketing?.whatsapp)) {
    await setMarketingConsents(
      ctx,
      customerId,
      {
        email: email && co.marketing.email ? true : undefined,
        whatsapp: co.marketing.whatsapp ? true : undefined,
      },
      { source: 'checkout', actor: { type: 'customer', id: customerId } },
    )
  }
  return { customerId, shippingAddressId }
}

/**
 * A checkout without an email (Settings → Checkout made it optional) cannot use
 * the email key, so the shopper is matched on their mobile number: the blind
 * index when phones are encrypted, the plain number otherwise.
 */
async function upsertCustomerByPhone(
  ctx: StoreContext,
  values: {
    phone: string
    phoneIndex: string | null
    name: string
    defaultAddress: typeof customer.$inferInsert.defaultAddress
  },
): Promise<{ id: string }[]> {
  const [found] = await ctx.tx
    .select({ id: customer.id })
    .from(customer)
    .where(
      values.phoneIndex
        ? eq(customer.phoneIndex, values.phoneIndex)
        : and(isNull(customer.phoneIndex), eq(customer.phone, values.phone)),
    )
    .orderBy(desc(customer.updatedAt))
    .limit(1)
  if (found) {
    await ctx.tx
      .update(customer)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(customer.id, found.id))
    return [found]
  }
  return ctx.tx
    .insert(customer)
    .values({ storeId: ctx.storeId, email: null, ...values })
    .returning({ id: customer.id })
}
