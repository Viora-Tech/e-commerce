/** SOURCE OF TRUTH: who may act on an order from the storefront — WHAT: the order's id for its signed-in owner or the holder of its view token, null for anyone holding only its number / WHY: "Retry payment", "Pay balance" and "New QR" mint a fresh view token (which opens the order's page: name, address, phone, items); the sequential number alone must never be enough (security audit 2026-10-06, A-00) */
import { order, type StoreTx } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { canViewOrder } from '../preorder/balance-link'

/** The order's id when `viewer` may see it (`canViewOrder`), else null. Store-scoped by RLS. */
export async function viewableOrderId(
  tx: StoreTx,
  orderNumber: number,
  viewer: { customerId: string | null | undefined; token: string | null | undefined },
  secret: string,
): Promise<string | null> {
  if (!Number.isInteger(orderNumber) || orderNumber <= 0) return null
  const [o] = await tx
    .select({ id: order.id, customerId: order.customerId })
    .from(order)
    .where(eq(order.number, orderNumber))
  if (!o) return null
  return canViewOrder(o, viewer, secret) ? o.id : null
}
