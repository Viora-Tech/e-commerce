/**
 * The queries behind the MCP server and its OAuth consent page (`src/mcp`), kept here so every
 * query in the API package lives under `src/services` (service-layer audit).
 */
import { decryptCustomerPhone } from '@commerce/core'
import { customer, order, type StoreTx, store } from '@commerce/db'
import { count, desc, eq } from 'drizzle-orm'

/** The store's name and slug, for the consent page. */
export async function storeNameAndSlug(
  tx: StoreTx,
  storeId: string,
): Promise<{ name: string; slug: string } | null> {
  const [row] = await tx
    .select({ name: store.name, slug: store.slug })
    .from(store)
    .where(eq(store.id, storeId))
  return row ?? null
}

export type McpCustomer = {
  name: string | null
  email: string | null
  phone: string | null
  orders: number
  lastOrder: number | null
}

/** One customer by email or by one of their order numbers (MCP `customerDetails`). */
export async function findCustomerForMcp(
  tx: StoreTx,
  input: { email?: string | undefined; order?: number | undefined },
  secret: string,
): Promise<McpCustomer | null> {
  let row: typeof customer.$inferSelect | undefined
  if (input.order) {
    const [o] = await tx
      .select({ customerId: order.customerId })
      .from(order)
      .where(eq(order.number, input.order))
    if (o?.customerId) [row] = await tx.select().from(customer).where(eq(customer.id, o.customerId))
  } else if (input.email) {
    ;[row] = await tx
      .select()
      .from(customer)
      .where(eq(customer.email, input.email.trim().toLowerCase()))
  }
  if (!row) return null
  const [orders] = await tx.select({ n: count() }).from(order).where(eq(order.customerId, row.id))
  const [last] = await tx
    .select({ number: order.number })
    .from(order)
    .where(eq(order.customerId, row.id))
    .orderBy(desc(order.placedAt))
    .limit(1)
  return {
    name: row.name,
    email: row.email,
    phone: decryptCustomerPhone(row.phone, secret),
    orders: orders?.n ?? 0,
    lastOrder: last?.number ?? null,
  }
}
