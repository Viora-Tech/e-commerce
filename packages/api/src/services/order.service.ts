import type { StoreTx } from '@commerce/db'
import { address, customer, order, orderLine, payment } from '@commerce/db'
import { and, count, desc, eq, ilike, or } from 'drizzle-orm'

export type OrderStatus = 'placed' | 'paid' | 'fulfilled' | 'delivered' | 'cancelled'

export async function listOrders(
  tx: StoreTx,
  input: {
    page: number
    perPage: number
    search?: string | undefined
    status?: OrderStatus | undefined
  },
) {
  const where = and(
    input.search
      ? or(ilike(order.email, `%${input.search}%`), ilike(customer.name, `%${input.search}%`))
      : undefined,
    input.status ? eq(order.status, input.status) : undefined,
  )
  const base = tx
    .select({
      id: order.id,
      number: order.number,
      status: order.status,
      paymentMethod: order.paymentMethod,
      totalPaise: order.totalPaise,
      email: order.email,
      customerName: customer.name,
      placedAt: order.placedAt,
    })
    .from(order)
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(where)
  const [countRow] = await tx
    .select({ total: count() })
    .from(order)
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(where)
  const items = await base
    .orderBy(desc(order.placedAt))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  return { items, total: countRow?.total ?? 0 }
}

export async function getOrder(tx: StoreTx, id: string) {
  const [o] = await tx.select().from(order).where(eq(order.id, id))
  if (!o) return null
  const lines = await tx.select().from(orderLine).where(eq(orderLine.orderId, id))
  const payments = await tx.select().from(payment).where(eq(payment.orderId, id))
  const [cust] = o.customerId
    ? await tx.select().from(customer).where(eq(customer.id, o.customerId))
    : []
  const [ship] = o.shippingAddressId
    ? await tx.select().from(address).where(eq(address.id, o.shippingAddressId))
    : []
  return { ...o, lines, payments, customer: cust ?? null, shippingAddress: ship ?? null }
}

export async function setOrderStatus(tx: StoreTx, id: string, status: OrderStatus) {
  const [o] = await tx.update(order).set({ status }).where(eq(order.id, id)).returning()
  return o ?? null
}
