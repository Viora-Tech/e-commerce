/** SOURCE OF TRUTH: who may act on an order from the storefront — WHAT: the order's id for its signed-in owner or the holder of its view token, null for anyone holding only its number / WHY: "Retry payment", "Pay balance" and "New QR" mint a fresh view token (which opens the order's page: name, address, phone, items); the sequential number alone must never be enough (security audit 2026-10-06, A-00) */
import { order, type StoreTx } from '@commerce/db'
import { eq, or, type SQL } from 'drizzle-orm'
import { canViewOrder } from '../preorder/balance-link'

/** The order's id when `viewer` may see it (`canViewOrder`), else null. Store-scoped by RLS. */
export async function viewableOrderId(
  tx: StoreTx,
  orderNumber: number | string,
  viewer: { customerId: string | null | undefined; token: string | null | undefined },
  secret: string,
): Promise<string | null> {
  const where = orderRefWhere(orderNumber)
  if (!where) return null
  const [o] = await tx
    .select({ id: order.id, customerId: order.customerId })
    .from(order)
    .where(where)
  if (!o) return null
  return canViewOrder(o, viewer, secret) ? o.id : null
}

/**
 * The order a storefront link names: `2441` (an order number), `D57` (a draft number, also
 * after the draft became an order) or `-57` (a draft's placeholder number, ditto). Null for
 * anything else. Who may see it is still checked (`canViewOrder`).
 */
export function orderRefWhere(ref: number | string): SQL | null {
  const s = String(ref).trim()
  const draft = /^d(\d{1,9})$/i.exec(s)
  if (draft) return eq(order.draftNumber, Number(draft[1]))
  if (!/^-?\d{1,9}$/.test(s)) return null
  const n = Number(s)
  if (n > 0) return eq(order.number, n)
  if (n < 0) return or(eq(order.number, n), eq(order.draftNumber, -n)) ?? null
  return null
}
