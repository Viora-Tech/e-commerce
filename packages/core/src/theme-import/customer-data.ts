/** SOURCE OF TRUTH: the signed-in shopper for imported themes — WHAT: the Liquid `customer` global's data (name, email, phone, tags, order count and spend, default address, saved address count) read in one query / WHY: Shopify themes show "Sign in" or the shopper's orders and wishlist by whether `customer` is set; a signed-in shopper must see their own account, never someone else's (the storefront never caches a render that read it) */
import { customer, customerAddress, order, type StoreTx } from '@commerce/db'
import { type MarketPricing, presentmentCents } from '@commerce/money'
import { eq, sql } from 'drizzle-orm'
import type { SignedInCustomer } from '../accounts/auth'
import type { LiquidCustomerData } from './drops'

/** Orders that count toward `orders_count` and `total_spent`, as on the admin's customer page. */
const PLACED = sql`${order.customerId} = ${customer.id} and ${order.status} not in ('draft', 'cancelled') and not ${order.isTest}`

/**
 * `who` as Liquid reads them, with their orders and addresses counted in the same query. Null
 * when the row is gone (erased since the session was read). Spend is priced in the page's market.
 */
export async function loadLiquidCustomer(
  tx: StoreTx,
  who: SignedInCustomer,
  pricing: MarketPricing | null,
): Promise<LiquidCustomerData | null> {
  const [row] = await tx
    .select({
      tags: customer.tags,
      defaultAddress: customer.defaultAddress,
      ordersCount: sql<number>`(select count(*)::int from ${order} where ${PLACED})`,
      totalSpent: sql<number>`(select coalesce(sum(${order.totalPaise}), 0)::bigint from ${order} where ${PLACED})`,
      addressesCount: sql<number>`(select count(*)::int from ${customerAddress} where ${customerAddress.customerId} = ${customer.id})`,
    })
    .from(customer)
    .where(eq(customer.id, who.id))
  if (!row) return null
  const a = row.defaultAddress
  return {
    id: who.id,
    email: who.email,
    name: who.name,
    phone: who.phone,
    acceptsMarketing: who.acceptsMarketing,
    tags: row.tags,
    ordersCount: Number(row.ordersCount),
    totalSpent: presentmentCents(Number(row.totalSpent), pricing),
    defaultAddress: a
      ? {
          name: a.name,
          line1: a.line1,
          line2: a.line2 ?? null,
          city: a.city,
          stateCode: a.stateCode,
          pincode: a.pincode,
          country: a.country ?? 'IN',
        }
      : null,
    addressesCount: Number(row.addressesCount),
  }
}
