/** SOURCE OF TRUTH: moving an order to another customer — WHAT: `moveOrderToCustomer` (order page › Customer › "Change customer", and the contact edit's "also move this order to them") re-points one order, and the rows that count it per customer (discount uses, affiliate commission), at another existing customer, with a timeline line on the order and on both customers / WHY: an order whose email staff corrected stays on the old record, so the shopper's account shows nothing; moving it is the fix that never merges two people by itself */
import {
  customer,
  customerNote,
  discountUsage,
  order,
  orderNote,
  storeCreditEntry,
} from '@commerce/db'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { recordCustomerChange } from '../customers/changes'

export type MoveOrderResult =
  | { ok: true; fromCustomerId: string | null; toCustomerId: string; changed: boolean }
  | {
      ok: false
      /**
       * `order_not_found`; `customer_not_found` (missing, erased or merged away);
       * `store_credit`: the order was paid with (or refunded to) the current customer's store
       * credit, which belongs to that balance; merge the two customers instead.
       */
      reason: 'order_not_found' | 'customer_not_found' | 'store_credit'
    }

const labelOf = (c: { name: string | null; email: string | null } | undefined) =>
  c?.name?.trim() || c?.email || 'a guest'

/**
 * Re-point `orderId` at `customerId`, in the caller's transaction. The order keeps its own
 * email, phone and addresses (they are what the shopper typed); only who it belongs to changes,
 * so it shows in that customer's account and counts towards their totals. An order already on
 * that customer changes nothing. Drafts move too (a draft is for someone).
 */
export async function moveOrderToCustomer(
  ctx: StoreContext,
  input: { orderId: string; customerId: string; author: string },
): Promise<MoveOrderResult> {
  const [o] = await ctx.tx
    .select({ id: order.id, number: order.number, customerId: order.customerId })
    .from(order)
    .where(eq(order.id, input.orderId))
    .for('update')
  if (!o) return { ok: false, reason: 'order_not_found' }
  const [to] = await ctx.tx
    .select({ id: customer.id, name: customer.name, email: customer.email })
    .from(customer)
    .where(
      and(
        eq(customer.id, input.customerId),
        isNull(customer.anonymisedAt),
        isNull(customer.mergedIntoId),
      ),
    )
  if (!to) return { ok: false, reason: 'customer_not_found' }
  if (o.customerId === to.id) {
    return { ok: true, fromCustomerId: o.customerId, toCustomerId: to.id, changed: false }
  }
  // Money on a balance stays with that balance: moving the order would leave a refund to store
  // credit landing on someone else.
  const [credit] = o.customerId
    ? await ctx.tx
        .select({ id: storeCreditEntry.id })
        .from(storeCreditEntry)
        .where(
          and(eq(storeCreditEntry.orderId, o.id), eq(storeCreditEntry.customerId, o.customerId)),
        )
        .limit(1)
    : []
  if (credit) return { ok: false, reason: 'store_credit' }

  const [from] = o.customerId
    ? await ctx.tx
        .select({ name: customer.name, email: customer.email })
        .from(customer)
        .where(eq(customer.id, o.customerId))
    : []
  await ctx.tx.update(order).set({ customerId: to.id }).where(eq(order.id, o.id))
  await ctx.tx
    .update(discountUsage)
    .set({ customerId: to.id })
    .where(eq(discountUsage.orderId, o.id))
  // Affiliates app table, by name (core does not depend on the plugin; core migrations make it).
  await ctx.tx.execute(
    sql`update affiliate_commission set customer_id = ${to.id} where store_id = ${ctx.storeId} and order_id = ${o.id}`,
  )

  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId: o.id,
    body: `Customer changed from ${labelOf(from)} to ${labelOf(to)}`,
    author: input.author,
  })
  const notes = [
    { customerId: to.id, body: `Order #${o.number} moved here from ${labelOf(from)}` },
    ...(o.customerId
      ? [{ customerId: o.customerId, body: `Order #${o.number} moved to ${labelOf(to)}` }]
      : []),
  ]
  await ctx.tx
    .insert(customerNote)
    .values(notes.map((n) => ({ ...n, storeId: ctx.storeId, author: input.author })))
  await recordCustomerChange(ctx.tx, ctx.storeId, to.id, 'updated')
  if (o.customerId) await recordCustomerChange(ctx.tx, ctx.storeId, o.customerId, 'updated')
  return { ok: true, fromCustomerId: o.customerId, toCustomerId: to.id, changed: true }
}

/**
 * The other customer of this store who has `email` (case-insensitive), for the contact edit's
 * "This email belongs to …" offer. Null when nobody, or the order's own customer, has it.
 */
export async function emailOwnerForOrder(
  ctx: StoreContext,
  input: { orderId: string; email: string },
): Promise<{ id: string; name: string | null; email: string | null } | null> {
  const email = input.email.trim().toLowerCase()
  if (!email) return null
  const [o] = await ctx.tx
    .select({ customerId: order.customerId })
    .from(order)
    .where(eq(order.id, input.orderId))
  if (!o) return null
  const [owner] = await ctx.tx
    .select({ id: customer.id, name: customer.name, email: customer.email })
    .from(customer)
    .where(
      and(
        sql`lower(${customer.email}) = ${email}`,
        isNull(customer.anonymisedAt),
        isNull(customer.mergedIntoId),
      ),
    )
    .limit(1)
  if (!owner || owner.id === o.customerId) return null
  return owner
}
