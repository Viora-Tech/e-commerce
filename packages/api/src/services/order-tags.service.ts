import type { StoreTx } from '@commerce/db'
import { order } from '@commerce/db'
import { eq, inArray } from 'drizzle-orm'

/** Most tags one order carries (the order page's tag field allows the same). */
const MAX_ORDER_TAGS = 20

/**
 * The orders list's bulk "Add tags" / "Remove tags". Tags match without regard to case, so
 * "VIP" is not added next to "vip"; an order already at the limit keeps the tags it has.
 */
export async function tagOrders(
  tx: StoreTx,
  input: { ids: string[]; tags: string[]; action: 'add' | 'remove' },
) {
  const wanted = [
    ...new Map(
      input.tags
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => [t.toLowerCase(), t]),
    ).values(),
  ]
  if (input.ids.length === 0 || wanted.length === 0) return { updated: 0 }
  const lower = new Set(wanted.map((t) => t.toLowerCase()))
  const rows = await tx
    .select({ id: order.id, tags: order.tags })
    .from(order)
    .where(inArray(order.id, input.ids))
  let updated = 0
  for (const row of rows) {
    const current = row.tags ?? []
    const has = new Set(current.map((t) => t.toLowerCase()))
    const next =
      input.action === 'add'
        ? [...current, ...wanted.filter((t) => !has.has(t.toLowerCase()))].slice(
            0,
            Math.max(MAX_ORDER_TAGS, current.length),
          )
        : current.filter((t) => !lower.has(t.toLowerCase()))
    if (next.length === current.length) continue
    await tx.update(order).set({ tags: next }).where(eq(order.id, row.id))
    updated += 1
  }
  return { updated }
}
